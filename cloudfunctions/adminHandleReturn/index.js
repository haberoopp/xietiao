const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const { verifyAdmin } = require('../lib/auth');

exports.main = async (event) => {
  const auth = await verifyAdmin();
  if (auth.error) return auth.error;

  const { requestId, action } = event;

  if (!requestId || !action) return { code: -1, msg: '参数错误' };
  if (!['approve', 'reject', 'complete'].includes(action)) {
    return { code: -1, msg: '无效操作' };
  }

  try {
    const req = await db.collection('returnRequests').doc(requestId).get();
    if (!req.data) return { code: -1, msg: '申请不存在' };

    const newStatus = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'completed';

    const reqUpdate = { status: newStatus, updatedAt: db.serverDate() };
    if (action === 'reject') {
      reqUpdate.rejectionCount = (req.data.rejectionCount || 0) + 1;
    }
    await db.collection('returnRequests').doc(requestId).update({ data: reqUpdate });

    const orderUpdate = {
      'returnRequest.status': newStatus,
      updatedAt: db.serverDate()
    };
    if (action === 'reject') {
      orderUpdate['returnRequest.rejectionCount'] = reqUpdate.rejectionCount;
    }
    if (action === 'approve') {
      orderUpdate.status = 'processing';
      // 读取当前订单金额和折扣，避免 inc 导致负数
      const order = await db.collection('orders').doc(req.data.orderId).get();
      const currentAmount = order.data.totalAmount || 0;
      const discount = order.data.discount || 1.0;
      if (req.data.type === 'return') {
        orderUpdate.pickedUp = db.command.remove();
        if (req.data.items && req.data.items.length > 0) {
          const refund = req.data.items.reduce((s, i) => s + Math.round((i.price || 0) * discount) * (i.quantity || 0), 0);
          orderUpdate.totalAmount = Math.max(0, currentAmount - refund);
        }
      } else if (req.data.type === 'exchange') {
        orderUpdate.pickedUp = false;
        // 换货：退回金额 - 换购金额（均应用折扣）
        const returnAmount = (req.data.items || []).reduce((s, i) => s + Math.round((i.price || 0) * discount) * (i.quantity || 0), 0);
        const exchangeAmount = (req.data.exchangeItems || []).reduce((s, i) => s + Math.round((i.price || 0) * discount) * (i.quantity || 0), 0);
        const diff = exchangeAmount - returnAmount;
        orderUpdate.totalAmount = Math.max(0, currentAmount + diff);
      }
    }

    await db.collection('orders').doc(req.data.orderId).update({
      data: orderUpdate
    });

    return { code: 0 };
  } catch (err) {
    return { code: -1, msg: err.message };
  }
};
