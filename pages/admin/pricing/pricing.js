Page({
  data: {
    // 客户
    customers: [],
    filteredCustomers: [],
    selectedCustomerPhones: {},
    selectedCustomerCount: 0,
    customerSearchKeyword: '',

    // 产品
    products: [],
    filteredProducts: [],
    selectedProductIds: {},
    selectedProductCount: 0,
    allSelected: false,
    productSearchKeyword: '',

    // 价格
    priceInputs: {},       // key: productId, value: input string (元)
    pricePlaceholders: {}, // key: productId, value: placeholder text
    initialPrices: {},     // key: "phone::productId", value: customPrice (分), for diff

    // 弹窗
    showBatchModal: false,
    batchPriceValue: '',

    listScrollTop: 0
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
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData().then(() => wx.stopPullDownRefresh());
  },

  async loadData() {
    const app = getApp();

    if (app.globalData.demoMode) {
      const customers = wx.getStorageSync('customers') || [];
      const products = (wx.getStorageSync('cache_admin_products') || []).map(p => ({
        ...p, priceText: (p.price / 100).toFixed(2)
      }));
      this.setData({ customers, products });
      this.filterCustomers();
      this.filterProducts();
      const prices = wx.getStorageSync('customerPrices') || [];
      this._allPrices = prices;
      return;
    }

    try {
      const [custRes, prodRes] = await Promise.all([
        wx.cloud.callFunction({ name: 'customerCRUD', data: { action: 'list', pageSize: 500 } }),
        wx.cloud.callFunction({ name: 'getProducts', data: { page: 1, pageSize: 500 } })
      ]);

      const customers = (custRes.result && custRes.result.code === 0)
        ? (custRes.result.data.list || []) : [];
      const products = (prodRes.result && prodRes.result.code === 0)
        ? (prodRes.result.data.list || []).map(p => ({ ...p, priceText: (p.price / 100).toFixed(2) }))
        : [];

      this.setData({ customers, products });
      this.filterCustomers();
      this.filterProducts();
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  // ===== 客户选择 =====
  onCustomerSearch(e) {
    this.setData({ customerSearchKeyword: e.detail.value });
    this.filterCustomers();
  },

  onClearCustomerSearch() {
    this.setData({ customerSearchKeyword: '' });
    this.filterCustomers();
  },

  filterCustomers() {
    const { customers, customerSearchKeyword } = this.data;
    if (!customerSearchKeyword) {
      this.setData({ filteredCustomers: customers });
      return;
    }
    const kw = customerSearchKeyword.toLowerCase();
    this.setData({
      filteredCustomers: customers.filter(c =>
        (c.name || '').toLowerCase().includes(kw) ||
        (c.phone || '').toLowerCase().includes(kw)
      )
    });
  },

  onToggleCustomer(e) {
    const phone = e.currentTarget.dataset.phone;
    const selected = { ...this.data.selectedCustomerPhones };
    if (selected[phone]) {
      delete selected[phone];
    } else {
      selected[phone] = true;
    }
    const count = Object.keys(selected).length;
    this.setData({
      selectedCustomerPhones: selected,
      selectedCustomerCount: count
    });
    this.loadPricesForSelected();
  },

  // ===== 产品选择 =====
  onProductSearch(e) {
    this.setData({ productSearchKeyword: e.detail.value, listScrollTop: 0 });
    this.filterProducts();
  },

  onClearProductSearch() {
    this.setData({ productSearchKeyword: '', listScrollTop: 0 });
    this.filterProducts();
  },

  filterProducts() {
    const { products, productSearchKeyword } = this.data;
    let list = products;
    if (productSearchKeyword) {
      const kw = productSearchKeyword.toLowerCase();
      list = list.filter(p =>
        (p.name || '').toLowerCase().includes(kw) ||
        (p.category || '').toLowerCase().includes(kw)
      );
    }
    const allSelected = list.length > 0 && list.every(p => this.data.selectedProductIds[p._id]);
    this.setData({ filteredProducts: list, allSelected });
  },

  onToggleProduct(e) {
    const id = e.currentTarget.dataset.id;
    const selected = { ...this.data.selectedProductIds };
    if (selected[id]) {
      delete selected[id];
    } else {
      selected[id] = true;
    }
    const count = Object.keys(selected).length;
    const allSelected = this.data.filteredProducts.every(p => selected[p._id]);
    this.setData({
      selectedProductIds: selected,
      selectedProductCount: count,
      allSelected
    });
  },

  onToggleSelectAll() {
    if (this.data.allSelected) {
      this.setData({ selectedProductIds: {}, selectedProductCount: 0, allSelected: false });
    } else {
      const selected = {};
      this.data.filteredProducts.forEach(p => { selected[p._id] = true; });
      this.setData({
        selectedProductIds: selected,
        selectedProductCount: this.data.filteredProducts.length,
        allSelected: true
      });
    }
  },

  // ===== 加载专属价 =====
  async loadPricesForSelected() {
    const phones = Object.keys(this.data.selectedCustomerPhones);
    if (phones.length === 0) {
      this.setData({ priceInputs: {}, pricePlaceholders: {}, initialPrices: {} });
      return;
    }

    const app = getApp();
    let allEntries = [];

    if (app.globalData.demoMode) {
      const prices = this._allPrices || [];
      allEntries = prices.filter(p => phones.includes(p.customerPhone));
    } else {
      try {
        const results = await Promise.all(
          phones.map(phone =>
            wx.cloud.callFunction({
              name: 'customerPriceCRUD',
              data: { action: 'getByPhone', phone }
            })
          )
        );
        allEntries = results
          .filter(r => r.result && r.result.code === 0 && r.result.data)
          .flatMap(r => r.result.data.list || []);
      } catch (err) {
        console.error('加载专属价失败', err);
        return;
      }
    }

    // 合并多客户价格
    const priceByProduct = {};
    const initialPrices = {};
    allEntries.forEach(entry => {
      const key = entry.customerPhone + '::' + entry.productId;
      initialPrices[key] = entry.customPrice;
      if (!priceByProduct[entry.productId]) {
        priceByProduct[entry.productId] = new Set();
      }
      priceByProduct[entry.productId].add(entry.customPrice);
    });

    const priceInputs = {};
    const pricePlaceholders = {};
    Object.keys(priceByProduct).forEach(pid => {
      const priceSet = priceByProduct[pid];
      if (priceSet.size === 1) {
        const priceInYuan = (Array.from(priceSet)[0] / 100).toFixed(2);
        priceInputs[pid] = priceInYuan;
        pricePlaceholders[pid] = '';
      } else {
        priceInputs[pid] = '';
        pricePlaceholders[pid] = '多个价格';
      }
    });

    this.setData({ priceInputs, pricePlaceholders, initialPrices });
  },

  // ===== 价格输入 =====
  onPriceInput(e) {
    const id = e.currentTarget.dataset.id;
    const value = e.detail.value;
    this.setData({ ['priceInputs.' + id]: value });
  },

  // ===== 批量改价弹窗 =====
  onBatchSetPrice() {
    if (this.data.selectedProductCount === 0) {
      wx.showToast({ title: '请先选择产品', icon: 'none' });
      return;
    }
    this.setData({ showBatchModal: true, batchPriceValue: '' });
  },

  onBatchPriceInput(e) {
    this.setData({ batchPriceValue: e.detail.value });
  },

  onCancelBatch() {
    this.setData({ showBatchModal: false });
  },

  onConfirmBatch() {
    const price = parseFloat(this.data.batchPriceValue);
    if (isNaN(price) || price <= 0) {
      wx.showToast({ title: '请输入有效的价格', icon: 'none' });
      return;
    }
    const priceStr = price.toFixed(2);
    const selectedIds = this.data.selectedProductIds;
    const priceInputs = { ...this.data.priceInputs };
    const pricePlaceholders = { ...this.data.pricePlaceholders };
    Object.keys(selectedIds).forEach(id => {
      priceInputs[id] = priceStr;
      pricePlaceholders[id] = '';
    });
    this.setData({ showBatchModal: false, priceInputs, pricePlaceholders });
  },

  // ===== 保存 =====
  async onSave() {
    const phones = Object.keys(this.data.selectedCustomerPhones);
    if (phones.length === 0) {
      wx.showToast({ title: '请先选择客户', icon: 'none' });
      return;
    }

    const { priceInputs, initialPrices, products } = this.data;
    const sets = [];
    const deletes = [];

    const productNameMap = {};
    products.forEach(p => { productNameMap[p._id] = p.name; });

    const allProductIds = new Set([
      ...Object.keys(priceInputs),
      ...Object.keys(initialPrices).map(k => k.split('::')[1])
    ]);

    allProductIds.forEach(pid => {
      phones.forEach(phone => {
        const key = phone + '::' + pid;
        const inputVal = priceInputs[pid];
        const initialVal = initialPrices[key];

        if (inputVal !== undefined && inputVal !== '') {
          const newPrice = Math.round(parseFloat(inputVal) * 100);
          if (isNaN(newPrice) || newPrice <= 0) return;
          if (initialVal !== newPrice) {
            sets.push({
              customerPhone: phone,
              productId: pid,
              productName: productNameMap[pid] || '',
              customPrice: newPrice
            });
          }
        } else if (inputVal === '' && initialVal !== undefined) {
          deletes.push({ customerPhone: phone, productId: pid });
        }
      });
    });

    if (sets.length === 0 && deletes.length === 0) {
      wx.showToast({ title: '没有需要保存的更改', icon: 'none' });
      return;
    }

    const app = getApp();

    if (app.globalData.demoMode) {
      let prices = wx.getStorageSync('customerPrices') || [];
      deletes.forEach(d => {
        prices = prices.filter(p => !(p.customerPhone === d.customerPhone && p.productId === d.productId));
      });
      sets.forEach(s => {
        const existIdx = prices.findIndex(p => p.customerPhone === s.customerPhone && p.productId === s.productId);
        if (existIdx > -1) {
          prices[existIdx] = { ...prices[existIdx], customPrice: s.customPrice, productName: s.productName, updatedAt: Date.now() };
        } else {
          prices.push({
            _id: 'cp' + Date.now() + Math.random().toString(36).slice(2),
            customerPhone: s.customerPhone,
            productId: s.productId,
            productName: s.productName,
            customPrice: s.customPrice,
            createdAt: Date.now(),
            updatedAt: Date.now()
          });
        }
      });
      wx.setStorageSync('customerPrices', prices);
      this._allPrices = prices;

      wx.showToast({ title: '已保存' + sets.length + '条，删除' + deletes.length + '条', icon: 'success' });
      this.setData({ initialPrices: {} });
      this.loadPricesForSelected();
      return;
    }

    wx.showLoading({ title: '保存中...' });
    try {
      const tasks = [];
      if (sets.length > 0) {
        tasks.push(
          wx.cloud.callFunction({ name: 'customerPriceCRUD', data: { action: 'batchSet', entries: sets } })
        );
      }
      if (deletes.length > 0) {
        tasks.push(
          wx.cloud.callFunction({ name: 'customerPriceCRUD', data: { action: 'batchDelete', entries: deletes } })
        );
      }
      await Promise.all(tasks);

      wx.hideLoading();
      wx.showToast({ title: '已保存' + sets.length + '条，删除' + deletes.length + '条', icon: 'success' });
      this.setData({ initialPrices: {} });
      this.loadPricesForSelected();
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '网络错误', icon: 'none' });
    }
  },

  // ===== 导航 =====
  onBack() {
    wx.redirectTo({ url: '/pages/admin/orders/orders' });
  },

  onListScroll(e) {
    this._lastScrollTop = e.detail.scrollTop;
  }
});