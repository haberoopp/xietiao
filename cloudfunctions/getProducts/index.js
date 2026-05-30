const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { category, keyword, page = 1, pageSize = 20 } = event;
  const _ = db.command;
  const where = {};

  if (category) {
    where.category = category;
  }
  if (keyword) {
    where.name = db.RegExp({ regexp: keyword, options: 'i' });
  }

  try {
    const total = await db.collection('products').where(where).count();
    const list = await db.collection('products')
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
