const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const res = require('./response');
const logger = require('./logger');
const auth = require('./auth');

exports.main = async (event) => {
  const { orderId, type, reason, items, exchangeItems } = event;

  if (!orderId || !type) return res.badRequest('参数错误');
  if (typeof orderId !== 'string') return res.badRequest('参数格式错误');
  if (!['return', 'exchange'].includes(type)) return res.badRequest('无效的退换货类型');

  try {
    const authResult = await auth.requireOpenid();
    if (!authResult.authorized) return authResult.response;
    const openid = authResult.openid;

    const order = await db.collection('orders').doc(orderId).get();
    if (!order.data) return res.notFound('订单不存在');
    if (order.data._openid !== openid) return res.forbidden('无权操作');
    if (order.data.status !== 'completed') return res.conflict('订单未完成，无法申请退换货');

    const prevRR = order.data.returnRequest;
    if (prevRR) {
      if (prevRR.status === 'pending') {
        return res.conflict('已有退换货申请在处理中');
      }
      if (prevRR.status === 'approved' || prevRR.status === 'completed') {
        return res.conflict('该订单退换货已完成，无法再次申请');
      }
      // status === 'rejected'
      const rejectionCount = prevRR.rejectionCount || 0;
      if (rejectionCount >= 2) {
        return res.conflict('退换货申请已被拒绝2次，无法再次申请');
      }
    }

    // ===== 安全验证：items 价格以原订单为准 =====
    const orderItems = order.data.items || [];
    const orderPriceMap = {};
    orderItems.forEach(item => {
      if (item.productId) orderPriceMap[item.productId] = item;
    });

    // 验证退货 items — 价格以原订单为准
    const validatedItems = (items || []).map(item => {
      const original = orderPriceMap[item.productId];
      if (!original) {
        // 商品不在原订单中，拒绝
        return { ...item, _invalid: true };
      }
      return {
        productId: item.productId,
        name: original.name || item.name,
        price: original.price,  // 强制使用原订单价格
        quantity: Math.min(item.quantity || 1, original.quantity || 1), // 不超过原订单数量
        unit: original.unit || item.unit || '米'
      };
    });

    const invalidItems = validatedItems.filter(i => i._invalid);
    if (invalidItems.length > 0) {
      logger.warn('requestReturn invalid items', { orderId, openid, invalidCount: invalidItems.length });
      return res.badRequest('退换货商品与原订单不符，请刷新后重试');
    }

    // 验证换货 items — 价格以原订单为准
    const validatedExchange = type === 'exchange' ? (exchangeItems || []).map(item => {
      const original = orderPriceMap[item.productId];
      if (!original) {
        return { ...item, _invalid: true };
      }
      return {
        productId: item.productId,
        name: original.name || item.name,
        price: original.price,
        quantity: Math.min(item.quantity || 1, original.quantity || 1),
        unit: original.unit || item.unit || '米'
      };
    }) : undefined;

    if (validatedExchange && validatedExchange.some(i => i._invalid)) {
      return res.badRequest('换货商品与原订单不符，请刷新后重试');
    }
    // ===== 价格验证结束 =====

    const rejectionCount = prevRR ? (prevRR.rejectionCount || 0) : 0;
    const isRetry = rejectionCount > 0;

    const returnRequest = {
      orderId,
      _openid: openid,
      type,
      reason: reason || '',
      items: validatedItems,
      exchangeItems: validatedExchange,
      rejectionCount,
      isRetry,
      status: 'pending',
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    };

    await db.collection('returnRequests').add({ data: returnRequest });

    await db.collection('orders').doc(orderId).update({
      data: {
        returnRequest: {
          type,
          reason: reason || '',
          items: validatedItems,
          exchangeItems: validatedExchange,
          rejectionCount,
          isRetry,
          status: 'pending'
        },
        updatedAt: db.serverDate()
      }
    });

    logger.info('requestReturn', { orderId, openid, type });
    return res.ok();
  } catch (err) {
    logger.error('requestReturn', err, { orderId, openid, type });
    return res.internalError();
  }
};
