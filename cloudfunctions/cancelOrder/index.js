/**
 * 取消订单
 *
 * 参考实现 — 展示标准的分层架构:
 *   接口层: exports.main → 调度校验/鉴权/业务
 *   校验层: validate        → 参数检查
 *   鉴权层: auth            → 身份验证（共享模块）
 *   业务层: doCancelOrder   → 业务规则 + 数据访问
 *   响应层: res             → 统一返回格式（共享模块）
 *   日志层: logger          → 结构化日志（共享模块）
 */

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const res = require('./response');
const logger = require('./logger');
const auth = require('./auth');
const notify = require('./notify');

// ============================================================
// 接口层
// ============================================================
exports.main = async (event) => {
  try {
    // 1. 参数校验
    const v = validate(event);
    if (!v.valid) return res.badRequest(v.error);

    // 2. 权限校验（使用共享鉴权模块）
    const authResult = await auth.requireOpenid();
    if (!authResult.authorized) return authResult.response;

    // 3. 业务逻辑
    const bizResult = await doCancelOrder(v.orderId, authResult.openid);
    if (!bizResult.success) {
      if (bizResult.error === '订单不存在') return res.notFound(bizResult.error);
      if (bizResult.error === '无权操作') return res.forbidden();
      return res.conflict(bizResult.error);
    }

    // 4. 发送通知
    const order = bizResult.order;
    try {
      const customerResult = await notify.sendToCustomer(db, order, 'STATUS_CHANGE', { oldStatus: order.oldStatus });
      logger.info('notify customer STATUS_CHANGE result', { orderId: v.orderId, ...customerResult });
    } catch (e) {
      logger.warn('notify customer STATUS_CHANGE failed', { orderId: v.orderId, error: e.message });
    }
    try {
      const adminResult = await notify.sendToAdmins(db, 'ORDER_CANCELLED', order, {});
      logger.info('notify ORDER_CANCELLED result', { orderId: v.orderId, ...adminResult });
    } catch (e) {
      logger.warn('notify ORDER_CANCELLED failed', { orderId: v.orderId, error: e.message });
    }

    // 5. 成功返回
    logger.info('orderCancelled', { orderId: v.orderId });
    return res.ok();
  } catch (err) {
    logger.error('cancelOrder', err, { orderId: event.orderId });
    return res.internalError();
  }
};

// ============================================================
// 校验层 — 只做字段检查，不查数据库
// ============================================================
function validate(event) {
  if (!event.orderId) {
    return { valid: false, error: '参数错误' };
  }
  return { valid: true, orderId: event.orderId };
}

// ============================================================
// 业务层 — 纯业务规则，不碰 event 和 wxContext
// ============================================================
async function doCancelOrder(orderId, openid) {
  const order = await db.collection('orders').doc(orderId).get();
  if (!order.data) {
    return { success: false, error: '订单不存在' };
  }
  if (order.data._openid !== openid) {
    return { success: false, error: '无权操作' };
  }

  // 业务规则
  if (order.data.status === 'completed') {
    return { success: false, error: '订单已完成，无法取消。如需退换货请申请退换货' };
  }
  if (order.data.status === 'cancelled') {
    return { success: false, error: '订单已取消' };
  }
  if (order.data.returnRequest) {
    return { success: false, error: '该订单已有退换货申请，无法取消' };
  }

  const oldStatus = order.data.status;

  await db.collection('orders').doc(orderId).update({
    data: { status: 'cancelled', updatedAt: db.serverDate() }
  });

  // 返回更新后的订单数据用于通知
  return {
    success: true,
    order: { ...order.data, status: 'cancelled', oldStatus }
  };
}
