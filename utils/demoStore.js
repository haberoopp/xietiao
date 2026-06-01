/**
 * Demo 模式统一数据存储
 * 单一数据源：wx.getStorageSync。不再使用 app.globalData 的副本。
 */

const mock = require('./mock');

const KEYS = {
  orders: 'demo_orders',
  products: 'demo_products',
  customers: 'demo_customers',
  addresses: 'demo_addresses',
  returnRequests: 'demo_return_requests'
};

function initAll() {
  if (!wx.getStorageSync(KEYS.orders)) {
    wx.setStorageSync(KEYS.orders, JSON.parse(JSON.stringify(mock.mockOrders)));
  }
  if (!wx.getStorageSync(KEYS.products)) {
    wx.setStorageSync(KEYS.products, JSON.parse(JSON.stringify(mock.mockProducts)));
  }
  if (!wx.getStorageSync(KEYS.customers)) {
    wx.setStorageSync(KEYS.customers, JSON.parse(JSON.stringify(mock.mockCustomers)));
  }
  if (!wx.getStorageSync(KEYS.addresses)) {
    wx.setStorageSync(KEYS.addresses, []);
  }
  if (!wx.getStorageSync(KEYS.returnRequests)) {
    wx.setStorageSync(KEYS.returnRequests, []);
  }
}

function getAll(key) {
  return wx.getStorageSync(key) || [];
}

function setAll(key, data) {
  wx.setStorageSync(key, data);
}

/**
 * 更新 demo 数据（原子化：读取→修改→写回）
 * @param {string} key - KEYS 中的 key
 * @param {Function} updater - 接收当前数组，返回修改后的数组
 * @returns {Array} 更新后的数组
 */
function update(key, updater) {
  const current = getAll(key);
  const updated = updater(current);
  setAll(key, updated);
  // 同步更新 globalData（兼容过渡期，让旧代码不中断）
  const app = getApp();
  if (app && app.globalData) {
    if (key === KEYS.orders) app.globalData.demoOrders = updated;
    if (key === KEYS.products) app.globalData.demoProducts = updated;
    if (key === KEYS.customers) app.globalData.demoCustomers = updated;
  }
  return updated;
}

module.exports = {
  KEYS,
  initAll,
  getAll,
  setAll,
  update
};
