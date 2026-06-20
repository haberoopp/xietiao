Page({
  data: {
    customers: [],
    filteredCustomers: [],
    selectedPhones: {},
    selectedCount: 0,
    searchKeyword: ''
  },

  onShow() {
    const app = getApp();
    if (!app.globalData.adminLoggedIn && !wx.getStorageSync('adminLoggedIn')) {
      wx.redirectTo({ url: '/pages/admin/login/login' });
      return;
    }
    const role = wx.getStorageSync('adminRole') || app.globalData.adminRole || '';
    if (role !== 'manager') {
      wx.showToast({ title: '仅厂长可管理定价', icon: 'none' });
      wx.redirectTo({ url: '/pages/admin/orders/orders' });
      return;
    }
    this.loadCustomers();
  },

  async loadCustomers() {
    const app = getApp();

    if (app.globalData.demoMode) {
      const customers = wx.getStorageSync('customers') || [];
      const orders = wx.getStorageSync('orders') || [];
      const formatted = customers.map(c => ({
        ...c,
        amountText: ((c.totalAmount || 0) / 100).toFixed(0),
        debtText: c.debt ? ((c.debt / 100).toFixed(0)) : ''
      }));
      this.setData({ customers: formatted });
      this.filterCustomers();
      return;
    }

    try {
      const res = await wx.cloud.callFunction({
        name: 'customerCRUD',
        data: { action: 'list', pageSize: 500 }
      });
      const customers = (res.result && res.result.code === 0)
        ? (res.result.data.list || [])
        : [];
      const formatted = customers.map(c => ({
        ...c,
        amountText: ((c.totalAmount || 0) / 100).toFixed(0),
        debtText: ''
      }));
      this.setData({ customers: formatted });
      this.filterCustomers();
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value });
    this.filterCustomers();
  },

  onClearSearch() {
    this.setData({ searchKeyword: '' });
    this.filterCustomers();
  },

  filterCustomers() {
    const { customers, searchKeyword } = this.data;
    if (!searchKeyword) {
      this.setData({ filteredCustomers: customers });
      return;
    }
    const kw = searchKeyword.toLowerCase();
    this.setData({
      filteredCustomers: customers.filter(c =>
        (c.name || '').toLowerCase().includes(kw) ||
        (c.phone || '').toLowerCase().includes(kw)
      )
    });
  },

  onToggleCustomer(e) {
    const phone = e.currentTarget.dataset.phone;
    const selected = { ...this.data.selectedPhones };
    if (selected[phone]) {
      delete selected[phone];
    } else {
      selected[phone] = true;
    }
    const count = Object.keys(selected).length;
    this.setData({
      selectedPhones: selected,
      selectedCount: count
    });
  },

  onNext() {
    const phones = Object.keys(this.data.selectedPhones);
    if (phones.length === 0) {
      wx.showToast({ title: '请先选择客户', icon: 'none' });
      return;
    }
    // 通过 globalData 传递选中客户手机号
    const app = getApp();
    app.globalData.pricingSelectedPhones = phones;
    wx.navigateTo({ url: '/pages/admin/pricing/product' });
  },

  onBack() {
    wx.redirectTo({ url: '/pages/admin/orders/orders' });
  }
});
