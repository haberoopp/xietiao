Page({
  data: {
    dateRange: 'today',
    dateLabel: '今天',
    totalOrders: 0,
    totalSales: '0',
    pendingOrders: 0,
    unpaidAmount: '0',
    shortageCount: 0,
    trendDays: [],
    topProducts: [],
    topCustomers: [],
    shortageProducts: []
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

    const now = Date.now();
    let rangeStart;
    if (this.data.dateRange === 'today') {
      rangeStart = new Date();
      rangeStart.setHours(0, 0, 0, 0);
      rangeStart = rangeStart.getTime();
    } else if (this.data.dateRange === '7days') {
      rangeStart = now - 7 * 86400000;
    } else {
      rangeStart = now - 30 * 86400000;
    }

    const rangeOrders = unique.filter(o => new Date(o.createdAt).getTime() >= rangeStart);

    // 近7天趋势
    const trendDays = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date();
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const dayOrders = unique.filter(o => {
        const t = new Date(o.createdAt).getTime();
        return t >= dayStart.getTime() && t < dayEnd.getTime();
      });
      const daySales = dayOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      trendDays.push({
        label: (dayStart.getMonth() + 1) + '/' + dayStart.getDate(),
        orders: dayOrders.length,
        sales: (daySales / 100).toFixed(0),
        barHeight: daySales > 0 ? Math.max(8, Math.round((daySales / 10000) * 40)) : 0
      });
    }

    const totalOrders = rangeOrders.length;
    const totalSales = rangeOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const pendingOrders = rangeOrders.filter(o => o.status === 'processing').length;
    const unpaidAmount = unique.filter(o => o.payment_status === 'unpaid').reduce((sum, o) => sum + (o.totalAmount || 0) - (o.paid_amount || 0), 0);

    // 缺货
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

    // 产品排行
    const maxSales = Math.max(1, ...products.map(p => p.recent_sales || 0));
    const topProducts = [...products]
      .sort((a, b) => (b.recent_sales || 0) - (a.recent_sales || 0))
      .slice(0, 10)
      .map(p => ({
        _id: p._id, name: p.name, category: p.category, unit: p.unit,
        recentSalesText: ((p.recent_sales || 0) / 100).toFixed(0),
        barPercent: Math.round(((p.recent_sales || 0) / maxSales) * 100)
      }));

    // 客户排行
    const custMap = {};
    rangeOrders.forEach(o => {
      const key = o.phone || '未知';
      if (!custMap[key]) {
        custMap[key] = { name: o.customerName || '未知', phone: key, totalAmount: 0, orderCount: 0 };
      }
      custMap[key].totalAmount += (o.totalAmount || 0);
      custMap[key].orderCount += 1;
    });
    const maxCustAmount = Math.max(1, ...Object.values(custMap).map(c => c.totalAmount));
    const topCustomers = Object.values(custMap)
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 10)
      .map(c => ({
        ...c,
        amountText: (c.totalAmount / 100).toFixed(0),
        barPercent: Math.round((c.totalAmount / maxCustAmount) * 100)
      }));

    this.setData({
      totalOrders, totalSales: (totalSales / 100).toFixed(0),
      pendingOrders, unpaidAmount: (unpaidAmount / 100).toFixed(0),
      shortageCount: shortageProducts.length,
      trendDays, topProducts, topCustomers, shortageProducts
    });
  },

  onDateTap(e) {
    const range = e.currentTarget.dataset.range;
    const labels = { today: '今天', '7days': '近7天', '30days': '近30天' };
    this.setData({ dateRange: range, dateLabel: labels[range] });
    this.loadDashboard();
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
