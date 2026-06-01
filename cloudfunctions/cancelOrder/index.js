const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 安全加载 notify 模块
var notify;
try { notify = require('./notify'); } catch(e) { notify = null; }

exports.main = async (event) => {
  const { orderId } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  if (!orderId) return { code: -1, msg: '参数错误' };

  try {
    const order = await db.collection('orders').doc(orderId).get();
    if (!order.data) return { code: -1, msg: '订单不存在' };
    if (order.data._openid !== openid) return { code: -1, msg: '无权操作' };

    // 只有待处理和处理中的订单可以取消
    if (order.data.status === 'completed') {
      return { code: -1, msg: '订单已完成，无法取消。如需退换货请申请退换货' };
    }
    if (order.data.status === 'cancelled') {
      return { code: -1, msg: '订单已取消' };
    }
    if (order.data.returnRequest) {
      return { code: -1, msg: '该订单已有退换货申请，无法取消' };
    }

    await db.collection('orders').doc(orderId).update({
      data: { status: 'cancelled', updatedAt: db.serverDate() }
    });

    // 通知管理员（fire-and-forget）
    if (notify) {
      notify.sendToAdmins(db, 'ORDER_CANCELLED', { ...order.data, status: 'cancelled' }, {}).catch(function() {});
    }

    return { code: 0 };
  } catch (err) {
    return { code: -1, msg: err.message };
  }
};
