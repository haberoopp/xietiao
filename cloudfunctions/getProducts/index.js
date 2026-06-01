const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

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
    const total = await db.collection('products').where(where).count();
    const list = await db.collection('products')
      .where(where)
      .orderBy('createdAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    // 计算每个产品近7天销量
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const productIds = list.data.map(p => p._id);

    if (productIds.length > 0) {
      const ordersRes = await db.collection('orders')
        .where({
          status: _.neq('cancelled'),
          createdAt: _.gte(sevenDaysAgo)
        })
        .field({ items: true })
        .get();

      const salesMap = {};
      ordersRes.data.forEach(order => {
        (order.items || []).forEach(item => {
          if (item.productId && productIds.includes(item.productId)) {
            salesMap[item.productId] = (salesMap[item.productId] || 0) + (item.price || 0) * (item.quantity || 0);
          }
        });
      });

      list.data.forEach(p => {
        p.recent_sales = salesMap[p._id] || 0;
      });
    }

    return { code: 0, data: { list: list.data, total: total.total } };
  } catch (err) {
    return { code: -1, msg: err.message };
  }
};
