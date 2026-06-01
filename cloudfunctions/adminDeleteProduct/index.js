const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const { verifyAdmin } = require('../lib/auth');

exports.main = async (event) => {
  const auth = await verifyAdmin();
  if (auth.error) return auth.error;

  const { productId } = event;

  if (!productId) {
    return { code: -1, msg: '缺少产品ID' };
  }

  try {
    await db.collection('products').doc(productId).remove();
    return { code: 0 };
  } catch (err) {
    return { code: -1, msg: err.message };
  }
};
