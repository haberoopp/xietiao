const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const { createVerifyAdmin } = require('./auth');
const verifyAdmin = createVerifyAdmin(db);

exports.main = async (event) => {
  const auth = await verifyAdmin();
  if (auth.error) return auth.error;

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

    return { code: 0, data: { list: list.data, total: total.total } };
  } catch (err) {
    return { code: -1, msg: err.message };
  }
};
