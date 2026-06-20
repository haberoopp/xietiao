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
// 模板 ID 配置 —— 7 个真实模板（字段名按微信后台实际类型）
// ============================================================
const TEMPLATES = {
  // 客户侧
  ORDER_STATUS_CHANGE: 'vcuCn2dNTkgg6Xf-P3xqYvXYLJJgtSqf_hhO7wRqiE0',  // thing1+name2+amount6+thing8
  PAYMENT_CHANGE:      'vcuCn2dNTkgg6Xf-P3xqYtrKc9DgUcN3g7LmZirw4Kw',  // thing1+name2+amount6
  RETURN_RESULT:       'tlxN0JZIJyzJQbYrZZ5XTQMGorYXll2rBhRkRqgwBFg',  // character_string1+thing2
  // 管理侧
  NEW_ORDER_ADMIN:     'XGD06qwAdw5mN9Nxu9NMkv0ywwtEluVnoRIb5hxIGGk',  // character_string1+thing12+amount2+thing14
  ORDER_STATUS_ADMIN:  'vcuCn2dNTkgg6Xf-P3xqYsQHCNH7oyZmYfbUzGn-d0Q',  // character_string4+name2+amount6+thing8
  ORDER_CANCEL_ADMIN:  'XGD06qwAdw5mN9Nxu9NMkvNS4DskjFB6njCzhuTziQA',  // character_string1+thing12+thing8
  RETURN_ADMIN:        'tlxN0JZIJyzJQbYrZZ5XTS8lL882gPR5wwMgSxE8iGQ',  // thing2+character_string1+thing5
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
    console.log('[notify] send ok: template=' + templateId + ' to=' + toUser.substring(0, 8) + '...');
    return { success: true };
  } catch (err) {
    console.warn('[notify] send failed: template=' + templateId + ' errCode=' + (err.errCode || '?') + ' errMsg=' + (err.errMsg || err.message));
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
    // 客户侧订单状态变更: thing1客户信息 | name2订单状态 | amount6订单金额 | thing8通知详情
    templateId = TEMPLATES.ORDER_STATUS_CHANGE;
    data = {
      thing1:  { value: truncate(order.customerName || '客户') },
      name2: { value: STATUS_MAP[order.status] || order.status },
      amount6: { value: formatMoney(order.totalAmount) },
      thing8:  { value: truncate('订单状态已更新为' + (STATUS_MAP[order.status] || order.status)) }
    };
  } else if (type === 'PAYMENT_CHANGE') {
    // 客户侧付款状态变更: thing1客户信息 | name2订单状态 | amount6订单金额
    templateId = TEMPLATES.PAYMENT_CHANGE;
    var paidText = order.payment_status === 'paid' ? '打款成功' : '待打款';
    var payAmount = order.payment_status === 'paid' ? (order.paid_amount || order.totalAmount) : order.totalAmount;
    data = {
      thing1:  { value: truncate(order.customerName || '客户') },
      name2: { value: paidText },
      amount6: { value: formatMoney(payAmount) }
    };
  } else if (type === 'RETURN_RESULT') {
    // 客户侧退货状态通知: character_string1订单编码 | thing2退货商品
    templateId = TEMPLATES.RETURN_RESULT;
    var resultMap = { approved: '已通过', rejected: '已拒绝', completed: '已完成' };
    var returnLabel = extra.returnType === 'exchange' ? '换货' : '退货';
    data = {
      character_string1: { value: shortId(extra.requestId || order._id) },
      thing2: { value: truncate(returnLabel + (resultMap[extra.result] || String(extra.result))) }
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
    // 新订单通知: character_string1订单编号 | thing12客户姓名 | amount2订单金额 | thing14订单需求
    return {
      character_string1: { value: shortId(order._id) },
      thing12: { value: truncate(order.customerName || '') },
      amount2: { value: formatMoney(order.totalAmount) },
      thing14: { value: itemsSummary(order.items) }
    };
  }
  if (type === 'STATUS_CHANGE') {
    // 订单状态变更: character_string4订单号 | name2订单状态 | amount6订单金额 | thing8通知详情
    var statusText = STATUS_MAP[order.status] || order.status;
    return {
      character_string4: { value: shortId(order._id) },
      name2: { value: statusText },
      amount6: { value: formatMoney(order.totalAmount) },
      thing8: { value: truncate(order.customerName || '') }
    };
  }
  if (type === 'ORDER_CANCELLED') {
    // 订单取消通知: character_string1订单编号 | thing12客户姓名 | thing8订单商品
    return {
      character_string1: { value: shortId(order._id) },
      thing12: { value: truncate(order.customerName || '') },
      thing8: { value: itemsSummary(order.items) }
    };
  }
  if (type === 'RETURN') {
    // 退货申请审核通知: thing2退货商品 | character_string1订单编码 | thing5审核说明
    var returnResultMap = { approved: '已通过', rejected: '已拒绝', completed: '已完成' };
    var returnLabel = extra.returnType === 'exchange' ? '换货' : '退货';
    return {
      thing2: { value: truncate(returnLabel + '申请') },
      character_string1: { value: shortId(extra.requestId || order._id) },
      thing5: { value: truncate(returnResultMap[extra.result] || '') + '：' + truncate(order.customerName || '') }
    };
  }
  return { character_string1: { value: shortId(order._id) } };
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
