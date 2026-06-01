const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  if (!wxContext.OPENID) return { code: -1, msg: '未登录' };
  const admin = await db.collection('admins').where({ lastLoginOpenid: wxContext.OPENID, loggedIn: true }).get();
  if (admin.data.length === 0) return { code: -1, msg: '无管理员权限' };

  const { orderId, fileID } = event;
  if (!orderId || !fileID) return { code: -1, msg: '参数不完整' };

  try {
    const imageData = { fileID, uploadedAt: new Date() };
    await db.collection('orders').doc(orderId).update({
      data: { images: db.command.push([imageData]) }
    });
    return { code: 0, data: imageData };
  } catch (err) {
    return { code: -1, msg: err.message };
  }
};
