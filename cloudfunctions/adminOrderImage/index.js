const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const { verifyAdmin } = require('../lib/auth');

exports.main = async (event) => {
  const auth = await verifyAdmin();
  if (auth.error) return auth.error;

  const { orderId, fileID } = event;
  if (!orderId || !fileID) return { code: -1, msg: '参数不完整' };

  try {
    const imageData = { fileID, uploadedAt: new Date() };
    await db.collection('orders').doc(orderId).update({
      data: { images: db.command.push([imageData]) }
    });
    return { code: 0, data: imageData };
  } catch (err) {
    return { code: -1, msg: err.message };
  }
};
