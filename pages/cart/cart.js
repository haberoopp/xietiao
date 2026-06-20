Page({
  data: {
    cartItems: [],
    totalAmount: 0,
    allChecked: true
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
    this.loadCart();
  },

  loadCart() {
    const app = getApp();
    const cart = app.globalData.cart || [];
    const cartItems = cart.map(item => ({
      ...item,
      checked: true,
      priceText: (item.price / 100).toFixed(2),
      subtotal: (item.price * item.quantity / 100).toFixed(2)
    }));
    this.setData({ cartItems });
    this.calcTotal();
  },

  calcTotal() {
    const items = this.data.cartItems.filter(item => item.checked);
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    this.setData({ totalAmount: (total / 100).toFixed(2) });
  },

  onToggleCheck(e) {
    const index = e.currentTarget.dataset.index;
    const cartItems = this.data.cartItems;
    cartItems[index].checked = !cartItems[index].checked;
    const allChecked = cartItems.every(item => item.checked);
    this.setData({ cartItems, allChecked });
    this.calcTotal();
  },

  onToggleAll() {
    const allChecked = !this.data.allChecked;
    const cartItems = this.data.cartItems.map(item => ({ ...item, checked: allChecked }));
    this.setData({ cartItems, allChecked });
    this.calcTotal();
  },

  onMinus(e) {
    const index = e.currentTarget.dataset.index;
    const cartItems = this.data.cartItems;
    if (cartItems[index].quantity > 1) {
      cartItems[index].quantity--;
      cartItems[index].subtotal = (cartItems[index].price * cartItems[index].quantity / 100).toFixed(2);
      this.setData({ cartItems });
      this.saveCart();
      this.calcTotal();
    }
  },

  onPlus(e) {
    const index = e.currentTarget.dataset.index;
    const cartItems = this.data.cartItems;
    cartItems[index].quantity++;
    cartItems[index].subtotal = (cartItems[index].price * cartItems[index].quantity / 100).toFixed(2);
    this.setData({ cartItems });
    this.saveCart();
    this.calcTotal();
  },

  onQtyInput(e) {
    const index = e.currentTarget.dataset.index;
    let val = parseInt(e.detail.value, 10);
    if (isNaN(val) || val < 1) val = 1;
    const cartItems = this.data.cartItems;
    cartItems[index].quantity = val;
    cartItems[index].subtotal = (cartItems[index].price * val / 100).toFixed(2);
    this.setData({ cartItems });
    this.saveCart();
    this.calcTotal();
  },

  onDelete(e) {
    const index = e.currentTarget.dataset.index;
    wx.showModal({
      title: '提示',
      content: '确定要删除该商品吗？',
      success: (res) => {
        if (res.confirm) {
          const cartItems = this.data.cartItems;
          cartItems.splice(index, 1);
          this.setData({ cartItems });
          this.saveCart();
          this.calcTotal();
        }
      }
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
    // 同步更新导航栏购物车角标
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().updateCartBadge();
    }
  },

  onCheckout() {
    const checkedItems = this.data.cartItems.filter(item => item.checked);
    if (checkedItems.length === 0) {
      wx.showToast({ title: '请选择商品', icon: 'none' });
      return;
    }
    wx.setStorageSync('checkoutItems', checkedItems);
    wx.navigateTo({ url: '/pages/checkout/checkout' });
  }
});
