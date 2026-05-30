Page({
  data: {
    todayOrders: 0,
    todaySales: '0',
    shortageCount: 0,
    shortageProducts: [],
    topProducts: []
  },

  onShow() {
    const app = getApp();
    if (!app.globalData.adminLoggedIn && !wx.getStorageSync('adminLoggedIn')) {
      wx.switchTab({ url: '/pages/admin/login/login' });
      return;
    }
    const role = wx.getStorageSync('adminRole') || app.globalData.adminRole || '';
    if (role !== 'manager') {
      wx.showToast({ title: '仅厂长可查看', icon: 'none' });
      wx.redirectTo({ url: '/pages/admin/orders/orders' });
      return;
    }
    this.loadDashboard();
  },

  loadDashboard() {
    const app = getApp();
    if (app.globalData.demoMode) {
      this.loadDemoDashboard();
      return;
    }
    // 云函数模式：调用 adminGetDashboard（后续实现），当前先走 demo
    this.loadDemoDashboard();
  },

  loadDemoDashboard() {
    const app = getApp();
    const saved = wx.getStorageSync('demoOrders') || [];
    const allOrders = [...saved, ...(app.globalData.demoOrders || [])];
    const unique = [];
    const seen = new Set();
    allOrders.forEach(o => {
      if (!seen.has(o._id)) { seen.add(o._id); unique.push(o); }
    });

    const products = app.globalData.demoProducts || [];

    // 今日统计
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayOrders = unique.filter(o => new Date(o.createdAt) >= today);

    const todaySales = todayOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    // 缺货/紧张产品
    const shortageProducts = products
      .filter(p => p.status === 'out' || p.status === 'low')
      .map(p => ({
        _id: p._id,
        name: p.name,
        status: p.status,
        recentSalesText: ((p.recent_sales || 0) / 100).toFixed(0),
        lastProducedText: p.last_produced_at ? this.formatDaysAgo(p.last_produced_at) : ''
      }))
      .sort((a, b) => a.status === 'out' ? -1 : 1);

    // 销量排行（按 recent_sales 降序取前10）
    const maxSales = Math.max(1, ...products.map(p => p.recent_sales || 0));
    const topProducts = [...products]
      .sort((a, b) => (b.recent_sales || 0) - (a.recent_sales || 0))
      .slice(0, 10)
      .map(p => ({
        _id: p._id,
        name: p.name,
        category: p.category,
        unit: p.unit,
        recentSalesText: ((p.recent_sales || 0) / 100).toFixed(0),
        barPercent: Math.round(((p.recent_sales || 0) / maxSales) * 100)
      }));

    this.setData({
      todayOrders: todayOrders.length,
      todaySales: (todaySales / 100).toFixed(0),
      shortageCount: shortageProducts.length,
      shortageProducts,
      topProducts
    });
  },

  formatDaysAgo(ts) {
    const days = Math.floor((Date.now() - ts) / 86400000);
    if (days === 0) return '今天';
    if (days === 1) return '昨天';
    return days + '天前';
  },

  onFilterShortage() {
    wx.navigateTo({ url: '/pages/admin/products/products?filter=shortage' });
  },

  onBackToOrders() {
    wx.redirectTo({ url: '/pages/admin/orders/orders' });
  }
});
