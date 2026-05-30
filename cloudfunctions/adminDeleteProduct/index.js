const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  if (!wxContext.OPENID) return { code: -1, msg: '未登录' };
  const admin = await db.collection('admins').where({ lastLoginOpenid: wxContext.OPENID, loggedIn: true }).get();
  if (admin.data.length === 0) return { code: -1, msg: '无管理员权限' };

  const { productId } = event;

  if (!productId) {
    return { code: -1, msg: '缺少产品ID' };
  }

  try {
    await db.collection('products').doc(productId).remove();
    return { code: 0 };
  } catch (err) {
    return { code: -1, msg: err.message };
  }
};
