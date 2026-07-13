const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const res = require('./response');
const logger = require('./logger');
const auth = require('./auth');
const oplog = require('./operationLog');

exports.main = async (event) => {
  try {
    const authResult = await auth.requireRole('manager');
    if (!authResult.authorized) return authResult.response;

    const { orderId, imageIndex } = event;
    if (!orderId || imageIndex === undefined) return res.badRequest('参数错误');

    const order = await db.collection('orders').doc(orderId).get();
    if (!order.data) return res.notFound('订单不存在');

    const images = order.data.images || [];
    if (imageIndex < 0 || imageIndex >= images.length) {
      return res.badRequest('图片索引无效');
    }

    const removed = images[imageIndex];
    // 尝试删除云存储文件
    if (removed.fileID && removed.fileID.startsWith('cloud://')) {
      try {
        await cloud.deleteFile({ fileList: [removed.fileID] });
      } catch (e) {
        // 文件可能已不存在，忽略
      }
    }

    images.splice(imageIndex, 1);
    await db.collection('orders').doc(orderId).update({
      data: { images, updatedAt: db.serverDate() }
    });
    logger.info('Order image deleted', { orderId, imageIndex });
    await oplog.logOperation(db, authResult.admin.username, 'order.deleteImage', orderId, `删除订单图片`);
    return res.ok();
  } catch (err) {
    logger.error('adminDeleteOrderImage error', err);
    return res.internalError();
  }
};
