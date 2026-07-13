const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const res = require('./response');
const logger = require('./logger');
const auth = require('./auth');
const security = require('./security');

exports.main = async (event) => {
  const { action } = event;

  // getByPhone is client-side API, no admin auth needed
  if (action === 'getByPhone') {
    return doGetByPhone(event);
  }

  // All other actions require admin auth
  const adminAuth = await auth.requireRole('manager');
  if (!adminAuth.authorized) return adminAuth.response;

  try {
    switch (action) {
      case 'list':        return doList(event);
      case 'set':         return doSet(event);
      case 'batchSet':    return doBatchSet(event);
      case 'delete':      return doDelete(event);
      case 'batchDelete': return doBatchDelete(event);
      default:            return res.badRequest('未知操作');
    }
  } catch (err) {
    logger.error('customerPriceCRUD', err, { action: event.action });
    return res.internalError();
  }
};

/**
 * list: Paginated listing of custom prices
 * Params: page, pageSize, customerPhone? (filter), keyword? (productName fuzzy search)
 */
async function doList(event) {
  const { page = 1, pageSize = 50, customerPhone, keyword } = event;
  const where = {};
  if (customerPhone) where.customerPhone = customerPhone;
  if (keyword) where.productName = db.RegExp({ regexp: security.escapeRegex(keyword), options: 'i' });

  const safeSize = Math.min(parseInt(pageSize) || 50, 100);
  const skip = (parseInt(page) - 1) * safeSize;

  const [totalRes, listRes] = await Promise.all([
    db.collection('customerPrices').where(where).count(),
    db.collection('customerPrices')
      .where(where)
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(safeSize)
      .get()
  ]);

  logger.info('customerPriceCRUD list', { customerPhone, keyword, page, total: totalRes.total });
  return res.list(listRes.data, totalRes.total, page, safeSize);
}

/**
 * set: Single upsert (by customerPhone + productId)
 * Params: customerPhone, productId, productName, customPrice (in cents)
 */
async function doSet(event) {
  const { customerPhone, productId, productName, customPrice } = event;

  if (!customerPhone || !productId || customPrice === undefined) {
    return res.badRequest('参数不完整');
  }

  // Atomic upsert: try update first, insert if no match
  const updateResult = await db.collection('customerPrices')
    .where({ customerPhone, productId })
    .update({
      data: {
        customPrice: Math.round(customPrice),
        productName: productName || '',
        updatedAt: db.serverDate()
      }
    });

  if (updateResult.stats.updated === 0) {
    await db.collection('customerPrices').add({
      data: {
        customerPhone,
        productId,
        productName: productName || '',
        customPrice: Math.round(customPrice),
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });
  }

  logger.info('customerPriceCRUD set', { customerPhone, productId, customPrice });
  return res.ok();
}

/**
 * batchSet: Batch set custom prices
 * Params: entries: [{ customerPhone, productId, productName, customPrice }]
 * Returns: { updated: N }
 */
async function doBatchSet(event) {
  const { entries } = event;

  if (!entries || !Array.isArray(entries) || entries.length === 0) {
    return res.badRequest('entries 不能为空');
  }

  let updated = 0;
  for (const entry of entries) {
    const { customerPhone, productId, productName, customPrice } = entry;
    if (!customerPhone || !productId || customPrice === undefined) continue;

    // Atomic upsert: try update first, insert if no match
    const updateResult = await db.collection('customerPrices')
      .where({ customerPhone, productId })
      .update({
        data: {
          customPrice: Math.round(customPrice),
          productName: productName || '',
          updatedAt: db.serverDate()
        }
      });

    if (updateResult.stats.updated === 0) {
      await db.collection('customerPrices').add({
        data: {
          customerPhone,
          productId,
          productName: productName || '',
          customPrice: Math.round(customPrice),
          createdAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
      });
    }
    updated++;
  }

  logger.info('customerPriceCRUD batchSet', { count: updated });
  return res.ok();
}

/**
 * delete: Remove a single custom price entry
 * Params: customerPhone, productId
 */
async function doDelete(event) {
  const { customerPhone, productId } = event;

  if (!customerPhone || !productId) {
    return res.badRequest('参数不完整');
  }

  const existing = await db.collection('customerPrices')
    .where({ customerPhone, productId })
    .limit(1)
    .get();

  if (existing.data.length > 0) {
    await db.collection('customerPrices').doc(existing.data[0]._id).remove();
  }

  logger.info('customerPriceCRUD delete', { customerPhone, productId });
  return res.ok();
}

/**
 * batchDelete: Batch delete custom prices
 * Params: entries: [{ customerPhone, productId }]
 * Returns: { deleted: N }
 */
async function doBatchDelete(event) {
  const { entries } = event;

  if (!entries || !Array.isArray(entries) || entries.length === 0) {
    return res.badRequest('entries 不能为空');
  }

  let deleted = 0;
  for (const { customerPhone, productId } of entries) {
    if (!customerPhone || !productId) continue;

    const existing = await db.collection('customerPrices')
      .where({ customerPhone, productId })
      .limit(1)
      .get();

    if (existing.data.length > 0) {
      await db.collection('customerPrices').doc(existing.data[0]._id).remove();
      deleted++;
    }
  }

  logger.info('customerPriceCRUD batchDelete', { count: deleted });
  return res.ok();
}

/**
 * getByPhone: Client-side API to fetch all custom prices for a customer
 * Params: phone
 * Returns: { code: 0, data: { list: [...], total: N } }
 */
async function doGetByPhone(event) {
  const { phone } = event;
  const authResult = await auth.requireOpenid();
  if (!authResult.authorized) return authResult.response;
  if (!phone) return res.badRequest('手机号不能为空');

  const result = await db.collection('customerPrices')
    .where({ customerPhone: phone })
    .get();

  logger.info('customerPriceCRUD getByPhone', { phone, count: result.data.length });
  return res.list(result.data, result.data.length);
}
