const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const res = require('./response');
const logger = require('./logger');
const auth = require('./auth');

exports.main = async (event) => {
  const { orderId, customerName, phone, address, addressDetail, items, totalAmount, deliveryMethod, remark, images, location } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  if (!orderId) {
    return res.badRequest('缺少订单ID');
  }

  try {
    const order = await db.collection('orders').doc(orderId).get();
    if (!order.data) return res.notFound('订单不存在');
    if (order.data._openid !== openid) return res.forbidden('无权操作');

    const data = { updatedAt: db.serverDate() };
    if (customerName !== undefined) data.customerName = customerName.trim();
    if (phone !== undefined) data.phone = phone.trim();
    if (address !== undefined) data.address = address.trim();
    if (addressDetail !== undefined) data.addressDetail = addressDetail.trim();
    if (items !== undefined) data.items = items;
    if (totalAmount !== undefined) data.totalAmount = totalAmount;
    if (deliveryMethod !== undefined) data.deliveryMethod = deliveryMethod;
    if (remark !== undefined) data.remark = remark;
    if (images !== undefined) data.images = images;
    if (location !== undefined) data.location = location;

    await db.collection('orders').doc(orderId).update({ data });
    logger.info('updateOrder', { orderId, openid });
    return res.ok();
  } catch (err) {
    logger.error('updateOrder', err, { orderId, openid });
    return res.internalError();
  }
};
