const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  if (!wxContext.OPENID) return { code: -1, msg: '未登录' };
  const admin = await db.collection('admins').where({ lastLoginOpenid: wxContext.OPENID, loggedIn: true }).get();
  if (admin.data.length === 0) return { code: -1, msg: '无管理员权限' };

  const { orderId } = event;
  if (!orderId) return { code: -1, msg: '参数错误' };

  try {
    const order = await db.collection('orders').doc(orderId).get();
    if (!order.data) return { code: -1, msg: '订单不存在' };

    const current = order.data.pickedUp || false;
    await db.collection('orders').doc(orderId).update({
      data: { pickedUp: !current, updatedAt: db.serverDate() }
    });
    return { code: 0, data: { pickedUp: !current } };
  } catch (err) {
    return { code: -1, msg: err.message };
  }
};
