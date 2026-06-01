const mock = require('../../../utils/mock');

Page({
  data: {
    username: '',
    password: ''
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 });
    }
    // 已登录直接进后台，不用重复登录
    if (getApp().globalData.adminLoggedIn || wx.getStorageSync('adminLoggedIn')) {
      wx.redirectTo({ url: '/pages/admin/orders/orders' });
    }
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [field]: e.detail.value });
  },

  async onLogin() {
    const { username, password } = this.data;

    if (!username.trim() || !password.trim()) {
      wx.showToast({ title: '请输入账号和密码', icon: 'none' });
      return;
    }

    const app = getApp();

    if (app.globalData.demoMode) {
      const demoAccounts = mock.demoAdminAccounts;

      const u = username.trim();
      const p = password.trim();
      const matched = Object.values(demoAccounts).find(a => a.username === u && a.password === p);

      if (matched) {
        this.loginSuccess(matched);
      } else {
        wx.showToast({ title: '账号或密码错误', icon: 'none', duration: 2500 });
      }
      return;
    }

    wx.showLoading({ title: '登录中...' });

    try {
      const res = await wx.cloud.callFunction({
        name: 'adminLogin',
        data: { username: username.trim(), password: password.trim() }
      });
      wx.hideLoading();
      if (res.result.code === 0) {
        this.loginSuccess(res.result.data);
      } else {
        wx.showToast({ title: res.result.msg || '登录失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '网络错误', icon: 'none' });
    }
  },

  loginSuccess(admin) {
    const app = getApp();
    app.globalData.adminLoggedIn = true;
    app.globalData.adminRole = admin.role;
    app.globalData.adminNickname = admin.nickname || admin.username;
    wx.setStorageSync('adminLoggedIn', true);
    wx.setStorageSync('adminRole', admin.role);
    wx.setStorageSync('adminNickname', admin.nickname || admin.username);
    wx.showToast({ title: '登录成功', icon: 'success' });
    setTimeout(() => wx.redirectTo({ url: '/pages/admin/orders/orders' }), 800);
  }
});
