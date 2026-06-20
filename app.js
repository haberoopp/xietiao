const mock = require('./utils/mock');

App({
  onLaunch: function () {
    this.initCloud();
    this.initCart();
    this.initErrorListener();
    this.wxLogin();
  },

  // 微信登录：获取 openid 并同步用户资料
  async wxLogin() {
    try {
      if (!wx.cloud) return;
      const res = await wx.cloud.callFunction({ name: 'login' });
      if (res.result && res.result.code === 0) {
        const { isNew, openid, profile } = res.result.data;
        this.globalData.openid = openid;
        this.globalData.isNewUser = isNew;
        // 如果云端有存档的头像/名称，同步到本地
        if (profile) {
          if (profile.name && !wx.getStorageSync('customerName')) {
            wx.setStorageSync('customerName', profile.name);
          }
          if (profile.avatarUrl && !wx.getStorageSync('customerAvatar')) {
            wx.setStorageSync('customerAvatar', profile.avatarUrl);
          }
        }
        console.log(isNew ? '新用户注册成功' : '欢迎回来', openid);
      }
    } catch (err) {
      console.warn('微信登录失败，使用本地缓存', err.message);
    }
  },

  initErrorListener() {
    wx.onError((err) => {
      console.error('[全局错误]', err);
      // 记录到本地存储方便排查
      const logs = wx.getStorageSync('_error_logs') || [];
      logs.push({ time: new Date().toISOString(), msg: String(err).slice(0, 500) });
      if (logs.length > 50) logs.splice(0, logs.length - 50);
      wx.setStorageSync('_error_logs', logs);
    });
    // 未处理的 Promise 拒绝
    wx.onUnhandledRejection && wx.onUnhandledRejection((res) => {
      console.error('[未捕获Promise拒绝]', res.reason);
    });
  },

  initCloud() {
    const envId = 'cloudbase-d6g98vaoyb7ec331a';

    if (!wx.cloud) {
      console.warn('云开发不可用，使用演示模式');
      this.loadMockData();
      return;
    }

    try {
      wx.cloud.init({ env: envId, traceUser: true });
      console.log('云开发 SDK 已初始化，正在检测云平台连通性...');

      // 探活：快速检测云平台是否可用
      const probeTimeout = new Promise((resolve) =>
        setTimeout(() => resolve({ timedOut: true }), 8000)
      );
      const probeCall = wx.cloud.callFunction({
        name: 'getProducts',
        data: { page: 1, pageSize: 1 }
      });

      Promise.race([probeCall, probeTimeout]).then((res) => {
        if (res && res.timedOut) {
          console.error('❌ 云平台超时 — 可能是平台故障，已切换到演示模式');
          this.globalData.demoMode = true;
          this.loadMockData();
        } else if (res && res.result && res.result.code === 0) {
          console.log('✅ 云平台连接正常，使用云开发模式');
          this.globalData.demoMode = false;
          this.globalData.cloudReady = true;
          // 通知当前页面刷新，切换到云数据
          const pages = getCurrentPages();
          const currentPage = pages[pages.length - 1];
          if (currentPage && currentPage.loadProducts) {
            currentPage.loadProducts();
          }
        } else {
          const detail = res && res.result ? JSON.stringify(res.result) : String(res);
          console.warn('⚠️ 云平台返回异常，使用演示模式\n详情:', detail);
          this.globalData.demoMode = true;
          this.loadMockData();
        }
      }).catch((err) => {
        console.error('❌ 云平台连接失败，使用演示模式', err);
        this.globalData.demoMode = true;
        this.loadMockData();
      });
    } catch (e) {
      this.globalData.demoMode = true;
      this.loadMockData();
      console.warn('云开发初始化失败，使用演示模式');
    }
  },

  loadMockData() {
    const demoStore = require('./utils/demoStore');
    demoStore.initAll();
    // 保留 globalData 引用以兼容旧代码（逐步迁移后可移除）
    this.globalData.demoProducts = demoStore.getAll(demoStore.KEYS.products);
    this.globalData.demoOrders = demoStore.getAll(demoStore.KEYS.orders);
  },

  initCart() {
    const cart = wx.getStorageSync('cart');
    if (cart && cart.length > 0) {
      this.globalData.cart = cart;
    }
  },

  globalData: {
    openid: '',
    isNewUser: false,
    cart: [],
    adminLoggedIn: false,
    adminRole: '',
    adminNickname: '',
    demoMode: true,
    demoProducts: [],
    demoOrders: [],
    exchangeMode: false,
    exchangeDraft: null,
    exchangeCart: null,
    cloudReady: false
  }
});
