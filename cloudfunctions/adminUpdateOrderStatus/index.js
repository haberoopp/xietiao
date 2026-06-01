const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const { verifyAdmin } = require('../lib/auth');

exports.main = async (event) => {
  const auth = await verifyAdmin();
  if (auth.error) return auth.error;

  const { orderId, status } = event;

  if (!orderId || !status) {
    return { code: -1, msg: '参数错误' };
  }

  const validStatus = ['processing', 'completed', 'cancelled'];
  if (!validStatus.includes(status)) {
    return { code: -1, msg: '无效的状态值' };
  }

  try {
    await db.collection('orders').doc(orderId).update({
      data: { status, updatedAt: db.serverDate() }
    });
    return { code: 0 };
  } catch (err) {
    return { code: -1, msg: err.message };
  }
};
