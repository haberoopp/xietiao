const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const res = require('./response');
const logger = require('./logger');
const auth = require('./auth');
const notify = require('./notify');

exports.main = async (event) => {
  const { customerName, phone, address, items, totalAmount, remark, deliveryMethod, location } = event;

  if (!customerName || !phone || !address || !items || items.length === 0) {
    return res.badRequest('请填写完整信息并选择商品');
  }

  try {
    const authResult = await auth.requireOpenid();
    if (!authResult.authorized) return authResult.response;
    const openid = authResult.openid;

    const order = {
      _openid: openid,
      customerName,
      phone,
      address,
      items,
      totalAmount,
      deliveryMethod: deliveryMethod || 'delivery',
      logisticsCompany: deliveryMethod === 'logistics' ? (event.logisticsCompany || '').trim() : '',
      remark: remark || '',
      status: 'processing',
      payment_status: 'unpaid',
      paid_amount: 0,
      pickedUp: false,
      createdAt: db.serverDate()
    };
    if (location) order.location = location;

    const result = await db.collection('orders').add({ data: order });
    const orderId = result._id;
    logger.info('submitOrder', { orderId, customerName });

    // 通知所有订阅管理员：新订单
    try {
      const notifyResult = await notify.sendToAdmins(db, 'NEW_ORDER', { _id: orderId, customerName, totalAmount, items }, {});
      logger.info('notify NEW_ORDER result', { orderId, ...notifyResult });
    } catch (e) {
      logger.warn('notify NEW_ORDER failed', { orderId, error: e.message });
    }

    return res.record({ orderId });
  } catch (err) {
    logger.error('submitOrder', err, { customerName, phone });
    return res.internalError();
  }
};
