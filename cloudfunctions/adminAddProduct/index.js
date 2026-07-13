const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const res = require('./response');
const logger = require('./logger');
const auth = require('./auth');
const oplog = require('./operationLog');

exports.main = async (event) => {
  const authResult = await auth.requireRole('manager');
  if (!authResult.authorized) return authResult.response;

  const { name, category, price, unit, stock, status, description, image } = event;

  if (!name || !category || price === undefined || !unit) {
    return res.badRequest('缺少必填字段');
  }

  try {
    const VALID_STATUS = ['sufficient', 'low', 'out'];
    const data = {
      name: name.trim(),
      category,
      price: Math.round(parseFloat(price) * 100),
      unit,
      stock: parseInt(stock) || 0,
      status: VALID_STATUS.includes(status) ? status : 'sufficient',
      description: description || '',
      image: image || '',
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    };

    const result = await db.collection('products').add({ data });
    logger.info('adminAddProduct', { name, category });
    await oplog.logOperation(db, authResult.admin.username, 'product.create', name, `新增产品「${name}」`);
    return res.record({ _id: result._id });
  } catch (err) {
    logger.error('adminAddProduct', err, { name, category });
    return res.internalError();
  }
};
