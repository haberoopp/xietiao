const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const res = require('./response');
const logger = require('./logger');
const auth = require('./auth');
const notify = require('./notify');
const oplog = require('./operationLog');

exports.main = async (event) => {
  const authResult = await auth.requireRole('manager');
  if (!authResult.authorized) return authResult.response;

  const { orderId, status, payment_status } = event;

  // 支持两种操作：改订单状态 或 改付款状态
  const isPaymentUpdate = payment_status !== undefined;
  const isStatusUpdate = status !== undefined;

  if (!orderId || (!isStatusUpdate && !isPaymentUpdate)) {
    return res.badRequest('参数错误');
  }

  if (isStatusUpdate) {
    const validStatus = ['processing', 'completed', 'cancelled'];
    if (!validStatus.includes(status)) {
      return res.badRequest('无效的状态值');
    }
  }

  if (isPaymentUpdate) {
    const validPayment = ['paid', 'unpaid'];
    if (!validPayment.includes(payment_status)) {
      return res.badRequest('无效的付款状态');
    }
  }

  try {
    // 先读取旧数据用于通知
    const oldOrder = await db.collection('orders').doc(orderId).get();
    if (!oldOrder.data) {
      return res.notFound('订单不存在');
    }

    const updateData = { updatedAt: db.serverDate() };
    let logAction = 'order.updateStatus';
    let logDetail = '';

    if (isStatusUpdate) {
      updateData.status = status;
      logDetail = `修改订单状态为${status}`;
      logger.info('adminUpdateOrderStatus', { orderId, status });
    }

    if (isPaymentUpdate) {
      updateData.payment_status = payment_status;
      updateData.paid_amount = payment_status === 'paid' ? (oldOrder.data.totalAmount || 0) : 0;
      if (!isStatusUpdate) {
        logAction = 'order.payment';
        logDetail = payment_status === 'paid' ? '标记已付' : '取消已付标记';
      } else {
        logDetail += '；' + (payment_status === 'paid' ? '标记已付' : '取消已付标记');
      }
      logger.info('adminUpdateOrderStatus payment', { orderId, payment_status });
    }

    await db.collection('orders').doc(orderId).update({ data: updateData });

    // 审计日志
    try {
      await oplog.logOperation(db, authResult.admin.username, logAction, orderId, logDetail);
    } catch (e) { /* 审计日志失败不阻塞主流程 */ }

    // 发送通知（仅状态变更时发送）
    if (isStatusUpdate) {
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
    }

    // 付款状态变更也发送通知
    if (isPaymentUpdate) {
      const order = { ...oldOrder.data, payment_status, paid_amount: updateData.paid_amount };
      try {
        const customerResult = await notify.sendToCustomer(db, order, 'PAYMENT_CHANGE', {});
        logger.info('notify customer PAYMENT_CHANGE result', { orderId, ...customerResult });
      } catch (e) {
        logger.warn('notify customer PAYMENT_CHANGE failed', { orderId, error: e.message });
      }
    }

    return res.ok();
  } catch (err) {
    logger.error('adminUpdateOrderStatus', err, { orderId, status, payment_status });
    return res.internalError();
  }
};
