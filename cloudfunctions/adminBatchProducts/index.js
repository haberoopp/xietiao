const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const res = require('./response');
const logger = require('./logger');
const auth = require('./auth');
const oplog = require('./operationLog');
const _ = db.command;

exports.main = async (event) => {
  try {
    const authResult = await auth.requireRole('manager');
    if (!authResult.authorized) return authResult.response;

    const { action, ids } = event;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.badRequest('请选择至少一个产品');
    }
    if (ids.length > 100) {
      return res.badRequest('单次最多操作100个产品');
    }

    switch (action) {
      case 'delete':
        return await batchDelete(ids, authResult.admin.username);
      case 'update':
        return await batchUpdate(ids, event, authResult.admin.username);
      default:
        return res.badRequest('未知操作');
    }
  } catch (err) {
    logger.error('adminBatchProducts error', err, { action: event.action });
    return res.internalError();
  }
};

async function batchDelete(ids, operator) {
  try {
    await db.collection('products')
      .where({ _id: _.in(ids) })
      .remove();
    logger.info('Batch delete products', { count: ids.length });
    try { await oplog.logOperation(db, operator, 'product.delete', '批量', `删除${ids.length}个产品`); } catch (e) {}
    return res.ok();
  } catch (err) {
    // Fallback: delete one by one
    let deleted = 0;
    for (const id of ids) {
      try {
        await db.collection('products').doc(id).remove();
        deleted++;
      } catch (e) {
        logger.warn('Batch delete skip', { id, error: e.message });
      }
    }
    logger.info('Batch delete products (fallback)', { requested: ids.length, deleted });
    return res.ok();
  }
}

async function batchUpdate(ids, event, operator) {
  const updateData = { updatedAt: db.serverDate() };

  if (event.category !== undefined) updateData.category = event.category;
  if (event.status !== undefined) updateData.status = event.status;
  if (event.unit !== undefined) updateData.unit = event.unit;

  if (Object.keys(updateData).length <= 1) {
    return res.badRequest('没有要更新的字段');
  }

  try {
    await db.collection('products')
      .where({ _id: _.in(ids) })
      .update({ data: updateData });
    logger.info('Batch update products', { count: ids.length, fields: Object.keys(updateData) });
    try { await oplog.logOperation(db, operator, 'product.update', '批量', `批量更新${ids.length}个产品`); } catch (e) {}
    return res.ok();
  } catch (err) {
    // Fallback: update one by one
    let updated = 0;
    for (const id of ids) {
      try {
        await db.collection('products').doc(id).update({ data: updateData });
        updated++;
      } catch (e) {
        logger.warn('Batch update skip', { id, error: e.message });
      }
    }
    logger.info('Batch update products (fallback)', { requested: ids.length, updated });
    return res.ok();
  }
}
