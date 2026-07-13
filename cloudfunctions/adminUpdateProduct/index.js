const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const res = require('./response');
const logger = require('./logger');
const auth = require('./auth');
const oplog = require('./operationLog');

exports.main = async (event) => {
  try {
    const authResult = await auth.requireRole('manager');
    if (!authResult.authorized) return authResult.response;

    const { productId, name, category, price, unit, stock, status, description, image } = event;

    if (!productId) {
      return res.badRequest('缺少产品ID');
    }
    if (typeof productId !== 'string') return res.badRequest('参数格式错误');

    const data = { updatedAt: db.serverDate() };
    if (name !== undefined) data.name = name.trim();
    if (category !== undefined) data.category = category;
    if (price !== undefined) data.price = Math.round(parseFloat(price) * 100);
    if (unit !== undefined) data.unit = unit;
    if (stock !== undefined) data.stock = parseInt(stock) || 0;
    if (description !== undefined) data.description = description;
    if (image !== undefined) data.image = image;
    if (status !== undefined) {
      const VALID_STATUS = ['sufficient', 'low', 'out'];
      if (!VALID_STATUS.includes(status)) return res.badRequest('无效的产品状态');
      data.status = status;
    }

    await db.collection('products').doc(productId).update({ data });
    logger.info('Product updated', { productId });
    await oplog.logOperation(db, authResult.admin.username, 'product.update', productId, '编辑产品');
    return res.ok();
  } catch (err) {
    logger.error('adminUpdateProduct error', err);
    return res.internalError();
  }
};
