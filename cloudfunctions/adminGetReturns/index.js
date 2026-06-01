const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const { verifyAdmin } = require('../lib/auth');

exports.main = async (event) => {
  const auth = await verifyAdmin();
  if (auth.error) return auth.error;

  const { status } = event;
  const where = {};
  if (status) where.status = status;

  try {
    const list = await db.collection('returnRequests')
      .where(where)
      .orderBy('createdAt', 'desc')
      .get();

    // 关联订单信息
    const enriched = [];
    for (const req of list.data) {
      try {
        const order = await db.collection('orders').doc(req.orderId).get();
        enriched.push({
          ...req,
          orderInfo: order.data || null
        });
      } catch (e) {
        enriched.push({ ...req, orderInfo: null });
      }
    }

    return { code: 0, data: enriched };
  } catch (err) {
    return { code: -1, msg: err.message };
  }
};
