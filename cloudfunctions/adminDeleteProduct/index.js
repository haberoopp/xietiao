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

    const { productId } = event;

    if (!productId) {
      return res.badRequest('缺少产品ID');
    }

    await db.collection('products').doc(productId).remove();
    logger.info('Product deleted', { productId });
    await oplog.logOperation(db, authResult.admin.username, 'product.delete', productId, `删除产品`);
    return res.ok();
  } catch (err) {
    logger.error('adminDeleteProduct error', err);
    return res.internalError();
  }
};
