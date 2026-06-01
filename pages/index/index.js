const constants = require('../../utils/constants');
const demoStore = require('../../utils/demoStore');

Page({
  data: {
    categories: constants.PRODUCT_CATEGORIES_WITH_ALL,
    activeCategory: '全部',
    keyword: '',
    products: [],
    allProducts: [],
    loading: false,
    cartCount: 0,
    cartItems: [],
    cartTotal: '0.00',
    cartExpanded: false,
    showQtyModal: false,
    qtyProduct: {},
    qtyValue: 1,
    qtyInputFocus: false,
    exchangeMode: false,
    page: 1,
    pageSize: 20,
    hasMore: true,
    loadingMore: false
  },

  onLoad() {
    this.loadProducts();
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
    const app = getApp();
    if (app.globalData.exchangeMode) {
      this.setData({ exchangeMode: true });
      this.loadExchangeCart();
    } else {
      this.setData({ exchangeMode: false });
      this.loadCart();
    }
    if (this.data.products.length === 0) {
      this.loadProducts();
    }
  },

  onPullDownRefresh() {
    this.setData({ keyword: '', page: 1, hasMore: true });
    this.loadProducts().then(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.loadingMore) return;
    this.setData({ page: this.data.page + 1, loadingMore: true });
    this.loadProducts();
  },

  loadCart() {
    const app = getApp();
    const cart = app.globalData.cart || [];
    const cartItems = cart.map(item => ({
      ...item,
      priceText: (item.price / 100).toFixed(2)
    }));
    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    this.setData({
      cartItems,
      cartTotal: (total / 100).toFixed(2),
      cartCount: cart.length
    });
  },

  saveCart() {
    const cart = this.data.cartItems.map(item => ({
      _id: item._id,
      name: item.name,
      price: item.price,
      unit: item.unit,
      image: item.image,
      quantity: item.quantity
    }));
    const app = getApp();
    app.globalData.cart = cart;
    wx.setStorageSync('cart', cart);
  },

  updateCartCount() {
    const app = getApp();
    const cart = app.globalData.cart || [];
    this.setData({ cartCount: cart.reduce((sum, item) => sum + item.quantity, 0) });
  },

  // 搜索
  onSearchInput(e) {
    const keyword = e.detail.value;
    this.setData({ keyword });
    this.filterProducts();
  },

  onSearchConfirm() {
    this.filterProducts();
  },

  onClearSearch() {
    this.setData({ keyword: '' });
    this.filterProducts();
  },

  filterProducts() {
    const { keyword, activeCategory, allProducts } = this.data;
    let products = allProducts;

    if (keyword && keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      products = products.filter(p => p.name.toLowerCase().includes(kw));
    }
    if (activeCategory !== '全部') {
      products = products.filter(p => p.category === activeCategory);
    }

    this.setData({ products: products.map(p => ({ ...p, priceText: (p.price / 100).toFixed(2) })) });
  },

  onCategoryTap(e) {
    const category = e.currentTarget.dataset.category;
    this.setData({ activeCategory: category });
    this.filterProducts();
  },

  async loadProducts() {
    this.setData({ loading: true });
    const app = getApp();

    if (app.globalData.demoMode) {
      const { page, pageSize } = this.data;
      const source = demoStore.getAll(demoStore.KEYS.products);
      const start = (page - 1) * pageSize;
      const slice = source.slice(start, start + pageSize).map(p => ({
        ...p, priceText: (p.price / 100).toFixed(2)
      }));
      if (page === 1) {
        this.setData({ products: slice, allProducts: slice, loading: false, loadingMore: false, hasMore: start + pageSize < source.length });
      } else {
        const prodStart = this.data.products.length;
        const allStart = this.data.allProducts.length;
        const updates = {};
        slice.forEach((item, i) => {
          updates[`products[${prodStart + i}]`] = item;
          updates[`allProducts[${allStart + i}]`] = item;
        });
        updates.loading = false;
        updates.loadingMore = false;
        updates.hasMore = start + pageSize < source.length;
        this.setData(updates);
      }
      this.filterProducts();
      return;
    }

    try {
      const { page, pageSize } = this.data;
      const params = { page, pageSize };
      const res = await wx.cloud.callFunction({ name: 'getProducts', data: params });
      if (res.result.code === 0) {
        const newList = res.result.data.list.map(p => ({
          ...p,
          priceText: (p.price / 100).toFixed(2)
        }));
        const total = res.result.data.total || 0;
        if (page === 1) {
          this.setData({ products: newList, allProducts: newList, hasMore: newList.length < total });
        } else {
          const prodStart = this.data.products.length;
          const allStart = this.data.allProducts.length;
          const updates = {};
          newList.forEach((item, i) => {
            updates[`products[${prodStart + i}]`] = item;
            updates[`allProducts[${allStart + i}]`] = item;
          });
          updates.hasMore = newList.length >= pageSize;
          this.setData(updates);
        }
      }
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
    this.setData({ loadingMore: false });
    this.filterProducts();
    this.setData({ loading: false });
  },

  // 显示数量输入弹窗
  showQtyInput(e) {
    const product = e.currentTarget.dataset.product;
    if (product.status === 'out') {
      wx.showToast({ title: '该产品暂时缺货', icon: 'none' });
      return;
    }
    // 检查购物车中已有数量
    const app = getApp();
    const cart = app.globalData.cart || [];
    const exist = cart.find(item => item._id === product._id);
    this.setData({
      showQtyModal: true,
      qtyProduct: product,
      qtyValue: exist ? exist.quantity + 1 : 1,
      qtyInputFocus: true
    });
  },

  onQtyMinus() {
    if (this.data.qtyValue > 1) {
      this.setData({ qtyValue: this.data.qtyValue - 1 });
    }
  },

  onQtyPlus() {
    this.setData({ qtyValue: this.data.qtyValue + 1 });
  },

  onQtyInput(e) {
    const val = parseInt(e.detail.value) || 1;
    this.setData({ qtyValue: Math.max(1, val) });
  },

  onCancelQty() {
    this.setData({ showQtyModal: false, qtyInputFocus: false });
  },

  onConfirmQty() {
    const product = this.data.qtyProduct;
    const qty = Math.max(1, this.data.qtyValue);
    const app = getApp();
    const isExchange = this.data.exchangeMode;
    const cart = isExchange ? (app.globalData.exchangeCart || []) : (app.globalData.cart || []);
    const existIndex = cart.findIndex(item => item._id === product._id);

    if (existIndex > -1) {
      cart[existIndex].quantity += qty;
    } else {
      cart.push({
        _id: product._id,
        name: product.name,
        price: product.price,
        unit: product.unit,
        image: product.image,
        quantity: qty
      });
    }

    if (isExchange) {
      app.globalData.exchangeCart = cart;
    } else {
      app.globalData.cart = cart;
      wx.setStorageSync('cart', cart);
    }
    this.setData({ showQtyModal: false, qtyInputFocus: false });
    if (isExchange) {
      this.loadExchangeCart();
    } else {
      this.loadCart();
    }
    wx.showToast({ title: `已添加 ${qty} ${product.unit}`, icon: 'success' });
  },

  // 悬浮购物车
  onToggleCart() {
    this.setData({ cartExpanded: !this.data.cartExpanded });
  },

  onCartMinus(e) {
    const idx = e.currentTarget.dataset.index;
    const items = this.data.cartItems;
    if (items[idx].quantity > 1) {
      items[idx].quantity--;
      this.refreshCart(items);
    } else {
      items.splice(idx, 1);
      this.refreshCart(items);
    }
  },

  onCartPlus(e) {
    const idx = e.currentTarget.dataset.index;
    const items = this.data.cartItems;
    items[idx].quantity++;
    this.refreshCart(items);
  },

  onCartQtyInput(e) {
    const idx = e.currentTarget.dataset.index;
    let val = parseInt(e.detail.value, 10);
    if (isNaN(val) || val < 1) val = 1;
    const items = this.data.cartItems;
    items[idx].quantity = val;
    this.refreshCart(items);
  },

  onCartDelete(e) {
    const idx = e.currentTarget.dataset.index;
    const items = this.data.cartItems;
    items.splice(idx, 1);
    this.refreshCart(items);
    if (items.length === 0) {
      this.setData({ cartExpanded: false });
    }
  },

  refreshCart(items) {
    items.forEach(item => {
      item.priceText = (item.price / 100).toFixed(2);
    });
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    this.setData({
      cartItems: items,
      cartTotal: (total / 100).toFixed(2),
      cartCount: items.length
    });
    if (this.data.exchangeMode) {
      this.saveExchangeCart();
    } else {
      this.saveCart();
    }
  },

  // 换购模式：加载换购购物车
  loadExchangeCart() {
    const app = getApp();
    const cart = app.globalData.exchangeCart || [];
    const cartItems = cart.map(item => ({
      ...item,
      priceText: (item.price / 100).toFixed(2)
    }));
    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    this.setData({
      cartItems,
      cartTotal: (total / 100).toFixed(2),
      cartCount: cart.length
    });
  },

  // 换购模式：保存交换购物车
  saveExchangeCart() {
    const cart = this.data.cartItems.map(item => ({
      _id: item._id,
      name: item.name,
      price: item.price,
      unit: item.unit,
      image: item.image,
      quantity: item.quantity
    }));
    const app = getApp();
    app.globalData.exchangeCart = cart;
  },

  // 换购模式：取消
  onCancelExchange() {
    const app = getApp();
    app.globalData.exchangeMode = false;
    app.globalData.exchangeCart = null;
    app.globalData.exchangeDraft = null;
    this.setData({ exchangeMode: false });
    this.loadCart();
  },

  // 换购模式：完成选择，返回订单页
  onFinishExchange() {
    if (this.data.cartItems.length === 0) {
      wx.showToast({ title: '请至少选择一件换购商品', icon: 'none' });
      return;
    }
    this.saveExchangeCart();
    const app = getApp();
    app.globalData.exchangeMode = false;
    this.setData({ exchangeMode: false });
    wx.switchTab({ url: '/pages/orders/orders' });
  },

  onCartCheckout() {
    if (this.data.cartItems.length === 0) {
      wx.showToast({ title: this.data.exchangeMode ? '请选择换购商品' : '购物车为空', icon: 'none' });
      return;
    }
    if (this.data.exchangeMode) {
      this.onFinishExchange();
      return;
    }
    wx.setStorageSync('checkoutItems', this.data.cartItems);
    wx.navigateTo({ url: '/pages/checkout/checkout' });
  },

  goToCart() {
    wx.switchTab({ url: '/pages/cart/cart' });
  }
});
