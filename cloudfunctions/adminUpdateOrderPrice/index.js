const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  if (!wxContext.OPENID) return { code: -1, msg: '未登录' };
  const admin = await db.collection('admins').where({ lastLoginOpenid: wxContext.OPENID, loggedIn: true }).get();
  if (admin.data.length === 0) return { code: -1, msg: '无管理员权限' };

  const { orderId, totalAmount } = event;

  if (!orderId || totalAmount === undefined || totalAmount < 0) {
    return { code: -1, msg: '参数错误' };
  }

  try {
    await db.collection('orders').doc(orderId).update({
      data: {
        totalAmount: Math.round(totalAmount),
        updatedAt: db.serverDate()
      }
    });
    return { code: 0 };
  } catch (err) {
    return { code: -1, msg: err.message };
  }
};
