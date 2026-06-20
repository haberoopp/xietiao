const constants = require('../../../utils/constants');
const demoStore = require('../../../utils/demoStore');

Page({
  data: {
    products: [],
    filteredProducts: [],
    searchKeyword: '',
    categories: constants.PRODUCT_CATEGORIES,
    showForm: false,
    editingProduct: null,
    form: {
      name: '',
      category: '色丁',
      price: '',
      unit: '米',
      status: 'sufficient',
      description: '',
      image: ''
    },
    // 批量管理
    selectMode: false,
    selectedIds: {},
    selectedCount: 0,
    allSelected: false,
    listScrollTop: 0,
    showImagePreview: false,
    previewImageUrl: '',
    previewImageUrls: [],
    previewImageIndex: 0,
    showBatchForm: false,
    batchForm: {
      category: '',
      unit: '',
      status: ''
    },
    batchCategories: ['', '色丁', '雪纺', '涤纶', '锦纶', '花边', '其他'],
    batchUnits: ['', '米', '卷', '个', '公斤', '包'],
    batchStatuses: ['', '充足', '紧张', '缺货'],
    filterMode: ''  // 'shortage' 来自仪表盘缺货预警
  },

  onLoad(options) {
    if (options && options.filter === 'shortage') {
      this.setData({ filterMode: 'shortage' });
    }
  },

  onShow() {
    if (!getApp().globalData.adminLoggedIn && !wx.getStorageSync('adminLoggedIn')) {
      wx.redirectTo({ url: '/pages/admin/login/login' });
      return;
    }
    // 仅厂长可管理产品
    const role = wx.getStorageSync('adminRole') || getApp().globalData.adminRole || '';
    if (role !== 'manager') {
      wx.showToast({ title: '仅厂长可管理产品', icon: 'none' });
      wx.redirectTo({ url: '/pages/admin/orders/orders' });
      return;
    }
    // 始终拉取数据（数据对比在 loadProducts 内部，未变化则跳过 setData 避免滚动重置）
    this.loadProducts();
  },

  onPullDownRefresh() {
    this.setData({ listScrollTop: 0 });
    this.loadProducts().then(() => wx.stopPullDownRefresh());
  },

  async loadProducts() {
    const app = getApp();

    if (app.globalData.demoMode) {
      const products = demoStore.getAll(demoStore.KEYS.products).map(p => ({
        ...p, priceText: (p.price / 100).toFixed(2), status: p.status || 'sufficient', selected: false
      })).sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true }));
      this._cachedProducts = products;
      this._lastProductsData = JSON.stringify(products);
      this.setData({ products });
      this.filterProducts();
      return;
    }

    // 1. 缓存优先：瞬间显示上次数据
    let fromCache = false;
    const cached = wx.getStorageSync('cache_admin_products');
    if (cached && cached.length > 0) {
      this._cachedProducts = cached;
      this._lastProductsData = JSON.stringify(cached);
      this.setData({ products: cached });
      this.filterProducts();
      fromCache = true;
    }

    // 2. 后台拉取最新数据（count + 第一页并行，减少 1 个 RTT）
    const PAGE = 200;
    try {
      const [countRes, firstPageRes] = await Promise.all([
        wx.cloud.callFunction({ name: 'getProducts', data: { page: 1, pageSize: 1 } }),
        wx.cloud.callFunction({ name: 'getProducts', data: { page: 1, pageSize: PAGE } })
      ]);
      if (countRes.result.code !== 0) throw new Error('count failed');
      const total = countRes.result.data.total;

      let products = (firstPageRes.result && firstPageRes.result.code === 0)
        ? firstPageRes.result.data.list : [];

      if (total > PAGE) {
        const remaining = Math.ceil((total - PAGE) / PAGE);
        const calls = [];
        for (let i = 0; i < remaining; i++) {
          calls.push(wx.cloud.callFunction({
            name: 'getProducts', data: { page: i + 2, pageSize: PAGE }
          }));
        }
        const results = await Promise.all(calls);
        products = products.concat(
          results.filter(r => r.result && r.result.code === 0).flatMap(r => r.result.data.list)
        );
      }

      products = products
        .map(p => ({ ...p, priceText: (p.price / 100).toFixed(2), status: p.status || 'sufficient', selected: false }))
        .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true }));

      const newDataStr = JSON.stringify(products);
      if (this._lastProductsData === newDataStr) return;
      this._lastProductsData = newDataStr;
      this._cachedProducts = products;

      wx.setStorage({ key: 'cache_admin_products', data: products });
      this.setData({ products });
      this.filterProducts();
      console.log('✅ 已加载 ' + products.length + ' / ' + total + ' 个产品' + (fromCache ? '（缓存秒开 + 后台更新）' : ''));
    } catch (err) {
      console.error('admin loadProducts 失败', err);
      if (!fromCache) wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  onAdd() {
    this.setData({
      showForm: true,
      editingProduct: null,
      form: { name: '', category: '色丁', price: '', unit: '米', status: 'sufficient', description: '', image: '' }
    });
  },

  onEdit(e) {
    const product = e.currentTarget.dataset.product;
    this.setData({
      showForm: true,
      editingProduct: product,
      form: {
        name: product.name,
        category: product.category,
        price: (product.price / 100).toFixed(2),
        unit: product.unit,
        status: product.status || 'sufficient',
        description: product.description || '',
        image: product.image || ''
      }
    });
  },

  onDelete(e) {
    const product = e.currentTarget.dataset.product;
    wx.showModal({
      title: '确认删除',
      content: `确定要删除"${product.name}"吗？`,
      success: async (res) => {
        if (!res.confirm) return;
        const app = getApp();

        if (app.globalData.demoMode) {
          const current = demoStore.getAll(demoStore.KEYS.products);
          const updated = current.filter(p => p._id !== product._id);
          demoStore.setAll(demoStore.KEYS.products, updated);
          wx.showToast({ title: '已删除（演示模式）', icon: 'success' });
          this.loadProducts();
          return;
        }

        try {
          const result = await wx.cloud.callFunction({
            name: 'adminDeleteProduct',
            data: { productId: product._id }
          });
          if (result.result.code === 0) {
            wx.showToast({ title: '已删除', icon: 'success' });
            this.loadProducts();
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

  onCategoryChange(e) {
    this.setData({ 'form.category': this.data.categories[e.detail.value] });
  },

  onUnitChange(e) {
    const units = constants.PRODUCT_UNITS;
    this.setData({ 'form.unit': units[e.detail.value] });
  },

  onStatusChange(e) {
    const statuses = constants.PRODUCT_STATUSES;
    this.setData({ 'form.status': statuses[e.detail.value] });
  },

  onChooseImage() {
    const app = getApp();
    if (app.globalData.demoMode) {
      wx.showToast({ title: '演示模式不支持上传图片', icon: 'none' });
      return;
    }

    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0];
        wx.showLoading({ title: '上传中...' });
        const cloudPath = 'products/' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.jpg';
        wx.cloud.uploadFile({
          cloudPath,
          filePath: tempFilePath,
          success: (uploadRes) => {
            this.setData({ 'form.image': uploadRes.fileID });
            wx.hideLoading();
            wx.showToast({ title: '上传成功', icon: 'success' });
          },
          fail: () => {
            wx.hideLoading();
            wx.showToast({ title: '上传失败', icon: 'none' });
          }
        });
      }
    });
  },

  async onSave() {
    const { name, category, price, unit, description, image } = this.data.form;

    if (!name.trim()) {
      wx.showToast({ title: '请输入产品名称', icon: 'none' });
      return;
    }
    if (!price || isNaN(price) || parseFloat(price) <= 0) {
      wx.showToast({ title: '请输入有效价格', icon: 'none' });
      return;
    }

    const productData = {
      name: name.trim(),
      category,
      price: Math.round(parseFloat(price) * 100),
      unit,
      status: this.data.form.status || 'sufficient',
      description: description.trim(),
      image
    };

    // 状态变为充足时记录补货时间（demo和云端均需）
    if (this.data.editingProduct && productData.status === 'sufficient' && this.data.editingProduct.status !== 'sufficient') {
      productData.last_produced_at = Date.now();
    }

    const app = getApp();

    if (app.globalData.demoMode) {
      if (this.data.editingProduct) {
        const idx = app.globalData.demoProducts.findIndex(p => p._id === this.data.editingProduct._id);
        if (idx > -1) {
          const old = app.globalData.demoProducts[idx];
          app.globalData.demoProducts[idx] = { ...old, ...productData };
        }
      } else {
        productData._id = 'p' + Date.now();
        productData.createdAt = Date.now();
        app.globalData.demoProducts.unshift(productData);
      }
      demoStore.setAll(demoStore.KEYS.products, [...app.globalData.demoProducts]);
      wx.showToast({ title: '保存成功（演示模式）', icon: 'success' });
      this.setData({ showForm: false });
      this.loadProducts();
      return;
    }

    wx.showLoading({ title: '保存中...' });

    try {
      let result;
      const apiData = {
        ...productData,
        price: parseFloat(this.data.form.price)
      };

      if (this.data.editingProduct) {
        result = await wx.cloud.callFunction({
          name: 'adminUpdateProduct',
          data: { productId: this.data.editingProduct._id, ...apiData }
        });
      } else {
        result = await wx.cloud.callFunction({
          name: 'adminAddProduct',
          data: apiData
        });
      }

      wx.hideLoading();
      if (result.result.code === 0) {
        wx.showToast({ title: '保存成功', icon: 'success' });
        this.setData({ showForm: false });
        this.loadProducts();
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

  // ===== 批量管理 =====
  onToggleBatchMode() {
    if (this.data.selectMode) {
      this.exitBatchMode();
    } else {
      this.enterBatchMode();
    }
  },

  enterBatchMode() {
    const products = this.data.filteredProducts.map(p => ({ ...p, selected: false }));
    this.setData({
      selectMode: true,
      filteredProducts: products,
      selectedIds: {},
      selectedCount: 0,
      allSelected: false
    });
  },

  exitBatchMode() {
    const products = this.data.filteredProducts.map(p => ({ ...p, selected: false }));
    this.setData({
      selectMode: false,
      filteredProducts: products,
      selectedIds: {},
      selectedCount: 0,
      allSelected: false
    });
  },

  onToggleSelect(e) {
    const id = e.currentTarget.dataset.id;
    const selectedIds = { ...this.data.selectedIds };
    if (selectedIds[id]) {
      delete selectedIds[id];
    } else {
      selectedIds[id] = true;
    }
    const count = Object.keys(selectedIds).length;
    const filteredProducts = this.data.filteredProducts.map(p => ({
      ...p,
      selected: !!selectedIds[p._id]
    }));
    this.setData({
      selectedIds,
      selectedCount: count,
      allSelected: count === filteredProducts.length,
      filteredProducts
    });
  },

  onToggleSelectAll() {
    if (this.data.allSelected) {
      const filteredProducts = this.data.filteredProducts.map(p => ({ ...p, selected: false }));
      this.setData({
        filteredProducts,
        selectedIds: {},
        selectedCount: 0,
        allSelected: false
      });
    } else {
      const selectedIds = {};
      this.data.filteredProducts.forEach(p => { selectedIds[p._id] = true; });
      const filteredProducts = this.data.filteredProducts.map(p => ({ ...p, selected: true }));
      this.setData({
        filteredProducts,
        selectedIds,
        selectedCount: filteredProducts.length,
        allSelected: true
      });
    }
  },

  onBatchDelete() {
    const ids = Object.keys(this.data.selectedIds);
    if (ids.length === 0) {
      wx.showToast({ title: '请先选择产品', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '批量删除',
      content: `确定要删除选中的${ids.length}个产品吗？此操作不可恢复。`,
      confirmColor: '#f44336',
      success: async (res) => {
        if (!res.confirm) return;
        const app = getApp();

        if (app.globalData.demoMode) {
          const products = this.data.products.filter(p => !this.data.selectedIds[p._id]);
          demoStore.setAll(demoStore.KEYS.products, products);
          wx.showToast({ title: `已删除${ids.length}个产品`, icon: 'success' });
          this.exitBatchMode();
          this.loadProducts();
          return;
        }

        wx.showLoading({ title: `删除${ids.length}个产品...` });
        try {
          const result = await wx.cloud.callFunction({
            name: 'adminBatchProducts',
            data: { action: 'delete', ids }
          });
          wx.hideLoading();
          if (result.result.code === 0) {
            wx.showToast({ title: `已删除${ids.length}个产品`, icon: 'success' });
            this.exitBatchMode();
            this.loadProducts();
          } else {
            wx.showToast({ title: result.result.msg || '删除失败', icon: 'none' });
          }
        } catch (err) {
          wx.hideLoading();
          wx.showToast({ title: '网络错误', icon: 'none' });
        }
      }
    });
  },

  onBatchEdit() {
    const ids = Object.keys(this.data.selectedIds);
    if (ids.length === 0) {
      wx.showToast({ title: '请先选择产品', icon: 'none' });
      return;
    }
    this.setData({
      showBatchForm: true,
      batchForm: { category: '', unit: '', status: '' }
    });
  },

  onCancelBatchForm() {
    this.setData({ showBatchForm: false });
  },

  onBatchCategoryChange(e) {
    this.setData({ 'batchForm.category': this.data.batchCategories[e.detail.value] });
  },

  onBatchUnitChange(e) {
    this.setData({ 'batchForm.unit': this.data.batchUnits[e.detail.value] });
  },

  onBatchStatusChange(e) {
    const statusMap = { 0: '', 1: 'sufficient', 2: 'low', 3: 'out' };
    this.setData({ 'batchForm.status': statusMap[e.detail.value] || '' });
  },

  async onSaveBatchEdit() {
    const { category, unit, status } = this.data.batchForm;
    if (!category && !unit && !status) {
      wx.showToast({ title: '请至少选择一个要修改的字段', icon: 'none' });
      return;
    }

    const ids = Object.keys(this.data.selectedIds);
    const app = getApp();

    if (app.globalData.demoMode) {
      const updateData = {};
      if (category) updateData.category = category;
      if (unit) updateData.unit = unit;
      if (status) updateData.status = status;

      const products = this.data.products.map(p => {
        if (this.data.selectedIds[p._id]) {
          return { ...p, ...updateData };
        }
        return p;
      });
      demoStore.setAll(demoStore.KEYS.products, products);
      wx.showToast({ title: `已更新${ids.length}个产品`, icon: 'success' });
      this.setData({ showBatchForm: false });
      this.exitBatchMode();
      this.loadProducts();
      return;
    }

    wx.showLoading({ title: `更新${ids.length}个产品...` });
    try {
      const data = { action: 'update', ids };
      if (category) data.category = category;
      if (unit) data.unit = unit;
      if (status) data.status = status;

      const result = await wx.cloud.callFunction({
        name: 'adminBatchProducts',
        data
      });
      wx.hideLoading();
      if (result.result.code === 0) {
        wx.showToast({ title: `已更新${ids.length}个产品`, icon: 'success' });
        this.setData({ showBatchForm: false });
        this.exitBatchMode();
        this.loadProducts();
      } else {
        wx.showToast({ title: result.result.msg || '更新失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '网络错误', icon: 'none' });
    }
  },

  // 点击图片放大预览
  onListScroll(e) {
    this._lastScrollTop = e.detail.scrollTop;
  },

  // 点击图片放大预览（自定义弹窗，避免 wx.previewImage 导致页面跳到顶部）
  onPreviewImage(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) return;
    const urls = this.data.filteredProducts
      .filter(p => p.image)
      .map(p => p.image);
    const allUrls = urls.length > 0 ? urls : [url];
    const idx = allUrls.indexOf(url);
    this.setData({
      showImagePreview: true,
      previewImageUrl: url,
      previewImageUrls: allUrls,
      previewImageIndex: idx >= 0 ? idx : 0
    });
  },

  onCloseImagePreview() {
    this.setData({ showImagePreview: false });
  },

  onPrevImage() {
    const { previewImageIndex, previewImageUrls } = this.data;
    if (previewImageIndex > 0) {
      const newIdx = previewImageIndex - 1;
      this.setData({
        previewImageIndex: newIdx,
        previewImageUrl: previewImageUrls[newIdx]
      });
    }
  },

  onNextImage() {
    const { previewImageIndex, previewImageUrls } = this.data;
    if (previewImageIndex < previewImageUrls.length - 1) {
      const newIdx = previewImageIndex + 1;
      this.setData({
        previewImageIndex: newIdx,
        previewImageUrl: previewImageUrls[newIdx]
      });
    }
  },

  onBackToOrders() {
    wx.redirectTo({ url: '/pages/admin/orders/orders' });
  },

  // ===== Excel/CSV 导入 =====
  onImport() {
    wx.showActionSheet({
      itemList: ['导入CSV文件（Excel可另存为CSV）', '导入Excel文件(.xlsx)'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.importCSV();
        } else {
          this.importExcel();
        }
      }
    });
  },

  importCSV() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['csv'],
      success: (res) => {
        const path = res.tempFiles[0].path;
        const fs = wx.getFileSystemManager();
        // Try UTF-8 first, then fall back
        const encodings = ['utf8', 'gbk'];
        const tryRead = (idx) => {
          if (idx >= encodings.length) {
            wx.showToast({ title: '无法读取文件编码', icon: 'none' });
            return;
          }
          fs.readFile({
            filePath: path,
            encoding: encodings[idx],
            success: (fileRes) => {
              let text;
              try {
                text = fileRes.data;
              } catch (e) {
                tryRead(idx + 1);
                return;
              }
              this.parseCSV(text);
            },
            fail: () => tryRead(idx + 1)
          });
        };
        tryRead(0);
      },
      fail: (err) => {
        if (err.errMsg.indexOf('cancel') === -1) {
          wx.showToast({ title: '请从聊天记录中选择CSV文件', icon: 'none' });
        }
      }
    });
  },

  importExcel() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['xlsx', 'xls'],
      success: async (res) => {
        const app = getApp();

        if (app.globalData.demoMode) {
          wx.showToast({ title: '演示模式不支持Excel导入，请用CSV', icon: 'none' });
          return;
        }

        wx.showLoading({ title: '上传解析中...' });
        try {
          const cloudPath = 'temp/import_' + Date.now() + '.xlsx';
          const uploadRes = await wx.cloud.uploadFile({
            cloudPath,
            filePath: res.tempFiles[0].path
          });

          const cfRes = await wx.cloud.callFunction({
            name: 'importProducts',
            data: { fileID: uploadRes.fileID }
          });

          wx.hideLoading();
          if (cfRes.result.code === 0) {
            const { success, errors } = cfRes.result.data;
            let msg = `成功导入${success}个产品`;
            if (errors && errors.length > 0) {
              msg += `，${errors.length}行失败`;
            }
            wx.showModal({
              title: '导入完成',
              content: msg,
              showCancel: false,
              success: () => this.loadProducts()
            });
          } else {
            wx.showToast({ title: cfRes.result.msg || '导入失败', icon: 'none' });
          }
        } catch (err) {
          wx.hideLoading();
          wx.showToast({ title: '导入失败，请确认已部署importProducts云函数', icon: 'none' });
        }
      },
      fail: (err) => {
        if (err.errMsg.indexOf('cancel') === -1) {
          wx.showToast({ title: '请从聊天记录中选择Excel文件', icon: 'none' });
        }
      }
    });
  },

  parseCSV(text) {
    // 去除 UTF-8 BOM 头
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) {
      wx.showToast({ title: '文件为空或无数据行', icon: 'none' });
      return;
    }

    // Parse header
    const parseLine = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (ch === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
      result.push(current.trim());
      return result;
    };

    const header = parseLine(lines[0]);
    const nameIdx = header.findIndex(h => h === '名称' || h === 'name');
    const catIdx = header.findIndex(h => h === '分类' || h === 'category');
    const priceIdx = header.findIndex(h => h.includes('单价') || h === '销售价' || h === 'price');
    const unitIdx = header.findIndex(h => h === '单位' || h === 'unit');
    const stockIdx = header.findIndex(h => h === '库存' || h === '盘点库存数量' || h === 'stock');
    const descIdx = header.findIndex(h => h === '描述' || h === '商品备注' || h === 'description');
    const imgIdx = header.findIndex(h => h === '图片' || h === '图片链接' || h === '商品图片链接' || h === 'image');

    if (nameIdx === -1 || priceIdx === -1) {
      wx.showModal({
        title: '表头错误',
        content: 'CSV第一行必须包含"名称"和"单价"列（或name、price）。\n\n示例：\n名称,分类,单价,单位,库存,描述\n色丁布,色丁,12.5,米,1000,',
        showCancel: false
      });
      return;
    }

    const app = getApp();
    let imported = 0;
    let skipped = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = parseLine(lines[i]);
      const name = (cols[nameIdx] || '').replace(/^"|"$/g, '').trim();
      const price = parseFloat(cols[priceIdx]);
      if (!name || isNaN(price) || price <= 0) {
        skipped++;
        continue;
      }

      const productData = {
        _id: 'p' + Date.now() + '_' + i,
        name,
        category: catIdx >= 0 ? (cols[catIdx] || '其他') : '其他',
        price: Math.round(price * 100),
        unit: unitIdx >= 0 ? (cols[unitIdx] || '米') : '米',
        stock: stockIdx >= 0 ? (parseInt(cols[stockIdx]) || 0) : 0,
        description: descIdx >= 0 ? (cols[descIdx] || '') : '',
        image: imgIdx >= 0 ? (cols[imgIdx] || '') : '',
        createdAt: Date.now()
      };

      if (app.globalData.demoMode) {
        app.globalData.demoProducts.unshift(productData);
        demoStore.setAll(demoStore.KEYS.products, [...app.globalData.demoProducts]);
      } else {
        // Non-demo: save to cloud directly
        this.saveImportedProduct(productData);
      }
      imported++;
    }

    if (app.globalData.demoMode) {
      const msg = skipped > 0 ? `已导入${imported}个产品，${skipped}行跳过` : `已导入${imported}个产品`;
      wx.showToast({ title: msg, icon: 'success' });
    } else {
      const msg = skipped > 0 ? `已提交${imported}个产品导入，${skipped}行跳过` : `已提交${imported}个产品导入`;
      wx.showToast({ title: msg, icon: 'success' });
    }
    this.loadProducts();
  },

  async saveImportedProduct(data) {
    try {
      await wx.cloud.callFunction({
        name: 'adminAddProduct',
        data: {
          name: data.name,
          category: data.category,
          price: data.price / 100,
          unit: data.unit,
          stock: data.stock,
          description: data.description
        }
      });
    } catch (err) {
      // Continue with next product on error
    }
  },

  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value, listScrollTop: 0 });
    this.filterProducts();
  },

  onClearSearch() {
    this.setData({ searchKeyword: '', listScrollTop: 0 });
    this.filterProducts();
  },

  filterProducts() {
    const { products, searchKeyword, filterMode } = this.data;
    let list = products;

    // 缺货预警模式：仅显示缺货/紧张商品，缺货排最前
    if (filterMode === 'shortage') {
      list = list.filter(p => p.status === 'out' || p.status === 'low');
      list.sort((a, b) => {
        if (a.status === 'out' && b.status !== 'out') return -1;
        if (a.status !== 'out' && b.status === 'out') return 1;
        return (a.name || '').localeCompare(b.name || '', undefined, { numeric: true });
      });
    }

    if (searchKeyword) {
      const kw = searchKeyword.toLowerCase();
      list = list.filter(p =>
        (p.name || '').toLowerCase().includes(kw) ||
        (p.category || '').toLowerCase().includes(kw)
      );
    }

    this.setData({ filteredProducts: list });
  }
});
