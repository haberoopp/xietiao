const demoStore = require('../../../utils/demoStore');

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
    this.loadCloudDashboard();
  },

  loadDemoDashboard() {
    const orders = demoStore.getAll(demoStore.KEYS.orders);
    const products = demoStore.getAll(demoStore.KEYS.products);
    this.renderDashboard(orders, products);
  },

  async loadCloudDashboard() {
    wx.showLoading({ title: '加载中...' });
    try {
      // 先查总数，再并行拉取全部
      const [orderCountRes, productCountRes] = await Promise.all([
        wx.cloud.callFunction({ name: 'adminGetOrders', data: { page: 1, pageSize: 1 } }),
        wx.cloud.callFunction({ name: 'getProducts', data: { page: 1, pageSize: 1 } })
      ]);
      const orderTotal = orderCountRes.result && orderCountRes.result.code === 0 ? orderCountRes.result.data.total : 0;
      const productTotal = productCountRes.result && productCountRes.result.code === 0 ? productCountRes.result.data.total : 0;
      const PAGE = 200;
      const orderPages = Math.ceil(orderTotal / PAGE);
      const productPages = Math.ceil(productTotal / PAGE);

      const orderCalls = [];
      const productCalls = [];
      for (let i = 0; i < orderPages; i++) {
        orderCalls.push(wx.cloud.callFunction({ name: 'adminGetOrders', data: { page: i + 1, pageSize: PAGE } }));
      }
      for (let i = 0; i < productPages; i++) {
        productCalls.push(wx.cloud.callFunction({ name: 'getProducts', data: { page: i + 1, pageSize: PAGE } }));
      }

      const [orderResults, productResults] = await Promise.all([
        Promise.all(orderCalls),
        Promise.all(productCalls)
      ]);

      const orders = orderResults
        .filter(r => r.result && r.result.code === 0)
        .flatMap(r => r.result.data.list || []);
      const products = productResults
        .filter(r => r.result && r.result.code === 0)
        .flatMap(r => r.result.data.list || []);

      this.renderDashboard(orders, products);
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
    wx.hideLoading();
  },

  renderDashboard(orders, products) {
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

    const rangeOrders = orders.filter(o => new Date(o.createdAt).getTime() >= rangeStart);

    // 近7天趋势
    const trendDays = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date();
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const dayOrders = orders.filter(o => {
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
    const unpaidAmount = orders.filter(o => o.payment_status === 'unpaid').reduce((sum, o) => sum + (o.totalAmount || 0) - (o.paid_amount || 0), 0);

    // 从订单数据中计算各产品销售额（替代云函数中的 recent_sales）
    const productSales = {};
    rangeOrders.forEach(o => {
      (o.items || []).forEach(item => {
        const pid = item.productId;
        if (!pid) return;
        productSales[pid] = (productSales[pid] || 0) + (item.price || 0) * (item.quantity || 0);
      });
    });

    // 缺货
    const shortageProducts = products
      .filter(p => p.status === 'out' || p.status === 'low')
      .map(p => ({
        _id: p._id,
        name: p.name,
        status: p.status,
        recentSalesText: ((productSales[p._id] || 0) / 100).toFixed(0),
        lastProducedText: p.last_produced_at ? this.formatDaysAgo(p.last_produced_at) : ''
      }))
      .sort((a, b) => a.status === 'out' ? -1 : 1);

    // 产品排行
    const maxSales = Math.max(1, ...products.map(p => productSales[p._id] || 0));
    const topProducts = [...products]
      .sort((a, b) => (productSales[b._id] || 0) - (productSales[a._id] || 0))
      .slice(0, 10)
      .map(p => ({
        _id: p._id, name: p.name, category: p.category, unit: p.unit,
        recentSalesText: ((productSales[p._id] || 0) / 100).toFixed(0),
        barPercent: Math.round(((productSales[p._id] || 0) / maxSales) * 100)
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
