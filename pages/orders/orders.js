const util = require('../../utils/util');

Page({
  data: {
    orders: [],
    loading: false,
    showReturnForm: false,
    returnOrderId: '',
    returnType: 'return',
    returnReason: '',
    returnItems: [],
    hasCheckedItem: false,
    exchangeItems: [],
    returnAmountText: '0.00',
    exchangeAmountText: '0.00',
    priceDiffText: ''
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
    this.loadOrders();
    // 从换购选择页返回时恢复弹窗
    const app = getApp();
    if (app.globalData.exchangeDraft) {
      const draft = app.globalData.exchangeDraft;
      const exchangeItems = (app.globalData.exchangeCart || []).map(item => ({
        ...item,
        priceText: (item.price / 100).toFixed(2),
        subtotalText: (item.price * item.quantity / 100).toFixed(2)
      }));
      const data = {
        showReturnForm: true,
        returnOrderId: draft.returnOrderId,
        returnType: 'exchange',
        returnReason: draft.returnReason || '',
        returnItems: draft.returnItems,
        hasCheckedItem: draft.hasCheckedItem,
        exchangeItems
      };
      this.setData(data);
      this.calcExchangePrice();
      app.globalData.exchangeDraft = null;
      app.globalData.exchangeCart = null;
      app.globalData.exchangeMode = false;
    }
  },

  onPullDownRefresh() {
    this.loadOrders().then(() => wx.stopPullDownRefresh());
  },

  async loadOrders() {
    this.setData({ loading: true });
    const app = getApp();

    if (app.globalData.demoMode) {
      const saved = wx.getStorageSync('demoOrders') || [];
      const returnReqs = wx.getStorageSync('returnRequests') || [];
      const allOrders = [...saved, ...(app.globalData.demoOrders || [])];
      const unique = [];
      const seen = new Set();
      allOrders.forEach(o => {
        if (!seen.has(o._id)) { seen.add(o._id); unique.push(o); }
      });
      const orders = unique.map(order => {
        const rr = returnReqs.find(r => r.orderId === order._id);
        const returnReq = rr || order.returnRequest || null;
        if (returnReq && returnReq.exchangeItems) {
          returnReq.exchangeItems = returnReq.exchangeItems.map(ei => ({
            ...ei,
            subtotalText: ((ei.price * ei.quantity) / 100).toFixed(2)
          }));
        }
        return {
          ...order,
          returnRequest: returnReq
            ? { type: returnReq.type, reason: returnReq.reason, status: returnReq.status, items: returnReq.items, exchangeItems: returnReq.exchangeItems, rejectionCount: returnReq.rejectionCount || 0, isRetry: returnReq.isRetry || false }
            : null,
          statusText: util.getOrderStatusText(order.status),
          totalText: (order.totalAmount / 100).toFixed(2),
          timeText: util.formatDate(order.createdAt),
          deliveryMethodText: util.getDeliveryMethodText(order.deliveryMethod),
          returnStatusText: rr ? util.getReturnStatusText(rr.status) : (order.returnRequest ? util.getReturnStatusText(order.returnRequest.status) : '')
        };
      });
      this.setData({ orders, loading: false });
      return;
    }

    try {
      const res = await wx.cloud.callFunction({ name: 'getMyOrders' });
      if (res.result.code === 0) {
        const orders = res.result.data.map(order => {
          const rr = order.returnRequest;
          if (rr && rr.exchangeItems) {
            rr.exchangeItems = rr.exchangeItems.map(ei => ({
              ...ei,
              subtotalText: ((ei.price * ei.quantity) / 100).toFixed(2)
            }));
          }
          return {
            ...order,
            statusText: util.getOrderStatusText(order.status),
            totalText: (order.totalAmount / 100).toFixed(2),
            timeText: util.formatDate(order.createdAt),
            deliveryMethodText: util.getDeliveryMethodText(order.deliveryMethod),
            returnStatusText: rr ? util.getReturnStatusText(rr.status) : ''
          };
        });
        this.setData({ orders });
      }
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
    this.setData({ loading: false });
  },

  // 取消订单
  onCancelOrder(e) {
    const order = e.currentTarget.dataset.order;
    wx.showModal({
      title: '确认取消',
      content: '确定要取消该订单吗？',
      success: async (res) => {
        if (!res.confirm) return;
        const app = getApp();

        if (app.globalData.demoMode) {
          if (order.returnRequest) {
            wx.showToast({ title: '该订单已有退换货申请，无法取消', icon: 'none' });
            return;
          }
          this.updateOrderStatus(order._id, 'cancelled');
        } else {
          try {
            const result = await wx.cloud.callFunction({
              name: 'cancelOrder', data: { orderId: order._id }
            });
            if (result.result.code === 0) {
              wx.showToast({ title: '已取消', icon: 'success' });
              this.loadOrders();
            } else {
              wx.showToast({ title: result.result.msg, icon: 'none' });
            }
          } catch (err) {
            wx.showToast({ title: '操作失败', icon: 'none' });
          }
        }
      }
    });
  },

  // 打开退换货表单
  onOpenReturn(e) {
    const order = e.currentTarget.dataset.order;
    const returnItems = (order.items || []).map(item => ({
      ...item,
      priceText: (item.price / 100).toFixed(2),
      checked: true,
      returnQty: item.quantity
    }));
    this.setData({
      showReturnForm: true,
      returnOrderId: order._id,
      returnType: 'return',
      returnReason: '',
      returnItems,
      hasCheckedItem: returnItems.length > 0,
      exchangeItems: [],
      returnAmountText: '0.00',
      exchangeAmountText: '0.00',
      priceDiffText: ''
    });
  },

  onReturnTypeChange(e) {
    this.setData({
      returnType: e.currentTarget.dataset.type,
      exchangeItems: [],
      returnAmountText: '0.00',
      exchangeAmountText: '0.00',
      priceDiffText: ''
    });
  },

  // 跳转首页选择换购商品
  onGoChooseExchangeItems() {
    const { returnOrderId, returnItems, hasCheckedItem, returnReason } = this.data;
    const checkedItems = returnItems.filter(i => i.checked && i.returnQty > 0);
    if (checkedItems.length === 0) {
      wx.showToast({ title: '请先选择要退回的商品', icon: 'none' });
      return;
    }
    const app = getApp();
    app.globalData.exchangeDraft = { returnOrderId, returnItems, hasCheckedItem, returnReason };
    app.globalData.exchangeMode = true;
    app.globalData.exchangeCart = [];
    wx.switchTab({ url: '/pages/index/index' });
  },

  onReturnReasonInput(e) {
    this.setData({ returnReason: e.detail.value });
  },

  // 勾选/取消商品
  onToggleReturnItem(e) {
    const idx = e.currentTarget.dataset.index;
    const items = this.data.returnItems;
    items[idx].checked = !items[idx].checked;
    if (items[idx].checked && items[idx].returnQty === 0) {
      items[idx].returnQty = items[idx].quantity;
    }
    this.setData({
      returnItems: items,
      hasCheckedItem: items.some(i => i.checked)
    });
  },

  // 退换数量 +/-
  onReturnItemQty(e) {
    const { index, delta } = e.currentTarget.dataset;
    const items = this.data.returnItems;
    const item = items[index];
    const newQty = (item.returnQty || 0) + parseInt(delta);
    if (newQty < 0 || newQty > item.quantity) return;
    item.returnQty = newQty;
    this.setData({ returnItems: items });
  },

  // 退换数量手动输入
  onReturnItemQtyInput(e) {
    const idx = e.currentTarget.dataset.index;
    let val = parseInt(e.detail.value, 10);
    if (isNaN(val) || val < 0) val = 0;
    const items = this.data.returnItems;
    if (val > items[idx].quantity) val = items[idx].quantity;
    items[idx].returnQty = val;
    this.setData({ returnItems: items });
  },

  // 计算换购价格
  calcExchangePrice() {
    const { returnItems, exchangeItems } = this.data;
    const returnAmount = returnItems
      .filter(i => i.checked && i.returnQty > 0)
      .reduce((sum, i) => sum + i.price * i.returnQty, 0);
    const exchangeAmount = exchangeItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const diff = exchangeAmount - returnAmount;
    let priceDiffText;
    if (diff > 0) {
      priceDiffText = '需补差价 ¥' + (diff / 100).toFixed(2);
    } else if (diff < 0) {
      priceDiffText = '应退 ¥' + (Math.abs(diff) / 100).toFixed(2);
    } else {
      priceDiffText = '持平';
    }
    this.setData({
      returnAmountText: (returnAmount / 100).toFixed(2),
      exchangeAmountText: (exchangeAmount / 100).toFixed(2),
      priceDiffText
    });
  },

  // 提交退换货申请
  async onSubmitReturn() {
    const { returnOrderId, returnType, returnReason, returnItems, exchangeItems } = this.data;
    const checkedItems = returnItems.filter(i => i.checked && i.returnQty > 0);

    if (checkedItems.length === 0) {
      wx.showToast({ title: '请至少选择一件退回商品', icon: 'none' });
      return;
    }
    if (returnType === 'exchange' && exchangeItems.length === 0) {
      wx.showToast({ title: '请选择要换购的商品', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '提交中...' });
    const app = getApp();

    const retItems = checkedItems.map(i => ({
      productId: i.productId,
      name: i.name,
      price: i.price,
      quantity: i.returnQty,
      unit: i.unit
    }));

    const exItems = exchangeItems.map(i => ({
      productId: i._id,
      name: i.name,
      price: i.price,
      quantity: i.quantity,
      unit: i.unit
    }));

    if (app.globalData.demoMode) {
      const returnReqs = wx.getStorageSync('returnRequests') || [];
      const allOrders = [...(wx.getStorageSync('demoOrders') || []), ...(app.globalData.demoOrders || [])];
      const order = allOrders.find(o => o._id === returnOrderId);
      const prevRejectionCount = (order && order.returnRequest && order.returnRequest.rejectionCount) || 0;
      const rr = {
        _id: 'rr' + Date.now() + Math.random().toString(36).slice(2, 6),
        orderId: returnOrderId,
        type: returnType,
        reason: returnReason.trim(),
        items: retItems,
        exchangeItems: exItems.length > 0 ? exItems : undefined,
        rejectionCount: prevRejectionCount,
        isRetry: prevRejectionCount > 0,
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      returnReqs.push(rr);
      wx.setStorageSync('returnRequests', returnReqs);
      this.updateOrderReturnFlag(returnOrderId, returnType, returnReason.trim(), 'pending', retItems, exItems, prevRejectionCount);
      wx.hideLoading();
      wx.showToast({ title: '申请已提交', icon: 'success' });
      this.setData({ showReturnForm: false });
      this.loadOrders();
      return;
    }

    try {
      const data = {
        orderId: returnOrderId,
        type: returnType,
        reason: returnReason.trim(),
        items: retItems,
        exchangeItems: exItems.length > 0 ? exItems : undefined
      };
      const result = await wx.cloud.callFunction({ name: 'requestReturn', data });
      wx.hideLoading();
      if (result.result.code === 0) {
        wx.showToast({ title: '申请已提交', icon: 'success' });
        this.setData({ showReturnForm: false });
        this.loadOrders();
      } else {
        wx.showToast({ title: result.result.msg, icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '提交失败', icon: 'none' });
    }
  },

  // 关闭退换货表单
  onCloseReturn() {
    this.setData({ showReturnForm: false });
  },

  // Demo: 更新订单状态
  updateOrderStatus(orderId, newStatus) {
    const app = getApp();
    const update = (list) => {
      const order = list.find(o => o._id === orderId);
      if (order) order.status = newStatus;
    };
    update(app.globalData.demoOrders);
    const saved = wx.getStorageSync('demoOrders') || [];
    update(saved);
    wx.setStorageSync('demoOrders', saved);
    wx.showToast({ title: '已取消（演示模式）', icon: 'success' });
    this.loadOrders();
  },

  // Demo: 更新退换货标记
  updateOrderReturnFlag(orderId, type, reason, status, items, exchangeItems, rejectionCount) {
    const app = getApp();
    const update = (list) => {
      const order = list.find(o => o._id === orderId);
      if (order) order.returnRequest = { type, reason, status, items, exchangeItems, rejectionCount: rejectionCount || 0, isRetry: (rejectionCount || 0) > 0 };
    };
    update(app.globalData.demoOrders);
    const saved = wx.getStorageSync('demoOrders') || [];
    update(saved);
    wx.setStorageSync('demoOrders', saved);
  },

  goAddress() {
    wx.switchTab({ url: '/pages/address/address' });
  },

  goAdmin() {
    const app = getApp();
    // 已登录直接进后台，未登录跳到登录tab页
    if (app.globalData.adminLoggedIn || wx.getStorageSync('adminLoggedIn')) {
      wx.navigateTo({ url: '/pages/admin/orders/orders' });
    } else {
      wx.switchTab({ url: '/pages/admin/login/login' });
    }
  },

  onPreviewOrderImage(e) {
    const { url } = e.currentTarget.dataset;
    wx.previewImage({ current: url, urls: [url] });
  },

  // 再次购买
  // 修改订单：跳转结算页，商品可增减
  onEditOrder(e) {
    const order = e.currentTarget.dataset.order;
    const app = getApp();
    app.globalData.editOrder = order;
    wx.navigateTo({ url: '/pages/checkout/checkout?editOrder=1' });
  },

  onRebuy(e) {
    const order = e.currentTarget.dataset.order;
    const app = getApp();
    const cart = app.globalData.cart || [];

    order.items.forEach(item => {
      const existing = cart.find(c => c._id === item.productId);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        cart.push({
          _id: item.productId,
          name: item.name,
          price: item.price,
          unit: item.unit,
          quantity: item.quantity,
          image: item.image || ''
        });
      }
    });

    app.globalData.cart = cart;
    wx.setStorageSync('cart', cart);
    wx.showToast({ title: '已加入购物车', icon: 'success' });
  },

  onCopyOrder(e) {
    const order = e.currentTarget.dataset.order;
    const text = `订单信息\n姓名：${order.customerName}\n电话：${order.phone}\n地址：${order.address}\n金额：¥${order.totalText}\n状态：${order.statusText}`;
    wx.setClipboardData({ data: text, success: () => {
      wx.showToast({ title: '已复制', icon: 'success' });
    }});
  }
});
