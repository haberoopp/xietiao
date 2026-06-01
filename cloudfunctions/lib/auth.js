const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

/**
 * 验证调用者是否为已登录管理员，返回管理员信息或错误
 */
async function verifyAdmin() {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  if (!openid) {
    return { error: { code: -1, msg: '未登录' } };
  }

  try {
    const result = await db.collection('admins')
      .where({ lastLoginOpenid: openid, loggedIn: true })
      .get();

    if (result.data.length === 0) {
      return { error: { code: -1, msg: '无管理员权限' } };
    }

    return { admin: result.data[0] };
  } catch (err) {
    return { error: { code: -1, msg: '鉴权失败: ' + err.message } };
  }
}

module.exports = { verifyAdmin };
