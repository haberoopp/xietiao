const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const res = require('./response');
const logger = require('./logger');
const auth = require('./auth');

exports.main = async (event) => {
  const { action, categories } = event;
  const authResult = await auth.requireOpenid();
  const openid = authResult.openid;

  try {
    if (action === 'subscribe') {
      // 删除旧记录后重新插入
      try {
        await db.collection('adminSubscriptions').where({ _openid: openid }).remove();
      } catch (e) { /* 忽略：集合可能尚不存在 */ }

      await db.collection('adminSubscriptions').add({
        data: {
          _openid: openid,
          subscribed: true,
          categories: categories || [],
          createdAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
      });
      logger.info('Admin subscribed', { openid, categories });
      return res.ok();
    }

    if (action === 'unsubscribe') {
      await db.collection('adminSubscriptions').where({ _openid: openid }).update({
        data: { subscribed: false, updatedAt: db.serverDate() }
      });
      logger.info('Admin unsubscribed', { openid });
      return res.ok();
    }

    return res.badRequest('未知操作');
  } catch (err) {
    logger.error('subscribeAdmin error', { error: err.message, action: event.action, openid });
    return res.internalError();
  }
};
