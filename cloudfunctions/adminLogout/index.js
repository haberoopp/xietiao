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
    const admin = await db.collection('admins').where({ lastLoginOpenid: openid, loggedIn: true }).get();
    if (admin.data.length > 0) {
      await db.collection('admins').doc(admin.data[0]._id).update({
        data: { loggedIn: false, updatedAt: db.serverDate() }
      });
    }
    logger.info('Admin logged out');
    return res.ok();
  } catch (err) {
    logger.error('adminLogout error', err);
    return res.internalError();
  }
};
