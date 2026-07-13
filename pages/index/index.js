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
    purchaseFilter: 'all',
    purchasedProductIds: [],
    showQtyModal: false,
    qtyProduct: {},
    qtyValue: 1,
    qtyInputFocus: false,
    exchangeMode: false,
    listScrollTop: 0,
    showImagePreview: false,
    previewImageUrl: '',
    previewImageUrls: [],
    previewImageIndex: 0
  },

  onLoad() {
    // loadProducts 由 onShow 统一触发，避免 onLoad + onShow 双重请求
  },

  onShareAppMessage() {
    return {
      title: '送货单 - 快速下单，高效配送',
      path: '/pages/index/index'
    };
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
    // 始终拉取数据（数据对比在 loadProducts 内部，未变化则跳过 setData 避免滚动重置）
    this.loadProducts();
    this.loadPurchaseHistory();
  },

  onPullDownRefresh() {
    this.setData({ keyword: '', listScrollTop: 0 });
    this.loadProducts().then(() => wx.stopPullDownRefresh());
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
    this.refreshTabBadge();
  },

  refreshTabBadge() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().updateCartBadge();
    }
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

  // 加载购买历史（提取已购商品ID集合）
  async loadPurchaseHistory() {
    const app = getApp();
    let orders = [];

    if (app.globalData.demoMode) {
      // 演示模式：读取所有订单（演示数据量小，直接全取）
      orders = demoStore.getAll(demoStore.KEYS.orders);
    } else {
      try {
        const res = await wx.cloud.callFunction({
          name: 'getMyOrders',
          data: { page: 1, pageSize: 500 }
        });
        if (res.result && res.result.code === 0) {
          orders = res.result.data.list || [];
        }
      } catch (err) {
        // 静默失败，买过滤镜不可用
        return;
      }
    }

    // 提取所有订单中的产品ID（去重）
    const idSet = new Set();
    orders.forEach(order => {
      (order.items || order.products || []).forEach(item => {
        const pid = item._id || item.productId || item.id;
        if (pid) idSet.add(pid);
      });
    });
    this.setData({ purchasedProductIds: Array.from(idSet) });
  },

  // 全部 / 买过 切换
  onPurchaseFilter(e) {
    const filter = e.currentTarget.dataset.filter;
    this.setData({ purchaseFilter: filter, listScrollTop: 0 });
    this.filterProducts();
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
    this.setData({ keyword: '', listScrollTop: 0 });
    this.filterProducts();
  },

  filterProducts() {
    // 使用缓存的完整产品列表，避免 this.data.allProducts 被意外覆盖
    const allProducts = this._cachedAllProducts || this.data.allProducts || [];
    const { keyword, activeCategory, purchaseFilter, purchasedProductIds } = this.data;
    let products = [...allProducts]; // 浅拷贝，避免引用问题

    if (keyword && keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      products = products.filter(p => (p.name || '').toLowerCase().includes(kw));
    }
    if (activeCategory !== '全部') {
      products = products.filter(p => p.category === activeCategory);
    }
    if (purchaseFilter === 'bought' && purchasedProductIds.length > 0) {
      products = products.filter(p => purchasedProductIds.includes(p._id));
    } else if (purchaseFilter === 'bought' && purchasedProductIds.length === 0) {
      products = [];
    }

    this.setData({ products: products.map(p => ({ ...p, priceText: (p.price / 100).toFixed(2) })) });
  },

  onCategoryTap(e) {
    const category = e.currentTarget.dataset.category;
    this.setData({ activeCategory: category, listScrollTop: 0 });
    this.filterProducts();
  },

  async loadProducts() {
    const app = getApp();

    if (app.globalData.demoMode) {
      const products = demoStore.getAll(demoStore.KEYS.products).map(p => ({
        ...p, priceText: (p.price / 100).toFixed(2)
      })).sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true }));
      this._cachedProducts = products;
      this._cachedAllProducts = products;
      this._lastProductsData = JSON.stringify(products);
      this.setData({ products, allProducts: products, loading: false });
      this.filterProducts();
      return;
    }

    // 1. 缓存优先：瞬间显示上次数据
    let fromCache = false;
    const cached = wx.getStorageSync('cache_index_products');
    if (cached && cached.length > 0) {
      this._cachedProducts = cached;
      this._cachedAllProducts = cached;
      this._lastProductsData = JSON.stringify(cached);
      this.setData({ products: cached, allProducts: cached, loading: false });
      this.filterProducts();
      fromCache = true;
    } else {
      this.setData({ loading: true });
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

      allProducts = allProducts
        .map(p => ({ ...p, priceText: (p.price / 100).toFixed(2) }))
        .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true }));

      // 数据未变化跳过更新
      const newDataStr = JSON.stringify(allProducts);
      if (this._lastProductsData === newDataStr) {
        this.setData({ loading: false });
        return;
      }

      // 更新缓存 + 界面
      wx.setStorage({ key: 'cache_index_products', data: allProducts });
      this._lastProductsData = newDataStr;
      this._cachedProducts = allProducts;
      this._cachedAllProducts = allProducts;
      this.setData({ products: allProducts, allProducts, loading: false });
      this.filterProducts();
      console.log(`✅ 已加载 ${allProducts.length} / ${total} 个产品` + (fromCache ? '（缓存秒开 + 后台更新）' : ''));
    } catch (err) {
      console.error('加载产品失败', err);
      if (!fromCache) wx.showToast({ title: '加载失败，请重试', icon: 'none' });
      this.setData({ loading: false });
    }
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
    if (this.data.qtyValue > 0.1) {
      const newVal = Math.max(0.1, this.data.qtyValue - 0.1);
      this.setData({ qtyValue: Math.round(newVal * 10) / 10 });
    }
  },

  onQtyPlus() {
    const newVal = Math.round((this.data.qtyValue + 0.1) * 10) / 10;
    this.setData({ qtyValue: newVal });
  },

  onQtyInput(e) {
    const val = parseFloat(e.detail.value);
    if (isNaN(val) || val <= 0) {
      this.setData({ qtyValue: 0.1 });
    } else {
      this.setData({ qtyValue: Math.round(val * 10) / 10 });
    }
  },

  onCancelQty() {
    this.setData({ showQtyModal: false, qtyInputFocus: false });
  },

  onConfirmQty() {
    const product = this.data.qtyProduct;
    const qty = Math.max(0.1, this.data.qtyValue);
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
    this.refreshTabBadge();
    wx.showToast({ title: `已添加 ${qty} ${product.unit}`, icon: 'success' });
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
    wx.navigateTo({ url: '/pages/orders/orders' });
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
  },

  // 跟踪 scroll-view 滚动位置
  onListScroll(e) {
    this._lastScrollTop = e.detail.scrollTop;
  },

  // 点击图片放大预览（自定义弹窗，避免 wx.previewImage 导致页面跳到顶部）
  onPreviewImage(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) return;
    const urls = this.data.products
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
});
