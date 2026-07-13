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

    const { orderId, pickedUp } = event;
    if (!orderId) return res.badRequest('参数错误');
    if (typeof orderId !== 'string') return res.badRequest('参数格式错误');

    // 若客户端已传 pickedUp 值，直接写入（省一次 DB 读取）
    if (typeof pickedUp === 'boolean') {
      await db.collection('orders').doc(orderId).update({
        data: { pickedUp, updatedAt: db.serverDate() }
      });
      logger.info('Order pickup set', { orderId, pickedUp });
      await oplog.logOperation(db, authResult.admin.username, 'order.togglePickedUp', orderId, pickedUp ? '标记已提货' : '取消提货标记');
      return res.ok();
    }

    // 兼容旧版：读取后取反
    const order = await db.collection('orders').doc(orderId).get();
    if (!order.data) return res.notFound('订单不存在');

    const current = order.data.pickedUp || false;
    await db.collection('orders').doc(orderId).update({
      data: { pickedUp: !current, updatedAt: db.serverDate() }
    });
    logger.info('Order pickup toggled', { orderId, pickedUp: !current });
    await oplog.logOperation(db, authResult.admin.username, 'order.togglePickedUp', orderId, !current ? '标记已提货' : '取消提货标记');
    return res.record({ pickedUp: !current });
  } catch (err) {
    logger.error('adminTogglePickedUp error', err);
    return res.internalError();
  }
};
