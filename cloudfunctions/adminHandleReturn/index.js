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

  const { requestId, action } = event;

  if (!requestId || !action) return res.badRequest('参数错误');
  if (typeof requestId !== 'string') return res.badRequest('参数格式错误');
  if (!['approve', 'reject', 'complete'].includes(action)) {
    return res.badRequest('无效操作');
  }

  try {
    const req = await db.collection('returnRequests').doc(requestId).get();
    if (!req.data) return res.notFound('申请不存在');

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
      // 读取订单获取原始价格（不信任退换货申请中的价格）
      const order = await db.collection('orders').doc(req.data.orderId).get();
      const currentAmount = order.data.totalAmount || 0;
      const discount = order.data.discount || 1.0;

      // 从原订单构建价格映射（防御纵深：以原订单价格为准）
      const orderItems = order.data.items || [];
      const orderPriceMap = {};
      orderItems.forEach(item => {
        if (item.productId) orderPriceMap[item.productId] = item;
      });

      if (req.data.type === 'return') {
        orderUpdate.pickedUp = db.command.remove();
        if (req.data.items && req.data.items.length > 0) {
          // 使用原订单价格计算退款，而非退换货申请中的价格
          const refund = req.data.items.reduce((s, item) => {
            const original = orderPriceMap[item.productId];
            const unitPrice = original ? original.price : (item.price || 0);
            const qty = Math.min(item.quantity || 0, original ? original.quantity || 0 : item.quantity || 0);
            return s + Math.round(unitPrice * discount) * qty;
          }, 0);
          orderUpdate.totalAmount = Math.max(0, currentAmount - refund);
        }
      } else if (req.data.type === 'exchange') {
        orderUpdate.pickedUp = false;
        // 换货：退回金额 - 换购金额（均以原订单价格为准）
        const returnAmount = (req.data.items || []).reduce((s, item) => {
          const original = orderPriceMap[item.productId];
          const unitPrice = original ? original.price : (item.price || 0);
          const qty = Math.min(item.quantity || 0, original ? original.quantity || 0 : item.quantity || 0);
          return s + Math.round(unitPrice * discount) * qty;
        }, 0);
        const exchangeAmount = (req.data.exchangeItems || []).reduce((s, item) => {
          const original = orderPriceMap[item.productId];
          const unitPrice = original ? original.price : (item.price || 0);
          const qty = Math.min(item.quantity || 0, original ? original.quantity || 0 : item.quantity || 0);
          return s + Math.round(unitPrice * discount) * qty;
        }, 0);
        const diff = exchangeAmount - returnAmount;
        orderUpdate.totalAmount = Math.max(0, currentAmount + diff);
      }
    }

    await db.collection('orders').doc(req.data.orderId).update({
      data: orderUpdate
    });

    logger.info('adminHandleReturn', { requestId, action });

    // 审计日志
    try {
      await oplog.logOperation(db, authResult.admin.username, 'return.handle', requestId, `${action === 'approve' ? '通过' : action === 'reject' ? '拒绝' : '完成'}退换货申请`);
    } catch (e) { /* 审计日志失败不阻塞主流程 */ }

    // 读取订单数据用于通知
    const orderDoc = await db.collection('orders').doc(req.data.orderId).get();
    if (orderDoc.data) {
      const order = orderDoc.data;
      // 通知客户退换货结果
      try {
        const customerResult = await notify.sendToCustomer(db, order, 'RETURN_RESULT', {
          requestId, result: newStatus, returnType: req.data.type
        });
        logger.info('notify customer RETURN_RESULT result', { requestId, ...customerResult });
      } catch (e) {
        logger.warn('notify customer RETURN_RESULT failed', { requestId, error: e.message });
      }
      // 通知管理员退换货处理
      try {
        const adminResult = await notify.sendToAdmins(db, 'RETURN', order, {
          requestId, result: newStatus, returnType: req.data.type
        });
        logger.info('notify admin RETURN result', { requestId, ...adminResult });
      } catch (e) {
        logger.warn('notify admin RETURN failed', { requestId, error: e.message });
      }
    }

    return res.ok();
  } catch (err) {
    logger.error('adminHandleReturn', err, { requestId, action });
    return res.internalError();
  }
};
