const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const { verifyAdmin } = require('../lib/auth');

exports.main = async (event) => {
  const auth = await verifyAdmin();
  if (auth.error) return auth.error;

  const { orderId, totalAmount } = event;

  if (!orderId || totalAmount === undefined || totalAmount < 0) {
    return { code: -1, msg: '参数错误' };
  }

  try {
    await db.collection('orders').doc(orderId).update({
      data: {
        totalAmount: Math.round(totalAmount),
        updatedAt: db.serverDate()
      }
    });
    return { code: 0 };
  } catch (err) {
    return { code: -1, msg: err.message };
  }
};
