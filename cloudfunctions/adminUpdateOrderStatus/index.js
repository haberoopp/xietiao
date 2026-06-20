const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const res = require('./response');
const logger = require('./logger');
const auth = require('./auth');
const notify = require('./notify');

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
    // 先读取旧状态用于通知
    const oldOrder = await db.collection('orders').doc(orderId).get();

    await db.collection('orders').doc(orderId).update({
      data: { status, updatedAt: db.serverDate() }
    });
    logger.info('adminUpdateOrderStatus', { orderId, status });

    // 发送通知
    const order = { ...oldOrder.data, status };
    try {
      const customerResult = await notify.sendToCustomer(db, order, 'STATUS_CHANGE', { oldStatus: oldOrder.data.status });
      logger.info('notify customer STATUS_CHANGE result', { orderId, ...customerResult });
    } catch (e) {
      logger.warn('notify customer STATUS_CHANGE failed', { orderId, error: e.message });
    }
    try {
      const adminResult = await notify.sendToAdmins(db, 'STATUS_CHANGE', order, {});
      logger.info('notify admin STATUS_CHANGE result', { orderId, ...adminResult });
    } catch (e) {
      logger.warn('notify admin STATUS_CHANGE failed', { orderId, error: e.message });
    }

    return res.ok();
  } catch (err) {
    logger.error('adminUpdateOrderStatus', err, { orderId, status });
    return res.internalError();
  }
};
