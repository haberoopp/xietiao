const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async () => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  try {
    const list = await db.collection('orders')
      .where({ _openid: openid })
      .orderBy('createdAt', 'desc')
      .get();

    return { code: 0, data: list.data };
  } catch (err) {
    return { code: -1, msg: err.message };
  }
};
