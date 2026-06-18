const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const res = require('./response');
const logger = require('./logger');
const auth = require('./auth');

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { page = 1, pageSize = 100 } = event || {};

  try {
    const [countRes, listRes] = await Promise.all([
      db.collection('orders').where({ _openid: openid }).count(),
      db.collection('orders')
        .where({ _openid: openid })
        .orderBy('createdAt', 'desc')
        .skip((page - 1) * pageSize)
        .limit(Math.min(pageSize, 100))
        .get()
    ]);

    logger.info('getMyOrders', { openid, page, total: countRes.total });
    return res.list(listRes.data, countRes.total);
  } catch (err) {
    logger.error('getMyOrders', err, { openid, page });
    return res.internalError();
  }
};
