const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { action, categories } = event;
  const openid = cloud.getWXContext().OPENID;
  if (!openid) return { code: -1, msg: '未登录' };

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
      return { code: 0 };
    }

    if (action === 'unsubscribe') {
      await db.collection('adminSubscriptions').where({ _openid: openid }).update({
        data: { subscribed: false, updatedAt: db.serverDate() }
      });
      return { code: 0 };
    }

    return { code: -1, msg: '未知操作' };
  } catch (err) {
    return { code: -1, msg: err.message };
  }
};
