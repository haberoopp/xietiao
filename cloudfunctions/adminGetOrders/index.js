const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const res = require('./response');
const logger = require('./logger');
const auth = require('./auth');

exports.main = async (event) => {
  const authResult = await auth.requireRole('manager');
  if (!authResult.authorized) return authResult.response;

  const { status, page = 1, pageSize = 50 } = event;
  const where = {};

  if (status) {
    where.status = status;
  }

  try {
    const total = await db.collection('orders').where(where).count();
    const list = await db.collection('orders')
      .where(where)
      .orderBy('createdAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    logger.info('adminGetOrders', { status, page });
    return res.list(list.data, total.total);
  } catch (err) {
    logger.error('adminGetOrders', err, { status, page });
    return res.internalError();
  }
};
