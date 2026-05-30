const mock = require('./utils/mock');

App({
  onLaunch: function () {
    this.initCloud();
    this.initCart();
  },

  initCloud() {
    const envId = 'your-env-id';

    // 先加载演示数据兜底，避免首页首次加载空白
    this.loadMockData();

    if (!wx.cloud) {
      console.warn('云开发不可用，使用演示模式');
      return;
    }

    try {
      wx.cloud.init({ env: envId, traceUser: true });
      // 尝试调用云函数检测是否已配置
      wx.cloud.callFunction({ name: 'getProducts', data: { pageSize: 1 } })
        .then(res => {
          if (res.result && res.result.code === 0) {
            this.globalData.demoMode = false;
            console.log('云开发已连接');
          }
        })
        .catch(() => {
          this.globalData.demoMode = true;
          console.log('云函数未部署，使用演示模式');
        });
    } catch (e) {
      this.globalData.demoMode = true;
      console.warn('云开发初始化失败，使用演示模式');
    }
  },

  loadMockData() {
    this.globalData.demoProducts = mock.mockProducts;
    this.globalData.demoOrders = mock.mockOrders;
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
