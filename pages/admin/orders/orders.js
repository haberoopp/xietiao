const util = require('../../../utils/util');
const amap = require('../../../utils/amap');
const exportUtil = require('../../../utils/export');
const demoStore = require('../../../utils/demoStore');

Page({
  data: {
    statusTabs: [
      { key: '', label: '全部订单' },
      { key: 'processing', label: '处理中' },
      { key: 'completed', label: '已完成' },
      { key: 'cancelled', label: '已取消' },
      { key: 'returns', label: '退换货' }
    ],
    activeStatus: '',
    orders: [],
    returnList: [],
    loading: false,
    isReturnTab: false,
    isToolsTab: false,
    // 角色
    role: '',
    isManager: false,
    isDelivery: false,
    isWarehouse: false,
    // 改价弹窗
    showPriceModal: false,
    priceOrderId: '',
    priceCurrent: '',
    priceNew: '',
    // 搜索
    searchKeyword: '',
    // 选择导出
    selectMode: false,
    selectedIds: {},
    selectedCount: 0,
    allSelected: false
  },

  onShow() {
    const role = wx.getStorageSync('adminRole') || getApp().globalData.adminRole || 'warehouse';
    if (!getApp().globalData.adminLoggedIn && !wx.getStorageSync('adminLoggedIn')) {
      wx.switchTab({ url: '/pages/admin/login/login' });
      return;
    }
    this.setData({
      role,
      isManager: role === 'manager',
      isDelivery: role === 'delivery',
      isWarehouse: role === 'warehouse'
    });
    this.loadOrders();
  },

  onPullDownRefresh() {
    this.loadOrders().then(() => wx.stopPullDownRefresh());
  },

  onTabTap(e) {
    const tab = e.currentTarget.dataset.status;
    this.setData({ activeStatus: tab, isReturnTab: tab === 'returns' });
    this.loadOrders();
  },

  onAdminTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ isToolsTab: tab === 'tools' });
  },

  async loadOrders() {
    this.setData({ loading: true });
    const app = getApp();

    if (app.globalData.demoMode) {
      const returnReqs = demoStore.getAll(demoStore.KEYS.returnRequests);
      let orders = demoStore.getAll(demoStore.KEYS.orders);

      if (this.data.isReturnTab) {
        const enriched = returnReqs.slice().reverse().map(rr => {
          const order = orders.find(o => o._id === rr.orderId) || {};
          return { ...rr, orderInfo: { ...order, totalText: ((order.totalAmount || 0) / 100).toFixed(2) } };
        });
        this.setData({ returnList: enriched, orders: [], loading: false });
      } else {
        if (this.data.activeStatus) {
          orders = orders.filter(o => o.status === this.data.activeStatus);
        }
        orders = orders.map(order => ({
          ...order,
          items: (order.items || []).map(i => ({ ...i, priceText: ((i.price || 0) / 100).toFixed(2) })),
          returnRequest: order.returnRequest || (returnReqs.find(r => r.orderId === order._id) || null),
          statusText: util.getOrderStatusText(order.status),
          totalText: (order.totalAmount / 100).toFixed(2),
          timeText: util.formatDate(order.createdAt),
          deliveryMethodText: util.getDeliveryMethodText(order.deliveryMethod),
          pickedUp: order.pickedUp || false,
          returnStatusText: order.returnRequest ? util.getReturnStatusText(order.returnRequest.status) : '',
          paymentStatusText: (order.payment_status === 'paid' ? '已付款' : order.payment_status === 'unpaid' ? '未付款' : '未付款')
        }));
        // 客户搜索过滤
        if (this.data.searchKeyword) {
          const kw = this.data.searchKeyword.toLowerCase();
          orders = orders.filter(o =>
            (o.customerName || '').toLowerCase().includes(kw) ||
            (o.phone || '').toLowerCase().includes(kw) ||
            (o.address || '').toLowerCase().includes(kw)
          );
        }
        this.setData({ orders, returnList: [], loading: false });
      }
      return;
    }

    try {
      if (this.data.isReturnTab) {
        const res = await wx.cloud.callFunction({ name: 'adminGetReturns', data: { page: 1, pageSize: 200 } });
        if (res.result.code === 0) {
          const returnList = (res.result.data.list || []).map(rr => ({
            ...rr,
            orderInfo: { ...(rr.orderInfo || {}), totalText: (((rr.orderInfo || {}).totalAmount || 0) / 100).toFixed(2) }
          }));
          this.setData({ returnList, orders: [] });
        }
      } else {
        // 先查总数，再并行拉取全部
        const countRes = await wx.cloud.callFunction({
          name: 'adminGetOrders',
          data: Object.assign({ page: 1, pageSize: 1 }, this.data.activeStatus ? { status: this.data.activeStatus } : {})
        });
        if (countRes.result.code !== 0) throw new Error('count failed');
        const total = countRes.result.data.total;
        const PAGE = 200;
        const pages = Math.ceil(total / PAGE);

        const calls = [];
        for (let i = 0; i < pages; i++) {
          const params = { page: i + 1, pageSize: PAGE };
          if (this.data.activeStatus) params.status = this.data.activeStatus;
          calls.push(wx.cloud.callFunction({ name: 'adminGetOrders', data: params }));
        }
        const results = await Promise.all(calls);
        let orders = results
          .filter(r => r.result && r.result.code === 0)
          .flatMap(r => r.result.data.list)
          .map(order => ({
            ...order,
            items: (order.items || []).map(i => ({ ...i, priceText: ((i.price || 0) / 100).toFixed(2) })),
            statusText: util.getOrderStatusText(order.status),
            totalText: (order.totalAmount / 100).toFixed(2),
            timeText: util.formatDate(order.createdAt),
            deliveryMethodText: util.getDeliveryMethodText(order.deliveryMethod),
            pickedUp: order.pickedUp || false,
            returnStatusText: order.returnRequest ? util.getReturnStatusText(order.returnRequest.status) : '',
            paymentStatusText: (order.payment_status === 'paid' ? '已付款' : order.payment_status === 'unpaid' ? '未付款' : '未付款')
          }));
          if (this.data.searchKeyword) {
            const kw = this.data.searchKeyword.toLowerCase();
            orders = orders.filter(o =>
              (o.customerName || '').toLowerCase().includes(kw) ||
              (o.phone || '').toLowerCase().includes(kw) ||
              (o.address || '').toLowerCase().includes(kw)
            );
          }
          // 把 cloud:// 图片转为临时 HTTP URL，非上传者也能加载
          orders = await this.convertOrderImageUrls(orders);
          this.setData({ orders, returnList: [] });
      }
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
    this.setData({ loading: false });
  },

  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value });
    this.loadOrders();
  },

  onClearSearch() {
    this.setData({ searchKeyword: '' });
    this.loadOrders();
  },

  // 改价
  onOpenPriceModal(e) {
    const order = e.currentTarget.dataset.order;
    this.setData({
      showPriceModal: true,
      priceOrderId: order._id,
      priceCurrent: order.totalText,
      priceNew: order.totalText
    });
  },

  onPriceInput(e) {
    this.setData({ priceNew: e.detail.value });
  },

  async onConfirmPrice() {
    const { priceOrderId, priceNew } = this.data;
    const newAmount = parseFloat(priceNew);
    if (isNaN(newAmount) || newAmount < 0) {
      wx.showToast({ title: '请输入有效金额', icon: 'none' });
      return;
    }

    const app = getApp();

    if (app.globalData.demoMode) {
      const idx = this.data.orders.findIndex(o => o._id === priceOrderId);
      if (idx !== -1) {
        this.setData({ [`orders[${idx}].totalAmount`]: Math.round(newAmount * 100), [`orders[${idx}].totalText`]: newAmount.toFixed(2), showPriceModal: false });
      }
      demoStore.update(demoStore.KEYS.orders, (orders) => {
        const o = orders.find(o => o._id === priceOrderId);
        if (o) o.totalAmount = Math.round(newAmount * 100);
        return orders;
      });
      wx.showToast({ title: '价格已更新', icon: 'success' });
      return;
    }

    // 乐观更新
    const idx = this.data.orders.findIndex(o => o._id === priceOrderId);
    if (idx === -1) return;
    const oldAmount = this.data.orders[idx].totalAmount;
    const oldText = this.data.orders[idx].totalText;
    this.setData({
      [`orders[${idx}].totalAmount`]: Math.round(newAmount * 100),
      [`orders[${idx}].totalText`]: newAmount.toFixed(2),
      showPriceModal: false
    });

    try {
      const res = await wx.cloud.callFunction({
        name: 'adminUpdateOrderPrice',
        data: { orderId: priceOrderId, totalAmount: newAmount * 100 }
      });
      if (res.result.code !== 0) {
        this.setData({
          [`orders[${idx}].totalAmount`]: oldAmount,
          [`orders[${idx}].totalText`]: oldText
        });
        wx.showToast({ title: res.result.msg, icon: 'none' });
      } else {
        wx.showToast({ title: '价格已更新', icon: 'success' });
      }
    } catch (err) {
      this.setData({
        [`orders[${idx}].totalAmount`]: oldAmount,
        [`orders[${idx}].totalText`]: oldText
      });
      wx.showToast({ title: '网络错误', icon: 'none' });
    }
  },

  onClosePriceModal() {
    this.setData({ showPriceModal: false });
  },

  // 上传图片
  onUploadImage(e) {
    const { orderId } = e.currentTarget.dataset;
    const app = getApp();

    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const tempPath = res.tempFilePaths[0];

        if (app.globalData.demoMode) {
          const imgData = { fileID: tempPath, uploadedAt: new Date().toISOString() };
          demoStore.update(demoStore.KEYS.orders, (orders) => {
            const o = orders.find(o => o._id === orderId);
            if (o) {
              o.images = o.images || [];
              o.images.push(imgData);
            }
            return orders;
          });
          wx.showToast({ title: '已上传（演示模式）', icon: 'success' });
          this.loadOrders();
          return;
        }

        wx.showLoading({ title: '上传中...' });
        try {
          const cloudPath = 'order-images/' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.jpg';
          const uploadRes = await wx.cloud.uploadFile({ cloudPath, filePath: tempPath });
          const result = await wx.cloud.callFunction({
            name: 'adminOrderImage',
            data: { orderId, fileID: uploadRes.fileID }
          });
          wx.hideLoading();
          if (result.result.code === 0) {
            wx.showToast({ title: '已上传', icon: 'success' });
            this.loadOrders();
          } else {
            wx.showToast({ title: '上传失败', icon: 'none' });
          }
        } catch (err) {
          wx.hideLoading();
          wx.showToast({ title: '上传失败', icon: 'none' });
        }
      }
    });
  },

  // 预览图片
  onPreviewImage(e) {
    const { url } = e.currentTarget.dataset;
    const orderImages = [];
    this.data.orders.forEach(order => {
      if (order.images) {
        order.images.forEach(img => orderImages.push(img.fileID));
      }
    });
    wx.previewImage({
      current: url,
      urls: orderImages.length > 0 ? orderImages : [url]
    });
  },

  // 删除图片
  onDeleteImage(e) {
    const { orderId, imgIndex } = e.currentTarget.dataset;
    const app = getApp();

    wx.showModal({
      title: '确认删除',
      content: '确定要删除该图片吗？',
      success: async (res) => {
        if (!res.confirm) return;

        if (app.globalData.demoMode) {
          demoStore.update(demoStore.KEYS.orders, (orders) => {
            const o = orders.find(o => o._id === orderId);
            if (o && o.images) o.images.splice(imgIndex, 1);
            return orders;
          });
          wx.showToast({ title: '已删除', icon: 'success' });
          this.loadOrders();
          return;
        }

        try {
          const result = await wx.cloud.callFunction({
            name: 'adminDeleteOrderImage',
            data: { orderId, imageIndex: imgIndex }
          });
          if (result.result.code === 0) {
            wx.showToast({ title: '已删除', icon: 'success' });
            this.loadOrders();
          } else {
            wx.showToast({ title: result.result.msg || '删除失败', icon: 'none' });
          }
        } catch (err) {
          wx.showToast({ title: '网络错误', icon: 'none' });
        }
      }
    });
  },

  async onStatusChange(e) {
    const order = e.currentTarget.dataset.order;
    const { isManager, isDelivery, isWarehouse } = this.data;
    const app = getApp();

    // 送货员：配送订单必须上传图片
    if (isDelivery && order.deliveryMethod === 'delivery' && (!order.images || order.images.length === 0)) {
      wx.showToast({ title: '请先上传配送凭证图片', icon: 'none' });
      return;
    }
    // 调货员：物流订单必须上传图片
    if (isWarehouse && order.deliveryMethod === 'logistics' && (!order.images || order.images.length === 0)) {
      wx.showToast({ title: '请先上传物流凭证图片', icon: 'none' });
      return;
    }

    wx.showActionSheet({
      itemList: ['标记为处理中', '标记为已完成', '标记为已取消'],
      success: async (res) => {
        const statusKeys = ['processing', 'completed', 'cancelled'];
        const newStatus = statusKeys[res.tapIndex];

        if (app.globalData.demoMode) {
          const idx = this.data.orders.findIndex(o => o._id === order._id);
          if (idx !== -1) this.setData({ [`orders[${idx}].status`]: newStatus });
          demoStore.update(demoStore.KEYS.orders, (orders) => {
            const o = orders.find(o => o._id === order._id);
            if (o) o.status = newStatus;
            return orders;
          });
          wx.showToast({ title: '已更新', icon: 'success' });
          return;
        }

        // 乐观更新
        const idx = this.data.orders.findIndex(o => o._id === order._id);
        if (idx === -1) return;
        const oldStatus = this.data.orders[idx].status;
        this.setData({ [`orders[${idx}].status`]: newStatus });

        try {
          const result = await wx.cloud.callFunction({
            name: 'adminUpdateOrderStatus', data: { orderId: order._id, status: newStatus }
          });
          if (result.result.code !== 0) {
            this.setData({ [`orders[${idx}].status`]: oldStatus });
            wx.showToast({ title: '更新失败', icon: 'none' });
          } else {
            wx.showToast({ title: '已更新', icon: 'success' });
          }
        } catch (err) {
          this.setData({ [`orders[${idx}].status`]: oldStatus });
          wx.showToast({ title: '网络错误', icon: 'none' });
        }
      }
    });
  },

  async onHandleReturn(e) {
    const { requestId, orderId, action } = e.currentTarget.dataset;
    const actionLabels = { approve: '通过', reject: '拒绝', complete: '标记完成' };
    const app = getApp();

    wx.showModal({
      title: '确认操作',
      content: `确定要${actionLabels[action]}该退换货申请吗？`,
      success: async (res) => {
        if (!res.confirm) return;

        if (app.globalData.demoMode) {
          let returnReqs = demoStore.getAll(demoStore.KEYS.returnRequests);
          const rr = returnReqs.find(r => r._id === requestId || r.orderId === orderId);
          if (rr) {
            rr.status = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'completed';
            if (action === 'reject') {
              rr.rejectionCount = (rr.rejectionCount || 0) + 1;
            }
          }
          demoStore.setAll(demoStore.KEYS.returnRequests, returnReqs);
          demoStore.update(demoStore.KEYS.orders, (orders) => {
            const order = orders.find(o => o._id === orderId);
            if (!order) return orders;
            const newStatus = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'completed';
            if (order.returnRequest) {
              order.returnRequest.status = newStatus;
              if (action === 'reject') {
                order.returnRequest.rejectionCount = (order.returnRequest.rejectionCount || 0) + 1;
              }
            }
            // 通过后：订单状态改为处理中，已拿货状态处理
            if (action === 'approve') {
              order.status = 'processing';
              const discount = order.discount || 1.0;
              if (rr && rr.type === 'return') {
                delete order.pickedUp;
                // 退货通过：扣减退货商品金额（按折扣价）
                if (rr.items && rr.items.length > 0) {
                  const refund = rr.items.reduce((s, i) => s + Math.round((i.price || 0) * discount) * (i.quantity || 0), 0);
                  order.totalAmount = Math.max(0, order.totalAmount - refund);
                }
              } else if (rr && rr.type === 'exchange') {
                order.pickedUp = false;
                // 换货通过：退回金额 - 换购金额 = 差价（均按折扣价）
                const returnAmount = (rr.items || []).reduce((s, i) => s + Math.round((i.price || 0) * discount) * (i.quantity || 0), 0);
                const exchangeAmount = (rr.exchangeItems || []).reduce((s, i) => s + Math.round((i.price || 0) * discount) * (i.quantity || 0), 0);
                const diff = exchangeAmount - returnAmount;
                order.totalAmount = Math.max(0, order.totalAmount + diff);
              }
            }
            return orders;
          });
          wx.showToast({ title: '已处理', icon: 'success' });
          this.loadOrders();
          return;
        }

        try {
          const result = await wx.cloud.callFunction({
            name: 'adminHandleReturn', data: { requestId, action }
          });
          if (result.result.code === 0) {
            wx.showToast({ title: '已处理', icon: 'success' });
            this.loadOrders();
          } else {
            wx.showToast({ title: result.result.msg, icon: 'none' });
          }
        } catch (err) {
          wx.showToast({ title: '操作失败', icon: 'none' });
        }
      }
    });
  },

  // 切换已拿货/未拿货（仅配送订单）
  async onTogglePickedUp(e) {
    const { orderId } = e.currentTarget.dataset;
    if (!orderId) return;
    const app = getApp();

    if (app.globalData.demoMode) {
      const idx = this.data.orders.findIndex(o => o._id === orderId);
      if (idx === -1) return;
      const newVal = !this.data.orders[idx].pickedUp;
      this.setData({ [`orders[${idx}].pickedUp`]: newVal });
      demoStore.update(demoStore.KEYS.orders, (orders) => {
        const o = orders.find(o => o._id === orderId);
        if (o) o.pickedUp = !o.pickedUp;
        return orders;
      });
      return;
    }

    // 乐观更新：立即翻转本地 pickedUp
    const idx = this.data.orders.findIndex(o => o._id === orderId);
    if (idx === -1) return;
    const oldVal = this.data.orders[idx].pickedUp;
    this.setData({ [`orders[${idx}].pickedUp`]: !oldVal });

    try {
      const res = await wx.cloud.callFunction({
        name: 'adminTogglePickedUp',
        data: { orderId }
      });
      if (res.result.code !== 0) {
        // 失败回滚
        this.setData({ [`orders[${idx}].pickedUp`]: oldVal });
        wx.showToast({ title: res.result.msg || '操作失败', icon: 'none' });
      }
      // 成功：乐观更新已生效，不需要任何操作
    } catch (err) {
      // 网络异常回滚
      this.setData({ [`orders[${idx}].pickedUp`]: oldVal });
      wx.showToast({ title: '网络错误', icon: 'none' });
    }
  },

  async onTogglePayment(e) {
    const { orderId } = e.currentTarget.dataset;
    if (!orderId) return;
    const app = getApp();

    if (app.globalData.demoMode) {
      const idx = this.data.orders.findIndex(o => o._id === orderId);
      if (idx === -1) return;
      const isPaid = this.data.orders[idx].payment_status === 'paid';
      this.setData({
        [`orders[${idx}].payment_status`]: isPaid ? 'unpaid' : 'paid',
        [`orders[${idx}].paid_amount`]: isPaid ? 0 : this.data.orders[idx].totalAmount
      });
      demoStore.update(demoStore.KEYS.orders, (orders) => {
        const o = orders.find(o => o._id === orderId);
        if (o) {
          if (o.payment_status === 'paid') { o.payment_status = 'unpaid'; o.paid_amount = 0; }
          else { o.payment_status = 'paid'; o.paid_amount = o.totalAmount; }
        }
        return orders;
      });
      return;
    }

    // 乐观更新
    const idx = this.data.orders.findIndex(o => o._id === orderId);
    if (idx === -1) return;
    const oldStatus = this.data.orders[idx].payment_status;
    const oldPaidAmount = this.data.orders[idx].paid_amount;
    const isPaid = oldStatus === 'paid';
    this.setData({
      [`orders[${idx}].payment_status`]: isPaid ? 'unpaid' : 'paid',
      [`orders[${idx}].paid_amount`]: isPaid ? 0 : this.data.orders[idx].totalAmount
    });

    try {
      const res = await wx.cloud.callFunction({
        name: 'adminUpdateOrderStatus',
        data: { orderId, payment_status: isPaid ? 'unpaid' : 'paid' }
      });
      if (res.result.code !== 0) {
        this.setData({
          [`orders[${idx}].payment_status`]: oldStatus,
          [`orders[${idx}].paid_amount`]: oldPaidAmount
        });
        wx.showToast({ title: '操作失败', icon: 'none' });
      }
    } catch (err) {
      this.setData({
        [`orders[${idx}].payment_status`]: oldStatus,
        [`orders[${idx}].paid_amount`]: oldPaidAmount
      });
      wx.showToast({ title: '网络错误', icon: 'none' });
    }
  },

  onNavigate(e) {
    const { address, lat, lng } = e.currentTarget.dataset;
    if (lat && lng) {
      wx.openLocation({
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
        address: address,
        scale: 16,
        fail: () => wx.showToast({ title: '请安装地图应用', icon: 'none' })
      });
    } else {
      amap.openNavigation(address);
    }
  },

  onGoProducts() {
    wx.navigateTo({ url: '/pages/admin/products/products' });
  },

  onGoDashboard() {
    wx.navigateTo({ url: '/pages/admin/dashboard/dashboard' });
  },

  onGoCustomers() {
    wx.navigateTo({ url: '/pages/admin/customers/customers' });
  },

  onCopyOrder(e) {
    const order = e.currentTarget.dataset.order;
    const items = order.items.map(p => `${p.name} ×${p.quantity}${p.unit}`).join('；');
    const text = `客户：${order.customerName}\n电话：${order.phone}\n地址：${order.address}\n拿货方式：${order.deliveryMethodText}\n商品：${items}\n金额：¥${order.totalText}\n状态：${order.statusText}`;
    wx.setClipboardData({ data: text, success: () => {
      wx.showToast({ title: '已复制', icon: 'success' });
    }});
  },

  onMarkLowStock(e) {
    const { productId, productName } = e.currentTarget.dataset;
    const app = getApp();

    if (app.globalData.demoMode) {
      const products = demoStore.getAll(demoStore.KEYS.products);
      const p = products.find(p => p._id === productId);
      if (p && p.status === 'sufficient') {
        demoStore.update(demoStore.KEYS.products, (prods) => {
          const prod = prods.find(pr => pr._id === productId);
          if (prod) prod.status = 'low';
          return prods;
        });
        wx.showToast({ title: '已标记"' + productName + '"为紧张', icon: 'success' });
        this.loadOrders();
      } else if (p && p.status === 'low') {
        wx.showToast({ title: '"' + productName + '"已标记为紧张', icon: 'none' });
      } else if (p && p.status === 'out') {
        wx.showToast({ title: '"' + productName + '"已是缺货状态', icon: 'none' });
      }
      return;
    }

    wx.showLoading({ title: '更新中...' });
    wx.cloud.callFunction({
      name: 'adminUpdateProduct',
      data: { productId, status: 'low' }
    }).then(res => {
      wx.hideLoading();
      if (res.result.code === 0) {
        wx.showToast({ title: '已标记为紧张', icon: 'success' });
      }
    }).catch(() => {
      wx.hideLoading();
      wx.showToast({ title: '操作失败', icon: 'none' });
    });
  },

  // ===== 选择导出 =====
  // 进入选择模式
  onEnterSelectMode() {
    // 如果从功能tab进入，先切到订单tab
    if (this.data.isToolsTab) {
      this.setData({ isToolsTab: false });
    }
    const orders = this.data.orders.map(o => ({ ...o, selected: false }));
    this.setData({
      selectMode: true,
      orders,
      selectedIds: {},
      selectedCount: 0,
      allSelected: false
    });
  },

  // 退出选择模式
  onCancelSelectMode() {
    const orders = this.data.orders.map(o => ({ ...o, selected: false }));
    this.setData({
      selectMode: false,
      orders,
      selectedIds: {},
      selectedCount: 0,
      allSelected: false
    });
  },

  // 切换单个订单选中
  onToggleOrderSelect(e) {
    const id = e.currentTarget.dataset.id;
    const selectedIds = { ...this.data.selectedIds };
    if (selectedIds[id]) {
      delete selectedIds[id];
    } else {
      selectedIds[id] = true;
    }
    const count = Object.keys(selectedIds).length;
    const orders = this.data.orders.map(o => ({
      ...o,
      selected: !!selectedIds[o._id]
    }));
    this.setData({
      selectedIds,
      selectedCount: count,
      allSelected: count === orders.length,
      orders
    });
  },

  // 全选/取消全选
  onToggleSelectAll() {
    if (this.data.allSelected) {
      const orders = this.data.orders.map(o => ({ ...o, selected: false }));
      this.setData({
        orders,
        selectedIds: {},
        selectedCount: 0,
        allSelected: false
      });
    } else {
      const selectedIds = {};
      this.data.orders.forEach(o => { selectedIds[o._id] = true; });
      const orders = this.data.orders.map(o => ({ ...o, selected: true }));
      this.setData({
        orders,
        selectedIds,
        selectedCount: orders.length,
        allSelected: true
      });
    }
  },

  // 导出选中（或全部）
  onExportSelected() {
    let exportOrders = this.data.orders.filter(o => this.data.selectedIds[o._id]);
    if (exportOrders.length === 0) {
      // 没选任何订单 → 导出当前全部
      exportOrders = this.data.orders;
    }
    if (exportOrders.length === 0) {
      wx.showToast({ title: '没有订单可导出', icon: 'none' });
      return;
    }
    const csv = exportUtil.ordersToCSV(exportOrders);
    const dateStr = new Date().toISOString().slice(0, 10);
    exportUtil.shareCSV(csv, '订单导出_' + dateStr + '.csv');
    // 导出后退出选择模式
    this.onCancelSelectMode();
  },

  // 旧版导出（保留兼容：直接导出所有订单）
  onExportOrders() {
    const orders = this.data.orders;
    if (orders.length === 0) {
      wx.showToast({ title: '没有订单可导出', icon: 'none' });
      return;
    }
    const csv = exportUtil.ordersToCSV(orders);
    const dateStr = new Date().toISOString().slice(0, 10);
    exportUtil.shareCSV(csv, '订单导出_' + dateStr + '.csv');
  },

  // 分享对账单（Canvas 生成图片后分享）
  onShareBill(e) {
    const order = e.currentTarget.dataset.order;
    wx.showLoading({ title: '生成中...' });
    exportUtil.drawBillOnCanvas(order, (err, tempFilePath) => {
      wx.hideLoading();
      if (err) {
        wx.showToast({ title: '生成失败', icon: 'none' });
        return;
      }
      wx.showShareImageMenu({
        path: tempFilePath,
        success: () => {
          wx.showToast({ title: '可发送给客户或保存', icon: 'success' });
        },
        fail: () => {
          exportUtil.shareBillImage(tempFilePath);
        }
      });
    });
  },

  onSubscribeAdmin() {
    const constants = require('../../../utils/constants');
    wx.requestSubscribeMessage({
      tmplIds: constants.NOTIFY_TEMPLATES.ADMIN,
      success: async (res) => {
        const accepted = Object.values(res).some(v => v === 'accept');
        if (accepted) {
          wx.showLoading({ title: '保存中...' });
          try {
            const result = await wx.cloud.callFunction({
              name: 'subscribeAdmin',
              data: {
                action: 'subscribe',
                categories: ['new_order', 'status_change', 'cancelled', 'return']
              }
            });
            wx.hideLoading();
            if (result.result && result.result.code === 0) {
              wx.showToast({ title: '通知订阅成功', icon: 'success' });
            } else {
              wx.showToast({ title: '保存失败', icon: 'none' });
            }
          } catch (err) {
            wx.hideLoading();
            wx.showToast({ title: '网络错误', icon: 'none' });
          }
        }
      },
      fail: function(err) {
        console.warn('Admin subscribe failed:', err);
      }
    });
  },

  onLogout() {
    // 清除客户端状态
    getApp().globalData.adminLoggedIn = false;
    getApp().globalData.adminRole = '';
    wx.removeStorageSync('adminLoggedIn');
    wx.removeStorageSync('adminRole');
    wx.removeStorageSync('adminNickname');
    // 清除服务端登录状态
    wx.cloud.callFunction({ name: 'adminLogout' }).catch(() => {});
    wx.switchTab({ url: '/pages/admin/login/login' });
  },

  // 将订单图片的 cloud:// fileID 转为临时 HTTP URL，解决非上传者无法加载的问题
  async convertOrderImageUrls(orders) {
    const fileIDs = [];
    orders.forEach(order => {
      if (order.images && order.images.length > 0) {
        order.images.forEach(img => {
          if (img.fileID && img.fileID.startsWith('cloud://')) {
            fileIDs.push(img.fileID);
          }
        });
      }
    });
    if (fileIDs.length === 0) return orders;

    try {
      const res = await wx.cloud.getTempFileURL({ fileList: fileIDs });
      const map = {};
      (res.fileList || []).forEach(f => {
        if (f.tempFileURL) map[f.fileID] = f.tempFileURL;
      });
      return orders.map(order => ({
        ...order,
        images: (order.images || []).map(img => ({
          ...img,
          fileID: map[img.fileID] || img.fileID
        }))
      }));
    } catch (e) {
      // 转换失败不影响订单数据显示
      return orders;
    }
  }
});
