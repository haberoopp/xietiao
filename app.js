const mock = require('./utils/mock');

App({
  onLaunch: function () {
    this.initCloud();
    this.initCart();
  },

  initCloud() {
    const envId = 'cloudbase-d3gutw6xz1d7cef25';

    if (!wx.cloud) {
      console.warn('云开发不可用，使用演示模式');
      this.loadMockData();
      return;
    }

    try {
      wx.cloud.init({ env: envId, traceUser: true });
      console.log('云开发 SDK 已初始化（演示模式运行中）');
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
    cart: [],
    adminLoggedIn: false,
    adminRole: '',
    adminNickname: '',
    demoMode: false,
    demoProducts: [],
    demoOrders: [],
    exchangeMode: false,
    exchangeDraft: null,
    exchangeCart: null
  }
});
