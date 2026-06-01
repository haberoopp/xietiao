const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  if (!wxContext.OPENID) return { code: -1, msg: '未登录' };
  const admin = await db.collection('admins').where({ lastLoginOpenid: wxContext.OPENID, loggedIn: true }).get();
  if (admin.data.length === 0) return { code: -1, msg: '无管理员权限' };

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
