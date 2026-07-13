const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const res = require('./response');
const logger = require('./logger');
const auth = require('./auth');
const _ = db.command;

exports.main = async (event) => {
  const authResult = await auth.requireRole('manager');
  if (!authResult.authorized) return authResult.response;

  const { status, page = 1, pageSize = 50 } = event;
  const where = {};
  if (status) where.status = status;

  try {
    const [countRes, listRes] = await Promise.all([
      db.collection('returnRequests').where(where).count(),
      db.collection('returnRequests')
        .where(where)
        .orderBy('createdAt', 'desc')
        .skip((page - 1) * pageSize)
        .limit(Math.min(pageSize, 200))
        .get()
    ]);

    // 批量查关联订单（一次查询替代 N+1）
    const orderIds = [...new Set(listRes.data.map(r => r.orderId).filter(Boolean))];
    let orderMap = {};
    if (orderIds.length > 0) {
      try {
        const orderRes = await db.collection('orders')
          .where({ _id: _.in(orderIds) })
          .get();
        (orderRes.data || []).forEach(o => { orderMap[o._id] = o; });
      } catch (e) {
        logger.warn('adminGetReturns batch order lookup failed', { error: e.message });
      }
    }

    const enriched = listRes.data.map(req => ({
      ...req,
      orderInfo: orderMap[req.orderId] || null
    }));

    logger.info('adminGetReturns', { status, page });
    return res.list(enriched, countRes.total);
  } catch (err) {
    logger.error('adminGetReturns', err, { status, page });
    return res.internalError();
  }
};
