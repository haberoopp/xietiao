const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const res = require('./response');
const logger = require('./logger');
const auth = require('./auth');
const oplog = require('./operationLog');

exports.main = async (event) => {
  const authResult = await auth.requireRole('manager');
  if (!authResult.authorized) return authResult.response;

  const orderId = event.orderId;
  // 兼容前端传参名 newTotal（小程序端）和 totalAmount（Web端）
  const amount = event.newTotal !== undefined ? event.newTotal : event.totalAmount;

  if (!orderId || amount === undefined || amount === null || typeof amount !== 'number' || isNaN(amount) || amount < 0) {
    return res.badRequest('参数错误');
  }

  try {
    const newAmount = Math.round(amount);
    await db.collection('orders').doc(orderId).update({
      data: {
        totalAmount: newAmount,
        updatedAt: db.serverDate()
      }
    });

    // 联动更新 payment_status：如果已付 >= 新总额则 paid，否则 unpaid
    const updatedOrder = await db.collection('orders').doc(orderId).get();
    const newPaymentStatus = (updatedOrder.data.paid_amount || 0) >= newAmount ? 'paid' : 'unpaid';
    if (updatedOrder.data.payment_status !== newPaymentStatus) {
      await db.collection('orders').doc(orderId).update({
        data: { payment_status: newPaymentStatus, updatedAt: db.serverDate() }
      });
      logger.info('adminUpdateOrderPrice sync payment_status', {
        orderId, oldStatus: updatedOrder.data.payment_status, newStatus: newPaymentStatus
      });
    }

    logger.info('adminUpdateOrderPrice', { orderId, totalAmount: newAmount });
    await oplog.logOperation(db, authResult.admin.username, 'order.updatePrice', orderId, `修改订单金额为${(newAmount / 100).toFixed(2)}元`);
    return res.ok();
  } catch (err) {
    logger.error('adminUpdateOrderPrice', err, { orderId, amount });
    return res.internalError();
  }
};
