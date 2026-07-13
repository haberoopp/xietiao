const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const res = require('./response');
const logger = require('./logger');
const auth = require('./auth');
const notify = require('./notify');
const rateLimiter = require('./rateLimiter');

exports.main = async (event) => {
  const { customerName, phone, address, items, totalAmount, remark, deliveryMethod, location } = event;
  const VALID_DELIVERY = ['pickup', 'delivery', 'logistics'];
  const safeDeliveryMethod = VALID_DELIVERY.includes(deliveryMethod) ? deliveryMethod : 'delivery';

  if (!customerName || !phone || !address || !items || items.length === 0) {
    return res.badRequest('请填写完整信息并选择商品');
  }

  try {
    const authResult = await auth.requireOpenid();
    if (!authResult.authorized) return authResult.response;
    const openid = authResult.openid;

    // Rate limit: max 5 orders per minute per user
    const rateCheck = await rateLimiter.check(db, `order:${openid}`, { max: 5, window: 60 });
    if (!rateCheck.allowed) return res.badRequest(`Too many orders. Retry in ${rateCheck.retryAfter}s`);

    // ===== 服务端价格验算 =====
    // 从数据库查询所有产品的当前价格
    const productIds = items.map(i => i.productId).filter(Boolean);
    const priceMap = {};
    if (productIds.length > 0) {
      // 批量查询产品价格（分批，in 最多100）
      const BATCH = 100;
      for (let i = 0; i < productIds.length; i += BATCH) {
        const batch = productIds.slice(i, i + BATCH);
        const prodRes = await db.collection('products')
          .where({ _id: _.in(batch) })
          .field({ price: true, name: true, unit: true })
          .get();
        prodRes.data.forEach(p => { priceMap[p._id] = p; });
      }
    }

    // 查询该客户的专属定价
    const customPriceMap = {};
    try {
      const customRes = await db.collection('customerPrices')
        .where({ customerPhone: phone, productId: _.in(productIds) })
        .get();
      customRes.data.forEach(cp => { customPriceMap[cp.productId] = cp.customPrice; });
    } catch (e) { /* customerPrices 集合可能不存在 */ }

    // 重新计算应收金额（分）
    let serverTotal = 0;
    const validatedItems = items.map(item => {
      const prod = priceMap[item.productId];
      // 使用专属价 > 产品原价（分）> 客户端传入价（兜底）
      const unitPrice = customPriceMap[item.productId] || (prod ? prod.price : (item.price || 0));
      const quantity = Math.max(0, parseFloat(item.quantity) || 0);
      const lineTotal = Math.round(unitPrice * quantity);
      serverTotal += lineTotal;
      return {
        productId: item.productId,
        name: item.name || (prod ? prod.name : ''),
        price: unitPrice,
        quantity,
        unit: (prod ? prod.unit : '') || item.unit || '米'
      };
    });

    // 如果客户端传入金额与服务端计算差额超过1元(100分)，拒绝
    const clientParsed = parseFloat(totalAmount);
    if (isNaN(clientParsed)) {
      return res.badRequest('订单金额格式错误');
    }
    const clientTotal = Math.round(clientParsed || 0);
    if (Math.abs(clientTotal - serverTotal) > 100) {
      logger.warn('submitOrder price mismatch', {
        clientTotal, serverTotal, phone, itemsCount: items.length
      });
      return res.badRequest('订单金额异常，请刷新后重试');
    }
    // ===== 价格验算结束 =====

    const security = require('./security');
    const order = {
      _openid: openid,
      customerName: security.sanitizeText(customerName),
      phone,
      address: security.sanitizeText(address),
      items: validatedItems,
      totalAmount: serverTotal,
      deliveryMethod: safeDeliveryMethod,
      logisticsCompany: deliveryMethod === 'logistics' ? security.sanitizeText(event.logisticsCompany || '') : '',
      remark: security.sanitizeText(remark),
      status: 'processing',
      payment_status: 'unpaid',
      paid_amount: 0,
      pickedUp: false,
      createdAt: db.serverDate()
    };
    if (location) order.location = location;

    const result = await db.collection('orders').add({ data: order });
    const orderId = result._id;
    logger.info('submitOrder', { orderId, customerName });

    // 通知所有订阅管理员：新订单
    try {
      const notifyResult = await notify.sendToAdmins(db, 'NEW_ORDER', { _id: orderId, customerName, totalAmount, items }, {});
      logger.info('notify NEW_ORDER result', { orderId, ...notifyResult });
    } catch (e) {
      logger.warn('notify NEW_ORDER failed', { orderId, error: e.message });
    }

    return res.record({ orderId });
  } catch (err) {
    logger.error('submitOrder', err, { customerName, phone });
    return res.internalError();
  }
};
