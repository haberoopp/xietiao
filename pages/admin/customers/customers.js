const util = require('../../../utils/util');

Page({
  data: {
    customers: [],
    filteredCustomers: [],
    searchKeyword: '',
    showForm: false,
    editingId: null,
    form: {
      name: '',
      phone: '',
      discount: '1.0'
    }
  },

  onShow() {
    const app = getApp();
    if (!app.globalData.adminLoggedIn && !wx.getStorageSync('adminLoggedIn')) {
      wx.switchTab({ url: '/pages/admin/login/login' });
      return;
    }
    const role = wx.getStorageSync('adminRole') || app.globalData.adminRole || '';
    if (role !== 'manager') {
      wx.showToast({ title: '仅厂长可管理客户', icon: 'none' });
      wx.redirectTo({ url: '/pages/admin/orders/orders' });
      return;
    }
    this.loadCustomers();
  },

  onPullDownRefresh() {
    this.loadCustomers().then(() => wx.stopPullDownRefresh());
  },

  async loadCustomers() {
    const app = getApp();

    if (app.globalData.demoMode) {
      let customers = wx.getStorageSync('customers') || [];
      if (customers.length === 0) {
        customers = [
          { _id: 'c001', name: '温州服装厂', phone: '13800138001', discount: 0.9, totalOrders: 3, totalAmount: 25500, createdAt: Date.now() - 86400000 * 30 },
          { _id: 'c002', name: '陈大明', phone: '13900139002', discount: 0.85, totalOrders: 1, totalAmount: 15000, createdAt: Date.now() - 86400000 * 15 },
        ];
        wx.setStorageSync('customers', customers);
      }
      // 从订单计算欠款（兼容旧客户数据无debt字段）
      const allOrders = [...(wx.getStorageSync('demo_orders') || []), ...(app.globalData.demoOrders || [])];
      customers = customers.map(c => {
        if (c.debt === undefined) {
          c.debt = allOrders
            .filter(o => o.phone === c.phone && o.payment_status === 'unpaid')
            .reduce((sum, o) => sum + (o.totalAmount || 0) - (o.paid_amount || 0), 0);
        }
        return c;
      });
      this.setData({ customers: this.formatCustomers(customers) });
      this.filterCustomers();
      return;
    }

    try {
      const res = await wx.cloud.callFunction({ name: 'customerCRUD', data: { action: 'list' } });
      if (res.result.code === 0) {
        this.setData({ customers: this.formatCustomers(res.result.data.list) });
        this.filterCustomers();
      }
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  onAdd() {
    this.setData({
      showForm: true,
      editingId: null,
      form: { name: '', phone: '', discount: '1.0' }
    });
  },

  onEdit(e) {
    const c = e.currentTarget.dataset.customer;
    this.setData({
      showForm: true,
      editingId: c._id,
      form: { name: c.name, phone: c.phone, discount: String(c.discount) }
    });
  },

  onDelete(e) {
    const { id, name } = e.currentTarget.dataset;
    wx.showModal({
      title: '确认删除',
      content: `确定要删除客户"${name}"吗？`,
      success: async (res) => {
        if (!res.confirm) return;
        const app = getApp();

        if (app.globalData.demoMode) {
          let customers = wx.getStorageSync('customers') || [];
          customers = customers.filter(c => c._id !== id);
          wx.setStorageSync('customers', customers);
          this.setData({ customers: this.formatCustomers(customers) });
          wx.showToast({ title: '已删除', icon: 'success' });
          return;
        }

        try {
          const result = await wx.cloud.callFunction({ name: 'customerCRUD', data: { action: 'delete', customerId: id } });
          if (result.result.code === 0) {
            wx.showToast({ title: '已删除', icon: 'success' });
            this.loadCustomers();
          }
        } catch (err) {
          wx.showToast({ title: '删除失败', icon: 'none' });
        }
      }
    });
  },

  onFormInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ ['form.' + field]: e.detail.value });
  },

  onDiscountSlider(e) {
    this.setData({ 'form.discount': (e.detail.value / 100).toFixed(2) });
  },

  async onSave() {
    const { name, phone, discount } = this.data.form;

    if (!name.trim()) {
      wx.showToast({ title: '请填写客户名称', icon: 'none' });
      return;
    }
    if (!util.isValidPhone(phone)) {
      wx.showToast({ title: '请填写正确的手机号', icon: 'none' });
      return;
    }
    const d = parseFloat(discount);
    if (isNaN(d) || d <= 0 || d > 1) {
      wx.showToast({ title: '折扣必须在0.01~1.0之间', icon: 'none' });
      return;
    }

    const app = getApp();

    if (app.globalData.demoMode) {
      let customers = wx.getStorageSync('customers') || [];
      if (this.data.editingId) {
        customers = customers.map(c => c._id === this.data.editingId ? { ...c, name: name.trim(), phone: phone.trim(), discount: d } : c);
      } else {
        customers.push({
          _id: 'c' + Date.now(),
          name: name.trim(),
          phone: phone.trim(),
          discount: d,
          totalOrders: 0,
          totalAmount: 0,
          createdAt: Date.now()
        });
      }
      wx.setStorageSync('customers', customers);
      this.setData({ showForm: false, customers: this.formatCustomers(customers) });
      wx.showToast({ title: '已保存', icon: 'success' });
      return;
    }

    wx.showLoading({ title: '保存中...' });
    try {
      const data = { name: name.trim(), phone: phone.trim(), discount: d };
      if (this.data.editingId) {
        data.action = 'update';
        data.customerId = this.data.editingId;
      } else {
        data.action = 'add';
      }
      const result = await wx.cloud.callFunction({ name: 'customerCRUD', data });
      wx.hideLoading();
      if (result.result.code === 0) {
        this.setData({ showForm: false });
        this.loadCustomers();
        wx.showToast({ title: '已保存', icon: 'success' });
      } else {
        wx.showToast({ title: result.result.msg || '保存失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '网络错误', icon: 'none' });
    }
  },

  onCancel() {
    this.setData({ showForm: false });
  },

  onBackToOrders() {
    wx.redirectTo({ url: '/pages/admin/orders/orders' });
  },

  formatCustomers(list) {
    return list.map(c => ({
      ...c,
      discountLabel: c.discount < 1 ? (c.discount * 10).toFixed(1).replace(/\.0$/, '') + '折' : '',
      amountText: (c.totalAmount / 100).toFixed(2),
      debtText: (c.debt && c.debt > 0) ? ((c.debt / 100).toFixed(2)) : ''
    }));
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
  }
});
