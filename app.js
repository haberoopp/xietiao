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
      // 云环境已配置，默认走云端模式，失败时回退演示
      this.globalData.demoMode = false;
      console.log('云开发已连接');

      // 后台确认云函数可达性，不可达时回退演示模式
      wx.cloud.callFunction({ name: 'getProducts', data: { pageSize: 1 } })
        .then(res => {
          if (res.result && res.result.code === 0) {
            console.log('云函数连通验证通过');
          }
        })
        .catch(() => {
          this.globalData.demoMode = true;
          this.loadMockData();
          console.warn('云函数不可达，回退演示模式');
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
    cart: [],
    adminLoggedIn: false,
    adminRole: '',
    adminNickname: '',
    demoMode: true,
    demoProducts: [],
    demoOrders: [],
    exchangeMode: false,
    exchangeDraft: null,
    exchangeCart: null
  }
});
