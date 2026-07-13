const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const res = require('./response');
const logger = require('./logger');
const auth = require('./auth');

exports.main = async (event) => {
  try {
    const authResult = await auth.requireRole('manager');
    if (!authResult.authorized) return authResult.response;

    const { orderId, fileID } = event;
    if (!orderId || !fileID) return res.badRequest('参数不完整');

    const imageData = { fileID, uploadedAt: db.serverDate() };
    await db.collection('orders').doc(orderId).update({
      data: { images: db.command.push([imageData]) }
    });
    logger.info('Order image added', { orderId, fileID });
    return res.record(imageData);
  } catch (err) {
    logger.error('adminOrderImage error', err);
    return res.internalError();
  }
};
