const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const res = require('./response');
const logger = require('./logger');
const auth = require('./auth');

exports.main = async (event) => {
  const { category, keyword, page = 1, pageSize = 20 } = event;
  const where = {};

  if (category) {
    where.category = category;
  }
  if (keyword) {
    where.name = db.RegExp({ regexp: keyword, options: 'i' });
  }

  try {
    const [totalRes, listRes] = await Promise.all([
      db.collection('products').where(where).count(),
      db.collection('products')
        .where(where)
        .orderBy('createdAt', 'desc')
        .skip((page - 1) * pageSize)
        .limit(Math.min(pageSize, 100))
        .get()
    ]);

    logger.info('getProducts', { category, keyword, page, total: totalRes.total });
    return res.list(listRes.data, totalRes.total);
  } catch (err) {
    logger.error('getProducts', err, { category, keyword, page });
    return res.internalError();
  }
};
