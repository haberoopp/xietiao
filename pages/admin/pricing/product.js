Page({
  data: {
    phones: [],
    selectedCustomers: [],  // { phone, name }
    products: [],
    filteredProducts: [],
    selectedProductIds: {},
    selectedCount: 0,
    allSelected: false,
    searchKeyword: '',

    priceInputs: {},
    pricePlaceholders: {},
    initialPrices: {},

    showBatchModal: false,
    batchPriceValue: '',
    listScrollTop: 0
  },

  onLoad() {
    const app = getApp();
    const phones = app.globalData.pricingSelectedPhones || [];
    if (phones.length === 0) {
      wx.showToast({ title: '请先选择客户', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1000);
      return;
    }
    this.setData({ phones });
    this.loadData();
  },

  onShow() {
    const app = getApp();
    if (!app.globalData.adminLoggedIn && !wx.getStorageSync('adminLoggedIn')) {
      wx.redirectTo({ url: '/pages/admin/login/login' });
      return;
    }
  },

  async loadData() {
    const app = getApp();
    const phones = this.data.phones;

    if (app.globalData.demoMode) {
      const customers = wx.getStorageSync('customers') || [];
      const products = (wx.getStorageSync('cache_admin_products') || [])
        .map(p => ({ ...p, priceText: (p.price / 100).toFixed(2) }))
        .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true }));
      const selectedCustomers = customers
        .filter(c => phones.includes(c.phone))
        .map(c => ({ phone: c.phone, name: c.name }));

      this.setData({ products, selectedCustomers });
      this.filterProducts();

      const prices = (wx.getStorageSync('customerPrices') || [])
        .filter(p => phones.includes(p.customerPhone));
      this._allPrices = prices;
      this.loadPricesFromEntries(prices);
      return;
    }

    try {
      wx.showLoading({ title: '加载中...' });

      // 先查总数
      const countRes = await wx.cloud.callFunction({
        name: 'getProducts', data: { page: 1, pageSize: 1 }
      });
      if (countRes.result.code !== 0) throw new Error('count failed');
      const total = countRes.result.data.total;
      const PAGE = 200;

      // 第一页
      const firstPageRes = await wx.cloud.callFunction({
        name: 'getProducts', data: { page: 1, pageSize: PAGE }
      });
      let allProducts = (firstPageRes.result && firstPageRes.result.code === 0)
        ? firstPageRes.result.data.list : [];

      // 剩余页并行拉取
      if (total > PAGE) {
        const remaining = Math.ceil((total - PAGE) / PAGE);
        const calls = [];
        for (let i = 0; i < remaining; i++) {
          calls.push(wx.cloud.callFunction({
            name: 'getProducts', data: { page: i + 2, pageSize: PAGE }
          }));
        }
        const results = await Promise.all(calls);
        allProducts = allProducts.concat(
          results.filter(r => r.result && r.result.code === 0).flatMap(r => r.result.data.list)
        );
      }

      // 按名称排序（与首页一致）
      const products = allProducts
        .map(p => ({ ...p, priceText: (p.price / 100).toFixed(2) }))
        .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true }));

      // 加载客户信息
      const custRes = await wx.cloud.callFunction({
        name: 'customerCRUD', data: { action: 'list', pageSize: 500 }
      });
      const customers = (custRes.result && custRes.result.code === 0)
        ? (custRes.result.data.list || []) : [];
      const selectedCustomers = customers
        .filter(c => phones.includes(c.phone))
        .map(c => ({ phone: c.phone, name: c.name }));

      this.setData({ products, selectedCustomers });
      this.filterProducts();
      wx.hideLoading();

      // 加载已有专属价
      const results = await Promise.all(
        phones.map(phone =>
          wx.cloud.callFunction({ name: 'customerPriceCRUD', data: { action: 'getByPhone', phone } })
        )
      );
      const allEntries = results
        .filter(r => r.result && r.result.code === 0 && r.result.data)
        .flatMap(r => r.result.data.list || []);

      this.loadPricesFromEntries(allEntries);
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  loadPricesFromEntries(allEntries) {
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

  // ===== 搜索 =====
  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value, listScrollTop: 0 });
    this.filterProducts();
  },

  onClearSearch() {
    this.setData({ searchKeyword: '', listScrollTop: 0 });
    this.filterProducts();
  },

  filterProducts() {
    const { products, searchKeyword } = this.data;
    let list = products;
    if (searchKeyword) {
      const kw = searchKeyword.toLowerCase();
      list = list.filter(p =>
        (p.name || '').toLowerCase().includes(kw) ||
        (p.category || '').toLowerCase().includes(kw)
      );
    }
    const allSelected = list.length > 0 && list.every(p => this.data.selectedProductIds[p._id]);
    this.setData({ filteredProducts: list, allSelected });
  },

  // ===== 产品选择 =====
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
      selectedCount: count,
      allSelected
    });
  },

  onToggleSelectAll() {
    if (this.data.allSelected) {
      this.setData({ selectedProductIds: {}, selectedCount: 0, allSelected: false });
    } else {
      const selected = {};
      this.data.filteredProducts.forEach(p => { selected[p._id] = true; });
      this.setData({
        selectedProductIds: selected,
        selectedCount: this.data.filteredProducts.length,
        allSelected: true
      });
    }
  },

  // ===== 价格输入 =====
  onPriceInput(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ ['priceInputs.' + id]: e.detail.value });
  },

  // ===== 批量改价 =====
  onBatchSetPrice() {
    if (this.data.selectedCount === 0) {
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
    const phones = this.data.phones;
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
      // 重新加载价格显示
      const reloadEntries = prices.filter(p => phones.includes(p.customerPhone));
      this.loadPricesFromEntries(reloadEntries);
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
      // 重新加载价格
      const results = await Promise.all(
        phones.map(phone =>
          wx.cloud.callFunction({ name: 'customerPriceCRUD', data: { action: 'getByPhone', phone } })
        )
      );
      const allEntries = results
        .filter(r => r.result && r.result.code === 0 && r.result.data)
        .flatMap(r => r.result.data.list || []);
      this.loadPricesFromEntries(allEntries);
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '网络错误', icon: 'none' });
    }
  },

  onBack() {
    wx.navigateBack();
  },

  onListScroll(e) {
    this._lastScrollTop = e.detail.scrollTop;
  }
});
