/**
 * WeChat 订阅消息通知辅助模块
 *
 * 部署前将此文件复制到每个需要发通知的云函数目录中。
 *
 * Usage:
 *   const notify = require('./notify');
 *   await notify.sendToCustomer(db, order, 'STATUS_CHANGE', { oldStatus: 'processing' });
 *   await notify.sendToAdmins(db, 'NEW_ORDER', order, {});
 */

// ============================================================
// 模板 ID 配置 —— 7 个真实模板
// ============================================================
const TEMPLATES = {
  // 客户侧
  ORDER_STATUS_CHANGE: 'vcuCn2dNTkgg6Xf-P3xqYvXYLJJgtSqf_hhO7wRqiE0',  // thing1+phrase2+amount3+thing4
  PAYMENT_CHANGE:      'vcuCn2dNTkgg6Xf-P3xqYtrKc9DgUcN3g7LmZirw4Kw',  // thing1+phrase2+amount3
  RETURN_RESULT:       'tlxN0JZIJyzJQbYrZZ5XTQMGorYXll2rBhRkRqgwBFg',  // thing1+phrase2
  // 管理侧
  NEW_ORDER_ADMIN:     'XGD06qwAdw5mN9Nxu9NMkv0ywwtEluVnoRIb5hxIGGk',  // thing1+thing2+amount3
  ORDER_STATUS_ADMIN:  'vcuCn2dNTkgg6Xf-P3xqYsQHCNH7oyZmYfbUzGn-d0Q',  // thing1+phrase2+amount3+thing4
  ORDER_CANCEL_ADMIN:  'XGD06qwAdw5mN9Nxu9NMkvNS4DskjFB6njCzhuTziQA',  // thing1+thing2+thing3
  RETURN_ADMIN:        'tlxN0JZIJyzJQbYrZZ5XTS8lL882gPR5wwMgSxE8iGQ',  // thing1+thing2+thing3
};

var MAX_LEN = 20;

function truncate(str, max) {
  max = max || MAX_LEN;
  if (!str) return '';
  var s = String(str);
  return s.length > max ? s.substring(0, max - 1) + '…' : s;
}

function formatMoney(cents) {
  return ((cents || 0) / 100).toFixed(2) + '元';
}

function shortId(id) {
  id = id || '';
  return id.substring(Math.max(0, id.length - 8));
}

function itemsSummary(items) {
  if (!items || !items.length) return '';
  var names = items.map(function(i) { return i.name + '×' + i.quantity + (i.unit || ''); }).join('、');
  return truncate(names);
}

var STATUS_MAP = { processing: '处理中', completed: '已完成', cancelled: '已取消' };

// -----------------------------------------------------------
// 发送原语
// -----------------------------------------------------------
async function sendOne(templateId, toUser, page, data) {
  try {
    var cloud = require('wx-server-sdk');
    await cloud.openapi.subscribeMessage.send({
      touser: toUser,
      templateId: templateId,
      page: page,
      data: data,
      miniprogramState: 'formal'
    });
    return { success: true };
  } catch (err) {
    console.warn('[notify] send failed: errCode=' + (err.errCode || '?') + ' ' + err.message);
    return { success: false, errCode: err.errCode, error: err.message };
  }
}

// -----------------------------------------------------------
// 客户通知
// -----------------------------------------------------------
async function sendToCustomer(db, order, type, extra) {
  var openid = order._openid;
  if (!openid) return { success: false, error: 'missing _openid' };

  var templateId, data;

  if (type === 'STATUS_CHANGE') {
    // 模板1: thing1订单编号 | phrase2订单状态 | amount3订单金额 | thing4备注
    templateId = TEMPLATES.ORDER_STATUS_CHANGE;
    data = {
      thing1:  { value: shortId(order._id) },
      phrase2: { value: STATUS_MAP[order.status] || order.status },
      amount3: { value: formatMoney(order.totalAmount) },
      thing4:  { value: truncate('状态更新：' + (STATUS_MAP[order.status] || order.status)) }
    };
  } else if (type === 'PAYMENT_CHANGE') {
    // 模板2: thing1打款编号 | phrase2打款状态 | amount3打款金额
    templateId = TEMPLATES.PAYMENT_CHANGE;
    var paidText = order.payment_status === 'paid' ? '打款成功' : '待打款';
    var payAmount = order.payment_status === 'paid' ? (order.paid_amount || order.totalAmount) : order.totalAmount;
    data = {
      thing1:  { value: shortId(order._id) },
      phrase2: { value: paidText },
      amount3: { value: formatMoney(payAmount) }
    };
  } else if (type === 'RETURN_RESULT') {
    // 模板3: thing1退货单号 | phrase2退货状态 (仅2字段)
    templateId = TEMPLATES.RETURN_RESULT;
    var resultMap = { approved: '已通过', rejected: '已拒绝', completed: '已完成' };
    var returnLabel = extra.returnType === 'exchange' ? '换货' : '退货';
    data = {
      thing1:  { value: shortId(extra.requestId || order._id) },
      phrase2: { value: truncate(returnLabel + resultMap[extra.result] || String(extra.result), 5) }
    };
  } else {
    return { success: false, error: 'unknown type: ' + type };
  }

  return await sendOne(templateId, openid, 'pages/orders/orders', data);
}

