const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const res = require('./response');
const logger = require('./logger');
const auth = require('./auth');

exports.main = async () => {
  try {
    const authResult = await auth.requireAdmin();
    if (!authResult.authorized) return authResult.response;

    const openid = cloud.getWXContext().OPENID;
    // 批量清除该 openid 下所有管理员的登录态
    const result = await db.collection('admins')
      .where({ lastLoginOpenid: openid, loggedIn: true })
      .update({ data: { loggedIn: false, updatedAt: db.serverDate() } });
    logger.info('Admin logged out', { clearedCount: result.stats?.updated || 0 });
    return res.ok();
  } catch (err) {
    logger.error('adminLogout error', err);
    return res.internalError();
  }
};
