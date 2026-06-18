const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const res = require('./response');
const logger = require('./logger');
const auth = require('./auth');

exports.main = async (event) => {
  try {
    const authResult = await auth.requireAdmin();
    if (!authResult.authorized) return authResult.response;

    const { orderId } = event;
    if (!orderId) return res.badRequest('参数错误');

    const order = await db.collection('orders').doc(orderId).get();
    if (!order.data) return res.notFound('订单不存在');

    const current = order.data.pickedUp || false;
    await db.collection('orders').doc(orderId).update({
      data: { pickedUp: !current, updatedAt: db.serverDate() }
    });
    logger.info('Order pickup toggled', { orderId, pickedUp: !current });
    return res.record({ pickedUp: !current });
  } catch (err) {
    logger.error('adminTogglePickedUp error', err);
    return res.internalError();
  }
};
