const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  if (!wxContext.OPENID) return { code: -1, msg: '未登录' };
  const admin = await db.collection('admins').where({ lastLoginOpenid: wxContext.OPENID, loggedIn: true }).get();
  if (admin.data.length === 0) return { code: -1, msg: '无管理员权限' };

  const { productId, name, category, price, unit, stock, description, image } = event;

  if (!productId) {
    return { code: -1, msg: '缺少产品ID' };
  }

  try {
    const data = { updatedAt: db.serverDate() };
    if (name !== undefined) data.name = name.trim();
    if (category !== undefined) data.category = category;
    if (price !== undefined) data.price = Math.round(parseFloat(price) * 100);
    if (unit !== undefined) data.unit = unit;
    if (stock !== undefined) data.stock = parseInt(stock) || 0;
    if (description !== undefined) data.description = description;
    if (image !== undefined) data.image = image;

    await db.collection('products').doc(productId).update({ data });
    return { code: 0 };
  } catch (err) {
    return { code: -1, msg: err.message };
  }
};