// -----------------------------------------------------------
// 管理员通知（发给所有已订阅管理员）
// -----------------------------------------------------------
async function sendToAdmins(db, type, order, extra) {
  var templateId;
  if (type === 'NEW_ORDER')          templateId = TEMPLATES.NEW_ORDER_ADMIN;
  else if (type === 'STATUS_CHANGE') templateId = TEMPLATES.ORDER_STATUS_ADMIN;
  else if (type === 'ORDER_CANCELLED') templateId = TEMPLATES.ORDER_CANCEL_ADMIN;
  else if (type === 'RETURN')        templateId = TEMPLATES.RETURN_ADMIN;
  else return { success: false, error: 'unknown type: ' + type };

  var subscribers = await getSubscribers(db);
  if (subscribers.length === 0) return { success: true, sent: 0, note: 'no subscribers' };

  var data = buildAdminData(order, type, extra);
  var page = 'pages/admin/orders/orders';

  var sent = 0;
  for (var i = 0; i < subscribers.length; i++) {
    var r = await sendOne(templateId, subscribers[i]._openid, page, data);
    if (r.success) sent++;
  }
  return { success: true, sent: sent, total: subscribers.length };
}

function buildAdminData(order, type, extra) {
  if (type === 'NEW_ORDER') {
    // 模板4: thing1订单号 | thing2客户名称 | amount3订单金额
    return {
      thing1:  { value: shortId(order._id) },
      thing2:  { value: truncate(order.customerName || '') },
      amount3: { value: formatMoney(order.totalAmount) }
    };
  }
  if (type === 'STATUS_CHANGE') {
    // 模板5: thing1订单号 | phrase2订单状态 | amount3订单金额 | thing4备注
    var statusText = STATUS_MAP[order.status] || order.status;
    return {
      thing1:  { value: shortId(order._id) },
      phrase2: { value: statusText },
      amount3: { value: formatMoney(order.totalAmount) },
      thing4:  { value: truncate(order.customerName || '') }
    };
  }
  if (type === 'ORDER_CANCELLED') {
    // 模板6: thing1订单号 | thing2客户名称 | thing3订单内容
    return {
      thing1: { value: shortId(order._id) },
      thing2: { value: truncate(order.customerName || '') },
      thing3: { value: itemsSummary(order.items) }
    };
  }
  if (type === 'RETURN') {
    // 模板7: thing1项目名称 | thing2退货单号 | thing3退货内容
    var returnResultMap = { approved: '已通过', rejected: '已拒绝', completed: '已完成' };
    var returnLabel = extra.returnType === 'exchange' ? '换货' : '退货';
    return {
      thing1: { value: truncate(returnLabel + '申请处理') },
      thing2: { value: shortId(extra.requestId || order._id) },
      thing3: { value: truncate(returnResultMap[extra.result] + '：' + (order.customerName || '')) }
    };
  }
  return { thing1: { value: shortId(order._id) } };
}

// -----------------------------------------------------------
// 订阅者管理
// -----------------------------------------------------------
async function getSubscribers(db) {
  try {
    var r = await db.collection('adminSubscriptions')
      .where({ subscribed: true })
      .get();
    return r.data || [];
  } catch (e) {
    console.warn('[notify] getSubscribers error:', e.message);
    return [];
  }
}

module.exports = {
  sendToCustomer: sendToCustomer,
  sendToAdmins: sendToAdmins,
  sendOne: sendOne,
  getSubscribers: getSubscribers,
  TEMPLATES: TEMPLATES
};
