const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  if (!wxContext.OPENID) return { code: -1, msg: '未登录' };
  const admin = await db.collection('admins').where({ lastLoginOpenid: wxContext.OPENID, loggedIn: true }).get();
  if (admin.data.length === 0) return { code: -1, msg: '无管理员权限' };

  const { name, category, price, unit, stock, description, image } = event;

  if (!name || !category || price === undefined || !unit) {
    return { code: -1, msg: '缺少必填字段' };
  }

  try {
    const data = {
      name: name.trim(),
      category,
      price: Math.round(parseFloat(price) * 100),
      unit,
      stock: parseInt(stock) || 0,
      description: description || '',
      image: image || '',
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    };

    const res = await db.collection('products').add({ data });
    return { code: 0, data: { _id: res._id } };
  } catch (err) {
    return { code: -1, msg: err.message };
  }
};
