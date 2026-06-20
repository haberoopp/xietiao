const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const res = require('./response');
const logger = require('./logger');
const auth = require('./auth');

exports.main = async (event) => {
  const { orderId, type, reason, items, exchangeItems } = event;

  if (!orderId || !type) return res.badRequest('参数错误');
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

    const rejectionCount = prevRR ? (prevRR.rejectionCount || 0) : 0;
    const isRetry = rejectionCount > 0;

    const returnRequest = {
      orderId,
      _openid: openid,
      type,
      reason: reason || '',
      items: items || [],
      exchangeItems: exchangeItems || undefined,
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
          items: items || [],
          exchangeItems: exchangeItems || undefined,
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
