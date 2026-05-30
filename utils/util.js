/**
 * 格式化价格
 */
function formatPrice(price) {
  return '¥' + (price / 100).toFixed(2);
}

/**
 * 格式化日期
 */
function formatDate(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

/**
 * 验证手机号
 */
function isValidPhone(phone) {
  return /^1[3-9]\d{9}$/.test(phone);
}

/**
 * 订单状态映射
 */
const orderStatusMap = {
  processing: '处理中',
  completed: '已完成',
  cancelled: '已取消'
};

function getOrderStatusText(status) {
  return orderStatusMap[status] || '未知';
}

/**
 * 退换货状态映射
 */
const returnStatusMap = {
  pending: '待处理',
  approved: '已通过',
  rejected: '已拒绝',
  completed: '已完成'
};

function getReturnStatusText(status) {
  return returnStatusMap[status] || '未知';
}

/**
 * 拿货方式映射
 */
const deliveryMethodMap = {
  pickup: '自取',
  delivery: '配送',
  logistics: '物流'
};

function getDeliveryMethodText(method) {
  return deliveryMethodMap[method] || '配送';
}

module.exports = {
  formatPrice,
  formatDate,
  isValidPhone,
  getOrderStatusText,
  getReturnStatusText,
  getDeliveryMethodText
};
