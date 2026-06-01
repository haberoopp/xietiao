const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { customerName, phone, address, items, totalAmount, remark, deliveryMethod, location } = event;

  if (!customerName || !phone || !address || !items || items.length === 0) {
    return { code: -1, msg: '请填写完整信息并选择商品' };
  }

  try {
    const order = {
      customerName,
      phone,
      address,
      items,
      totalAmount,
      deliveryMethod: deliveryMethod || 'delivery',
      remark: remark || '',
      status: 'processing',
      pickedUp: false,
      createdAt: db.serverDate()
    };
    if (location) order.location = location;

    const result = await db.collection('orders').add({ data: order });
    return { code: 0, data: { orderId: result._id } };
  } catch (err) {
    return { code: -1, msg: err.message };
  }
};
