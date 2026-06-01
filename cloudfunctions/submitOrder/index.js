const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 安全加载 notify 模块
var notify;
try { notify = require('./notify'); } catch(e) { notify = null; }

exports.main = async (event) => {
  const { customerName, phone, address, items, totalAmount, remark, deliveryMethod, location } = event;
  const wxContext = cloud.getWXContext();

  if (!customerName || !phone || !address || !items || items.length === 0) {
    return { code: -1, msg: '请填写完整信息并选择商品' };
  }

  try {
    const order = {
      _openid: wxContext.OPENID,
      customerName,
      phone,
      address,
      items,
      totalAmount,
      discount: event.discount || 1.0,
      deliveryMethod: deliveryMethod || 'delivery',
      remark: remark || '',
      payment_status: 'unpaid',
      paid_amount: 0,
      status: 'processing',
      pickedUp: false,
      createdAt: db.serverDate()
    };
    if (location) order.location = location;

    const result = await db.collection('orders').add({ data: order });

    // 通知管理员有新订单（fire-and-forget）
    if (notify) {
      notify.sendToAdmins(db, 'NEW_ORDER', {
        _id: result._id,
        customerName: order.customerName,
        totalAmount: order.totalAmount,
        items: order.items,
        createdAt: new Date()
      }, {}).catch(function() {});
    }

    return { code: 0, data: { orderId: result._id } };
  } catch (err) {
    return { code: -1, msg: err.message };
  }
};
