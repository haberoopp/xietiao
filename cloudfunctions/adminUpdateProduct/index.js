const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const res = require('./response');
const logger = require('./logger');
const auth = require('./auth');

exports.main = async (event) => {
  try {
    const authResult = await auth.requireAdmin();
    if (!authResult.authorized) return authResult.response;

    const { productId, name, category, price, unit, stock, description, image } = event;

    if (!productId) {
      return res.badRequest('缺少产品ID');
    }

    const data = { updatedAt: db.serverDate() };
    if (name !== undefined) data.name = name.trim();
    if (category !== undefined) data.category = category;
    if (price !== undefined) data.price = Math.round(parseFloat(price) * 100);
    if (unit !== undefined) data.unit = unit;
    if (stock !== undefined) data.stock = parseInt(stock) || 0;
    if (description !== undefined) data.description = description;
    if (image !== undefined) data.image = image;

    await db.collection('products').doc(productId).update({ data });
    logger.info('Product updated', { productId });
    return res.ok();
  } catch (err) {
    logger.error('adminUpdateProduct error', err);
    return res.internalError();
  }
};
