const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const res = require('./response');
const logger = require('./logger');
const auth = require('./auth');

exports.main = async (event) => {
  const authResult = await auth.requireAdmin();
  if (!authResult.authorized) return authResult.response;

  const { orderId, status } = event;

  if (!orderId || !status) {
    return res.badRequest('参数错误');
  }

  const validStatus = ['processing', 'completed', 'cancelled'];
  if (!validStatus.includes(status)) {
    return res.badRequest('无效的状态值');
  }

  try {
    await db.collection('orders').doc(orderId).update({
      data: { status, updatedAt: db.serverDate() }
    });
    logger.info('adminUpdateOrderStatus', { orderId, status });
    return res.ok();
  } catch (err) {
    logger.error('adminUpdateOrderStatus', err, { orderId, status });
    return res.internalError();
  }
};
