Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/index/index', text: '主页', iconPath: '/images/tab_home.png', selectedIconPath: '/images/tab_home_active.png' },
      { pagePath: '/pages/cart/cart', text: '购物车', iconPath: '/images/tab_cart.png', selectedIconPath: '/images/tab_cart_active.png', badge: 0 },
      { pagePath: '/pages/my/my', text: '我的', iconPath: '/images/tab_my.png', selectedIconPath: '/images/tab_my_active.png' }
    ]
  },

  pageLifetimes: {
    show() {
      this.updateSelected();
      this.updateCartBadge();
    }
  },

  methods: {
    updateSelected() {
      const pages = getCurrentPages();
      if (pages.length === 0) return;
      const currentPath = '/' + pages[pages.length - 1].route;
      const idx = this.data.list.findIndex(t => t.pagePath === currentPath);
      if (idx >= 0) this.setData({ selected: idx });
    },

    updateCartBadge() {
      const app = getApp();
      const cart = app.globalData.cart || [];
      const count = cart.length; // 商品种类数量
      const list = this.data.list.map(item =>
        item.pagePath === '/pages/cart/cart' ? { ...item, badge: count } : item
      );
      this.setData({ list });
    },

    switchTab(e) {
      const idx = e.currentTarget.dataset.index;
      const tab = this.data.list[idx];
      const pages = getCurrentPages();
      const currentPath = '/' + pages[pages.length - 1].route;

      if (currentPath === tab.pagePath) return;

      wx.switchTab({ url: tab.pagePath });
    }
  }
});
