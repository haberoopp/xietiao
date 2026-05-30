Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/index/index', text: '首页', icon: 'home', iconPath: 'home.png', selectedIconPath: 'home-active.png' },
      { pagePath: '/pages/address/address', text: '收货地址', icon: 'address', iconPath: 'location.png', selectedIconPath: 'location-active.png' },
      { pagePath: '/pages/orders/orders', text: '我的订单', icon: 'order', iconPath: 'order.png', selectedIconPath: 'order-active.png' }
    ],
    adminTab: { pagePath: '/pages/admin/login/login', text: '后台', icon: 'admin', iconPath: 'placeholder.png', selectedIconPath: 'placeholder.png' },
    showAdmin: false
  },

  attached() {
    this.checkAdmin();
  },

  pageLifetimes: {
    show() {
      this.checkAdmin();
      this.updateSelected();
    }
  },

  methods: {
    checkAdmin() {
      const app = getApp();
      const isAdmin = !!(app.globalData.adminLoggedIn || wx.getStorageSync('adminLoggedIn'));
      this.setData({ showAdmin: isAdmin });
    },

    updateSelected() {
      const pages = getCurrentPages();
      if (pages.length === 0) return;
      const currentPath = '/' + pages[pages.length - 1].route;
      const allTabs = this.getTabs();
      const idx = allTabs.findIndex(t => t.pagePath === currentPath);
      if (idx >= 0) this.setData({ selected: idx });
    },

    getTabs() {
      const tabs = [...this.data.list];
      if (this.data.showAdmin) tabs.push(this.data.adminTab);
      return tabs;
    },

    switchTab(e) {
      const idx = e.currentTarget.dataset.index;
      const tabs = this.getTabs();
      const tab = tabs[idx];
      const pages = getCurrentPages();
      const currentPath = '/' + pages[pages.length - 1].route;

      if (currentPath === tab.pagePath) return;

      // 后台tab：已登录走admin orders，未登录走login(switchTab)
      if (tab.text === '后台') {
        const app = getApp();
        if (app.globalData.adminLoggedIn || wx.getStorageSync('adminLoggedIn')) {
          wx.redirectTo({ url: '/pages/admin/orders/orders' });
        } else {
          wx.switchTab({ url: '/pages/admin/login/login' });
        }
      } else {
        wx.switchTab({ url: tab.pagePath });
      }
    }
  }
});
