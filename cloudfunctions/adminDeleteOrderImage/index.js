const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  if (!wxContext.OPENID) return { code: -1, msg: '未登录' };
  const admin = await db.collection('admins').where({ lastLoginOpenid: wxContext.OPENID, loggedIn: true }).get();
  if (admin.data.length === 0) return { code: -1, msg: '无管理员权限' };

  const { orderId, imageIndex } = event;
  if (!orderId || imageIndex === undefined) return { code: -1, msg: '参数错误' };

  try {
    const order = await db.collection('orders').doc(orderId).get();
    if (!order.data) return { code: -1, msg: '订单不存在' };

    const images = order.data.images || [];
    if (imageIndex < 0 || imageIndex >= images.length) {
      return { code: -1, msg: '图片索引无效' };
    }

    const removed = images[imageIndex];
    // 尝试删除云存储文件
    if (removed.fileID && removed.fileID.startsWith('cloud://')) {
      try {
        await cloud.deleteFile({ fileList: [removed.fileID] });
      } catch (e) {
        // 文件可能已不存在，忽略
      }
    }

    images.splice(imageIndex, 1);
    await db.collection('orders').doc(orderId).update({
      data: { images, updatedAt: db.serverDate() }
    });
    return { code: 0 };
  } catch (err) {
    return { code: -1, msg: err.message };
  }
};
