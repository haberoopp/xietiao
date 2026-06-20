const util = require('../../utils/util');
const demoStore = require('../../utils/demoStore');

Page({
  data: {
    avatarUrl: '',
    customerName: '未设置',
    isFirstTime: false,
    pendingCount: 0,
    completedCount: 0,
    totalOrderCount: 0,
    showNameEdit: false,
    editNameValue: ''
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
    this.loadCustomerInfo();
    this.loadOrderCounts();
  },

  loadCustomerInfo() {
    const name = wx.getStorageSync('customerName') || '';
    const avatarUrl = wx.getStorageSync('customerAvatar') || '';
    const app = getApp();
    // 标记是否首次（没有设置过头像和名称）
    const isFirstTime = !name && !avatarUrl;
    this.setData({
      customerName: name || '未设置',
      avatarUrl,
      isFirstTime
    });
  },

  async loadOrderCounts() {
    const app = getApp();

    if (app.globalData.demoMode) {
      const orders = demoStore.getAll(demoStore.KEYS.orders);
      const pendingCount = orders.filter(o => o.status === 'processing').length;
      const completedCount = orders.filter(o => o.status === 'completed').length;
      this.setData({
        pendingCount,
        completedCount,
        totalOrderCount: orders.length
      });
      return;
    }

    try {
      const res = await wx.cloud.callFunction({
        name: 'getMyOrders',
        data: { page: 1, pageSize: 1 }
      });
      if (res.result.code === 0) {
        const total = res.result.data.total || 0;
        // 拉全部订单来统计状态（数量不大时可行）
        if (total > 0 && total <= 500) {
          const fullRes = await wx.cloud.callFunction({
            name: 'getMyOrders',
            data: { page: 1, pageSize: 500 }
          });
          if (fullRes.result.code === 0) {
            const orders = fullRes.result.data.list || [];
            this.setData({
              pendingCount: orders.filter(o => o.status === 'processing').length,
              completedCount: orders.filter(o => o.status === 'completed').length,
              totalOrderCount: total
            });
            return;
          }
        }
        this.setData({ totalOrderCount: total });
      }
    } catch (err) {
      // 静默失败，保持计数为 0
    }
  },

  // 微信头像选择
  onChooseAvatar(e) {
    const avatarUrl = e.detail.avatarUrl;
    if (avatarUrl) {
      wx.setStorageSync('customerAvatar', avatarUrl);
      this.setData({ avatarUrl, isFirstTime: false });
      this.syncProfileToCloud({ avatarUrl });
    }
  },

  // 微信昵称输入（微信会自动填充昵称）
  onNicknameBlur(e) {
    const name = (e.detail.value || '').trim();
    if (name) {
      wx.setStorageSync('customerName', name);
      this.setData({ customerName: name, isFirstTime: false });
      this.syncProfileToCloud({ name });
    }
  },

  // 同步头像/名称到云端 customers 表
  syncProfileToCloud(updates) {
    const app = getApp();
    if (!app.globalData.openid) return; // 未登录成功，仅存本地
    try {
      wx.cloud.callFunction({
        name: 'customerCRUD',
        data: { action: 'updateProfile', ...updates }
      }).catch(() => {});
    } catch (_) {}
  },

  // 点击编辑名称
  onEditName() {
    this.setData({
      showNameEdit: true,
      editNameValue: this.data.customerName === '未设置' ? '' : this.data.customerName
    });
  },

  onNameInput(e) {
    this.setData({ editNameValue: e.detail.value });
  },

  onCancelEditName() {
    this.setData({ showNameEdit: false });
  },

  onConfirmEditName() {
    const name = this.data.editNameValue.trim();
    if (!name) {
      wx.showToast({ title: '请输入名称', icon: 'none' });
      return;
    }
    wx.setStorageSync('customerName', name);
    this.setData({
      customerName: name,
      showNameEdit: false,
      isFirstTime: false
    });
    this.syncProfileToCloud({ name });
    wx.showToast({ title: '已保存', icon: 'success' });
  },

  // 点击订单状态入口
  onTapOrders(e) {
    const { status } = e.currentTarget.dataset;
    wx.navigateTo({ url: '/pages/orders/orders?status=' + status });
  },

  // 对账单
  onTapBill() {
    wx.navigateTo({ url: '/pages/orders/orders?showBill=1' });
  },

  // 收货地址
  onTapAddress() {
    wx.navigateTo({ url: '/pages/address/address' });
  },

  // 商家管理
  onTapAdmin() {
    const app = getApp();
    if (app.globalData.adminLoggedIn || wx.getStorageSync('adminLoggedIn')) {
      wx.navigateTo({ url: '/pages/admin/orders/orders' });
    } else {
      wx.navigateTo({ url: '/pages/admin/login/login' });
    }
  }
});
