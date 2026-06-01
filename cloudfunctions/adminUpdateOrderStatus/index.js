const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const { createVerifyAdmin } = require('./auth');
const verifyAdmin = createVerifyAdmin(db);

// 安全加载 notify 模块
var notify;
try { notify = require('./notify'); } catch(e) { notify = null; }

exports.main = async (event) => {
  const auth = await verifyAdmin();
  if (auth.error) return auth.error;

  const { orderId, status, payment_status, paid_amount } = event;

  if (!orderId) {
    return { code: -1, msg: '参数错误' };
  }

  try {
    // 先查旧订单，用于通知判断
    const oldOrder = await db.collection('orders').doc(orderId).get();
    if (!oldOrder.data) return { code: -1, msg: '订单不存在' };
    const oldStatus = oldOrder.data.status;
    const oldPayment = oldOrder.data.payment_status;

    const data = { updatedAt: db.serverDate() };

    if (status !== undefined) {
      const validStatus = ['processing', 'completed', 'cancelled'];
      if (!validStatus.includes(status)) {
        return { code: -1, msg: '无效的订单状态' };
      }
      data.status = status;
    }

    if (payment_status !== undefined) {
      const validPayment = ['paid', 'unpaid'];
      if (!validPayment.includes(payment_status)) {
        return { code: -1, msg: '无效的付款状态' };
      }
      data.payment_status = payment_status;
      if (payment_status === 'paid') {
        data.paid_amount = paid_amount !== undefined ? paid_amount : (oldOrder.data.totalAmount || 0);
      } else {
        data.paid_amount = 0;
      }
    }

    await db.collection('orders').doc(orderId).update({ data });

    // 通知（fire-and-forget）
    const updatedOrder = { ...oldOrder.data, ...data };

    if (notify) {
      if (status !== undefined && status !== oldStatus) {
        notify.sendToCustomer(db, updatedOrder, 'STATUS_CHANGE', { oldStatus }).catch(function() {});
        notify.sendToAdmins(db, 'STATUS_CHANGE', updatedOrder, { oldStatus }).catch(function() {});
      }
      if (payment_status !== undefined && payment_status !== oldPayment) {
        notify.sendToCustomer(db, updatedOrder, 'PAYMENT_CHANGE', {}).catch(function() {});
      }
    }

    return { code: 0 };
  } catch (err) {
    return { code: -1, msg: err.message };
  }
};
