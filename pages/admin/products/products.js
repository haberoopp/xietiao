Page({
  data: {
    products: [],
    filteredProducts: [],
    searchKeyword: '',
    categories: ['色丁', '凉感丝', '丝纹', '全棉', '圆盘', '其他'],
    showForm: false,
    editingProduct: null,
    form: {
      name: '',
      category: '色丁',
      price: '',
      unit: '米',
      stock: '',
      description: '',
      image: ''
    }
  },

  onShow() {
    if (!getApp().globalData.adminLoggedIn && !wx.getStorageSync('adminLoggedIn')) {
      wx.switchTab({ url: '/pages/admin/login/login' });
      return;
    }
    // 仅厂长可管理产品
    const role = wx.getStorageSync('adminRole') || getApp().globalData.adminRole || '';
    if (role !== 'manager') {
      wx.showToast({ title: '仅厂长可管理产品', icon: 'none' });
      wx.redirectTo({ url: '/pages/admin/orders/orders' });
      return;
    }
    this.loadProducts();
  },

  onPullDownRefresh() {
    this.loadProducts().then(() => wx.stopPullDownRefresh());
  },

  async loadProducts() {
    const app = getApp();

    if (app.globalData.demoMode) {
      const products = (app.globalData.demoProducts || []).map(p => ({
        ...p,
        priceText: (p.price / 100).toFixed(2)
      }));
      this.setData({ products });
      this.filterProducts();
      return;
    }

    try {
      const res = await wx.cloud.callFunction({ name: 'getProducts', data: { pageSize: 200 } });
      if (res.result.code === 0) {
        const products = res.result.data.list.map(p => ({
          ...p,
          priceText: (p.price / 100).toFixed(2)
        }));
        this.setData({ products });
        this.filterProducts();
      }
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  onAdd() {
    this.setData({
      showForm: true,
      editingProduct: null,
      form: { name: '', category: '斜条', price: '', unit: '米', stock: '', description: '', image: '' }
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
        stock: String(product.stock || ''),
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
          app.globalData.demoProducts = app.globalData.demoProducts.filter(p => p._id !== product._id);
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
    const units = ['米', '卷', '个', '公斤', '包'];
    this.setData({ 'form.unit': units[e.detail.value] });
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
    const { name, category, price, unit, stock, description, image } = this.data.form;

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
      stock: parseInt(stock) || 0,
      description: description.trim(),
      image
    };

    const app = getApp();

    if (app.globalData.demoMode) {
      if (this.data.editingProduct) {
        const idx = app.globalData.demoProducts.findIndex(p => p._id === this.data.editingProduct._id);
        if (idx > -1) {
          app.globalData.demoProducts[idx] = { ...app.globalData.demoProducts[idx], ...productData };
        }
      } else {
        productData._id = 'p' + Date.now();
        productData.createdAt = Date.now();
        app.globalData.demoProducts.unshift(productData);
      }
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
    const priceIdx = header.findIndex(h => h.includes('单价') || h === 'price');
    const unitIdx = header.findIndex(h => h === '单位' || h === 'unit');
    const stockIdx = header.findIndex(h => h === '库存' || h === 'stock');
    const descIdx = header.findIndex(h => h === '描述' || h === 'description');

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
        image: '',
        createdAt: Date.now()
      };

      if (app.globalData.demoMode) {
        app.globalData.demoProducts.unshift(productData);
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
    this.setData({ searchKeyword: e.detail.value });
    this.filterProducts();
  },

  onClearSearch() {
    this.setData({ searchKeyword: '' });
    this.filterProducts();
  },

  filterProducts() {
    const { products, searchKeyword } = this.data;
    if (!searchKeyword) {
      this.setData({ filteredProducts: products });
      return;
    }
    const kw = searchKeyword.toLowerCase();
    this.setData({
      filteredProducts: products.filter(p =>
        (p.name || '').toLowerCase().includes(kw) ||
        (p.category || '').toLowerCase().includes(kw)
      )
    });
  }
});
