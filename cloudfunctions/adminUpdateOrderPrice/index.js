const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const res = require('./response');
const logger = require('./logger');
const auth = require('./auth');

exports.main = async (event) => {
  const authResult = await auth.requireAdmin();
  if (!authResult.authorized) return authResult.response;

  const { orderId, totalAmount } = event;

  if (!orderId || totalAmount === undefined || totalAmount < 0) {
    return res.badRequest('参数错误');
  }

  try {
    await db.collection('orders').doc(orderId).update({
      data: {
        totalAmount: Math.round(totalAmount),
        updatedAt: db.serverDate()
      }
    });
    logger.info('adminUpdateOrderPrice', { orderId, totalAmount });
    return res.ok();
  } catch (err) {
    logger.error('adminUpdateOrderPrice', err, { orderId, totalAmount });
    return res.internalError();
  }
};
