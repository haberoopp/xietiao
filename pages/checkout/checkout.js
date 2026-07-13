const util = require('../../utils/util');

Page({
  data: {
    items: [],
    totalAmount: '0.00',
    customerPriceMap: {},
    matchedCustomer: null,
    savedAddresses: [],
    selectedAddress: null,
    saveAddress: true,
    currentLocation: null,
    pickedLocation: null,
    deliveryMethod: 'delivery',
    editingOrderId: '',
    form: {
      customerName: '',
      phone: '',
      address: '',
      remark: '',
      logisticsCompany: ''
    }
  },

  onLoad(options) {
    const app = getApp();
    let items = [];

    // 修改订单模式
    if (options.editOrder && app.globalData.editOrder) {
      const order = app.globalData.editOrder;
      items = (order.items || []).map(item => ({
        _id: item.productId,
        name: item.name,
        price: item.price,
        unit: item.unit,
        quantity: item.quantity,
        image: item.image || ''
      }));
      this.setData({
        deliveryMethod: order.deliveryMethod || 'delivery',
        'form.customerName': order.customerName || '',
        'form.phone': order.phone || '',
        'form.address': order.address || '',
        'form.remark': order.remark || '',
        editingOrderId: order._id
      });
      app.globalData.editOrder = null;
    } else {
      items = wx.getStorageSync('checkoutItems') || [];
    }

    // 从添加商品/地址选择返回：恢复表单状态
    const state = app.globalData.checkoutState;
    if (state) {
      this.setData({
        deliveryMethod: state.deliveryMethod || 'delivery',
        'form.customerName': state.customerName || '',
        'form.phone': state.phone || '',
        'form.address': state.address || '',
        'form.remark': state.remark || '',
        'form.logisticsCompany': state.logisticsCompany || '',
        editingOrderId: state.editingOrderId || this.data.editingOrderId || '',
        customerPriceMap: state.customerPriceMap || {},
        matchedCustomer: state.matchedCustomer || null
      });
      app.globalData.checkoutState = null;
    }

    // 从地址选择页返回：应用选中的地址
    if (app.globalData.selectedAddressData) {
      this.applyAddress(app.globalData.selectedAddressData);
      app.globalData.selectedAddressData = null;
    }

    this.setData({ items: this.formatItems(items) });
    this.calcTotal();
    this.loadSavedAddresses();
    wx.getLocation({
      type: 'gcj02',
      success: (res) => this.setData({ currentLocation: { lat: res.latitude, lng: res.longitude } }),
      fail: () => this.setData({ currentLocation: { lat: 31.9545, lng: 121.0793 } })
    });
  },

  formatItems(items) {
    const priceMap = this.data.customerPriceMap || {};
    return items.map(item => {
      const finalPrice = priceMap[item._id] !== undefined ? priceMap[item._id] : item.price;
      return {
        ...item,
        priceText: (item.price / 100).toFixed(2),
        finalPrice: finalPrice,
        finalPriceText: (finalPrice / 100).toFixed(2),
        hasCustomPrice: priceMap[item._id] !== undefined,
        subtotal: (finalPrice * item.quantity / 100).toFixed(2)
      };
    });
  },

  calcTotal() {
    const total = this.data.items.reduce((sum, item) => {
      const p = item.finalPrice != null ? item.finalPrice : item.price;
      return sum + p * item.quantity;
    }, 0);
    this.setData({ totalAmount: (total / 100).toFixed(2) });
  },

  onIncrease(e) {
    const idx = e.currentTarget.dataset.index;
    const items = this.data.items;
    items[idx].quantity = Math.round((items[idx].quantity + 0.1) * 10) / 10;
    this.setData({ items: this.formatItems(items) });
    this.calcTotal();
  },

  onDecrease(e) {
    const idx = e.currentTarget.dataset.index;
    const items = this.data.items;
    if (items[idx].quantity <= 0.1) {
      wx.showModal({
        title: '删除商品',
        content: '确定要移除该商品吗？',
        success: (res) => {
          if (res.confirm) {
            items.splice(idx, 1);
            this.setData({ items: this.formatItems(items) });
            this.calcTotal();
          }
        }
      });
      return;
    }
    items[idx].quantity -= 1;
    this.setData({ items: this.formatItems(items) });
    this.calcTotal();
  },

  onQtyInput(e) {
    const idx = e.currentTarget.dataset.index;
    let val = parseFloat(e.detail.value);
    if (isNaN(val) || val <= 0) val = 0.1;
    const items = this.data.items;
    items[idx].quantity = val;
    this.setData({ items: this.formatItems(items) });
    this.calcTotal();
  },

  onRemoveItem(e) {
    const idx = e.currentTarget.dataset.index;
    const items = this.data.items;
    items.splice(idx, 1);
    this.setData({ items: this.formatItems(items) });
    this.calcTotal();
  },

  onAddProduct() {
    // 首页是Tab页面，不能用navigateTo，保存状态切换过去
    const app = getApp();
    app.globalData.checkoutState = {
      deliveryMethod: this.data.deliveryMethod,
      customerName: this.data.form.customerName,
      phone: this.data.form.phone,
      address: this.data.form.address,
      remark: this.data.form.remark,
      logisticsCompany: this.data.form.logisticsCompany,
      editingOrderId: this.data.editingOrderId,
      customerPriceMap: this.data.customerPriceMap,
      matchedCustomer: this.data.matchedCustomer
    };
    // 用结算页商品替换购物车（保留用户修改过的数量）
    const cart = this.data.items.map(item => ({
      _id: item._id,
      name: item.name,
      price: item.price,
      unit: item.unit,
      image: item.image,
      quantity: item.quantity
    }));
    app.globalData.cart = cart;
    wx.setStorageSync('cart', cart);
    wx.switchTab({ url: '/pages/index/index' });
  },

  onShow() {
    this.loadSavedAddresses();
    // 从地址选择页返回：应用选中的地址
    const app = getApp();
    if (app.globalData.selectedAddressData) {
      this.applyAddress(app.globalData.selectedAddressData);
      app.globalData.selectedAddressData = null;
    }
  },

  async loadSavedAddresses() {
    const app = getApp();

    if (app.globalData.demoMode) {
      const addresses = wx.getStorageSync('addresses') || [];
      this.setData({ savedAddresses: addresses });
      // 自动填充默认地址
      const defaultAddr = addresses.find(a => a.isDefault);
      if (defaultAddr && !this.data.form.customerName) {
        this.applyAddress(defaultAddr);
      }
      return;
    }

    try {
      const res = await wx.cloud.callFunction({ name: 'addressCRUD', data: { action: 'list' } });
      if (res.result.code === 0) {
        const addresses = res.result.data.list;
        this.setData({ savedAddresses: addresses });
        const defaultAddr = addresses.find(a => a.isDefault);
        if (defaultAddr && !this.data.form.customerName) {
          this.applyAddress(defaultAddr);
        }
      }
    } catch (err) {
      // 静默失败
    }
  },

  applyAddress(addr) {
    const fullAddr = addr.addressDetail ? addr.address + ' ' + addr.addressDetail : addr.address;
    this.setData({
      selectedAddress: { ...addr, fullAddress: fullAddr },
      pickedLocation: addr.location || null,
      form: {
        ...this.data.form,
        customerName: addr.name,
        phone: addr.phone,
        address: fullAddr
      }
    });
    // 选择地址后也匹配客户折扣
    if (addr.phone && addr.phone.length >= 11) {
      this.matchCustomer(addr.phone);
    }
  },

  goAddressSelect() {
    const app = getApp();
    app.globalData.checkoutState = {
      deliveryMethod: this.data.deliveryMethod,
      customerName: this.data.form.customerName,
      phone: this.data.form.phone,
      address: this.data.form.address,
      remark: this.data.form.remark,
      logisticsCompany: this.data.form.logisticsCompany,
      editingOrderId: this.data.editingOrderId,
      customerPriceMap: this.data.customerPriceMap,
      matchedCustomer: this.data.matchedCustomer
    };
    wx.navigateTo({ url: '/pages/address/select' });
  },

  onDeliveryChange(e) {
    this.setData({ deliveryMethod: e.currentTarget.dataset.method });
  },

  toggleSaveAddr() {
    this.setData({ saveAddress: !this.data.saveAddress });
  },

  async onChooseLocation() {
    const { currentLocation } = this.data;
    const result = await new Promise((resolve) => {
      wx.chooseLocation({
        latitude: currentLocation ? currentLocation.lat : 31.9545,
        longitude: currentLocation ? currentLocation.lng : 121.0793,
        success: (res) => resolve({
          name: res.name || '',
          address: res.address || res.name || '',
          lat: res.latitude,
          lng: res.longitude
        }),
        fail: (err) => {
          if (err.errMsg.includes('cancel')) resolve(null);
          else { wx.showToast({ title: '定位失败，请授权位置权限', icon: 'none' }); resolve(null); }
        }
      });
    });
    if (result) {
      this.setData({
        'form.address': result.address || result.name,
        selectedAddress: null,
        pickedLocation: result.lat ? { lat: result.lat, lng: result.lng } : null
      });
    }
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    const data = { ['form.' + field]: value };
    if (field === 'customerName' || field === 'phone' || field === 'address') {
      data.selectedAddress = null;
    }
    if (field === 'address') data.pickedLocation = null;
    this.setData(data);
    // 手机号变化时防抖匹配客户折扣
    if (field === 'phone') {
      if (value.length >= 11) {
        if (this._matchTimer) clearTimeout(this._matchTimer);
        this._matchTimer = setTimeout(() => this.matchCustomer(value), 500);
      } else if (this.data.matchedCustomer) {
        this.setData({ customerPriceMap: {}, matchedCustomer: null });
        this.setData({ items: this.formatItems(this.data.items) });
        this.calcTotal();
      }
    }
  },

  // 根据手机号匹配客户专属价
  async matchCustomer(phone) {
    const app = getApp();

    let custData = null;
    let priceList = [];

    if (app.globalData.demoMode) {
      const customers = wx.getStorageSync('customers') || [];
      custData = customers.find(c => c.phone === phone) || null;
      const prices = wx.getStorageSync('customerPrices') || [];
      priceList = prices.filter(p => p.customerPhone === phone);
    } else {
      try {
        const [custRes, priceRes] = await Promise.all([
          wx.cloud.callFunction({ name: 'customerCRUD', data: { action: 'getByPhone', phone } }),
          wx.cloud.callFunction({ name: 'customerPriceCRUD', data: { action: 'getByPhone', phone } })
        ]);
        if (custRes.result && custRes.result.code === 0 && custRes.result.data) {
          custData = custRes.result.data.record;
        }
        if (priceRes.result && priceRes.result.code === 0 && priceRes.result.data) {
          priceList = priceRes.result.data.list || [];
        }
      } catch (err) {
        return;
      }
    }

    if (custData) {
      const priceMap = {};
      priceList.forEach(p => { priceMap[p.productId] = p.customPrice; });
      this.setData({ matchedCustomer: custData, customerPriceMap: priceMap });
      this.setData({ items: this.formatItems(this.data.items) });
      this.calcTotal();
    }
  },

  // 保存地址到地址簿
  async saveCurrentAddress(app) {
    const { customerName, phone, address } = this.data.form;
    if (!customerName || !phone || !address) return;

    const newAddr = {
      name: customerName.trim(),
      phone: phone.trim(),
      address: address.trim(),
      location: this.data.pickedLocation || undefined
    };

    if (app.globalData.demoMode) {
      const addresses = wx.getStorageSync('addresses') || [];
      // 检查是否已存在相同地址
      const exists = addresses.find(a =>
        a.name === newAddr.name && a.phone === newAddr.phone && a.address === newAddr.address
      );
      if (!exists) {
        const isFirst = addresses.length === 0;
        addresses.push({
          _id: 'a' + Date.now(),
          ...newAddr,
          isDefault: isFirst,
          createdAt: Date.now()
        });
        wx.setStorageSync('addresses', addresses);
      }
      return;
    }

    try {
      // 先查询是否已存在相同地址，避免重复
      const listRes = await wx.cloud.callFunction({
        name: 'addressCRUD',
        data: { action: 'list' }
      });
      if (listRes.result && listRes.result.code === 0) {
        const exists = (listRes.result.data.list || []).find(a =>
          a.name === newAddr.name && a.phone === newAddr.phone && a.address === newAddr.address
        );
        if (exists) return;
      }

      await wx.cloud.callFunction({
        name: 'addressCRUD',
        data: { action: 'add', ...newAddr, location: this.data.pickedLocation || undefined }
      });
    } catch (err) {
      // 静默失败
    }
  },

  async onSubmit() {
    const { customerName, phone, address } = this.data.form;

    if (!customerName.trim()) {
      wx.showToast({ title: '请填写姓名或公司名称', icon: 'none' });
      return;
    }
    if (!util.isValidPhone(phone)) {
      wx.showToast({ title: '请填写正确的手机号', icon: 'none' });
      return;
    }
    if (!address.trim()) {
      wx.showToast({ title: '请填写地址', icon: 'none' });
      return;
    }
    if (this.data.deliveryMethod === 'logistics' && !(this.data.form.logisticsCompany || '').trim()) {
      wx.showToast({ title: '请填写物流公司名称', icon: 'none' });
      return;
    }
    if (this.data.items.length === 0) {
      wx.showToast({ title: '请选择商品', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '提交中...' });

    const orderData = {
      customerName: customerName.trim(),
      phone: phone.trim(),
      address: address.trim(),
      remark: this.data.form.remark.trim(),
      items: this.data.items.map(item => ({
        productId: item._id,
        name: item.name,
        price: item.finalPrice != null ? item.finalPrice : item.price,
        quantity: item.quantity,
        unit: item.unit
      })),
      totalAmount: Math.round(parseFloat(this.data.totalAmount) * 100),
      deliveryMethod: this.data.deliveryMethod,
      logisticsCompany: this.data.deliveryMethod === 'logistics' ? (this.data.form.logisticsCompany || '').trim() : '',
      status: 'processing',
      payment_status: 'unpaid',
      paid_amount: 0,
      location: this.data.pickedLocation || undefined,
      createdAt: new Date().toISOString()
    };

    const app = getApp();

    // 修改订单：直接更新原订单
    if (this.data.editingOrderId) {
      await this.updateExistingOrder(app, orderData);
      return;
    }

    if (app.globalData.demoMode) {
      orderData._id = 'o' + Date.now();
      app.globalData.demoOrders.unshift(orderData);
      wx.setStorageSync('demo_orders', app.globalData.demoOrders);
      // 提交成功后保存地址和客户
      if (this.data.saveAddress) await this.saveCurrentAddress(app);
      await this.saveCustomer(app, customerName.trim(), phone.trim(), parseFloat(this.data.totalAmount) * 100);
      this.afterSubmit(app);
      return;
    }

    try {
      const res = await wx.cloud.callFunction({ name: 'submitOrder', data: orderData });
      if (res.result.code === 0) {
        // 提交成功后保存地址和客户
        if (this.data.saveAddress) await this.saveCurrentAddress(app);
        await this.saveCustomer(app, customerName.trim(), phone.trim(), parseFloat(this.data.totalAmount) * 100);
        this.afterSubmit(app);
      } else {
        wx.hideLoading();
        wx.showToast({ title: res.result.msg || '提交失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '网络错误，请重试', icon: 'none' });
    }
  },

  async updateExistingOrder(app, orderData) {
    const orderId = this.data.editingOrderId;

    if (app.globalData.demoMode) {
      const update = (list) => {
        const order = list.find(o => o._id === orderId);
        if (order) {
          const keepCreatedAt = order.createdAt;
          Object.assign(order, orderData);
          order.createdAt = keepCreatedAt;
        }
      };
      update(app.globalData.demoOrders);
      const saved = wx.getStorageSync('demo_orders') || [];
      update(saved);
      wx.setStorageSync('demo_orders', saved);
      wx.hideLoading();
      wx.showModal({
        title: '修改成功',
        content: '订单信息已更新！',
        showCancel: false,
        success: () => {
          wx.redirectTo({ url: '/pages/orders/orders' });
        }
      });
      return;
    }

    try {
      const res = await wx.cloud.callFunction({
        name: 'updateOrder', data: { orderId, ...orderData }
      });
      wx.hideLoading();
      if (res.result.code === 0) {
        wx.showModal({
          title: '修改成功',
          content: '订单信息已更新！',
          showCancel: false,
          success: () => {
            wx.redirectTo({ url: '/pages/orders/orders' });
          }
        });
      } else {
        wx.showToast({ title: res.result.msg || '修改失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '网络错误，请重试', icon: 'none' });
    }
  },

  // 下单后自动录入/更新客户
  async saveCustomer(app, name, phone, orderAmount) {
    if (app.globalData.demoMode) {
      let customers = wx.getStorageSync('customers') || [];
      const existing = customers.find(c => c.phone === phone);
      if (existing) {
        existing.totalOrders = (existing.totalOrders || 0) + 1;
        existing.totalAmount = (existing.totalAmount || 0) + Math.round(orderAmount);
        if (name && existing.name !== name) existing.name = name;
      } else {
        customers.push({
          _id: 'c' + Date.now(),
          name: name,
          phone: phone,
          discount: 1.0,
          totalOrders: 1,
          totalAmount: Math.round(orderAmount),
          createdAt: Date.now()
        });
      }
      wx.setStorageSync('customers', customers);
      return;
    }

    try {
      await wx.cloud.callFunction({
        name: 'customerCRUD',
        data: { action: 'upsert', name, phone, orderAmount }
      });
    } catch (err) {
      // 静默失败，不影响下单
    }
  },

  afterSubmit(app) {
    wx.hideLoading();
    const cart = app.globalData.cart || [];
    const checkoutIds = this.data.items.map(i => i._id);
    app.globalData.cart = cart.filter(c => !checkoutIds.includes(c._id));
    wx.setStorageSync('cart', app.globalData.cart);
    wx.removeStorageSync('checkoutItems');
    app.globalData.checkoutState = null;

    // 如果用户之前已经处理过订阅（无论接受还是拒绝），不再重复询问
    if (wx.getStorageSync('subscriptionPrompted')) {
      wx.redirectTo({ url: '/pages/orders/orders' });
      return;
    }

    wx.showModal({
      title: '下单成功',
      content: '您的订单已提交！\n\n开启订单通知，第一时间掌握订单状态变更。\n\n💡 建议勾选「总是保持以上选择」，后续自动接收通知，不再弹窗打扰。',
      confirmText: '开启通知',
      cancelText: '暂不',
      success: (res) => {
        wx.setStorageSync('subscriptionPrompted', true);
        if (res.confirm) {
          this.requestCustomerSubscription(() => {
            wx.redirectTo({ url: '/pages/orders/orders' });
          });
        } else {
          wx.redirectTo({ url: '/pages/orders/orders' });
        }
      }
    });
  },

  // 点击图片放大预览
  onPreviewImage(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) return;
    const urls = this.data.items
      .filter(item => item.image)
      .map(item => item.image);
    const that = this;
    wx.createSelectorQuery().selectViewport().scrollOffset(function(res) {
      that._savedScrollTop = (res && res.scrollTop) || 0;
      wx.previewImage({
        current: url,
        urls: urls.length > 0 ? urls : [url],
        complete: () => {
          if (that._savedScrollTop > 0) {
            wx.pageScrollTo({ scrollTop: that._savedScrollTop, duration: 0 });
          }
        }
      });
    }).exec();
  },

  requestCustomerSubscription(callback) {
    const constants = require('../../utils/constants');
    wx.requestSubscribeMessage({
      tmplIds: constants.NOTIFY_TEMPLATES.CUSTOMER,
      success: function(res) {
        console.log('Customer subscription result:', res);
      },
      fail: function(err) {
        console.warn('requestSubscribeMessage failed:', err);
      },
      complete: function() {
        if (callback) callback();
      }
    });
  }
});
