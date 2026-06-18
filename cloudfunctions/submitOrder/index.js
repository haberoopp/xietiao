const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const res = require('./response');
const logger = require('./logger');
const auth = require('./auth');

exports.main = async (event) => {
  const { customerName, phone, address, items, totalAmount, remark, deliveryMethod, location } = event;

  if (!customerName || !phone || !address || !items || items.length === 0) {
    return res.badRequest('请填写完整信息并选择商品');
  }

  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;

    const order = {
      _openid: openid,
      customerName,
      phone,
      address,
      items,
      totalAmount,
      deliveryMethod: deliveryMethod || 'delivery',
      remark: remark || '',
      status: 'processing',
      payment_status: 'unpaid',
      paid_amount: 0,
      pickedUp: false,
      createdAt: db.serverDate()
    };
    if (location) order.location = location;

    const result = await db.collection('orders').add({ data: order });
    logger.info('submitOrder', { orderId: result._id, customerName });
    return res.record({ orderId: result._id });
  } catch (err) {
    logger.error('submitOrder', err, { customerName, phone });
    return res.internalError();
  }
};
