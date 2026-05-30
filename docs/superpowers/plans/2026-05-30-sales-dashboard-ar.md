# 销售仪表盘增强 + 应收账款 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 仪表盘从"静态快照"升级为可切换日期范围的经营看板（+客户消费排行+待处理订单），同时新增应收账款管理（订单标记已付/未付、客户欠款汇总、一键标记付款）。

**Architecture:** 不新增页面，全部改动落在已有文件。订单表加 `payment_status`(paid/unpaid) + `paid_amount`(分)，客户表加 `debt`(分)。仪表盘加日期切换 tabs(今天/近7天/近30天)和客户消费排行。管理后台订单列表加付款状态 badge 和一键标记已付款按钮。客户管理列表加欠款显示。

**Tech Stack:** 微信小程序原生 JS、演示模式优先、已有 dashboard/orders/customers 页面

---

## 文件结构

```
修改:
  utils/mock.js                              — mock订单加payment_status/paid_amount，客户加debt
  pages/admin/dashboard/dashboard.js         — 日期筛选+客户排行+欠款统计+待处理数+时间趋势
  pages/admin/dashboard/dashboard.wxml       — 日期tabs+客户排行section+欠款统计卡片
  pages/admin/dashboard/dashboard.wxss       — 新UI样式
  pages/admin/orders/orders.js              — 付款状态数据映射+标记已付/未付方法
  pages/admin/orders/orders.wxml            — 付款状态badge+标记按钮
  pages/admin/orders/orders.wxss            — 付款状态badge样式
  pages/admin/customers/customers.js        — 客户列表数据映射加debt/debtText
  pages/admin/customers/customers.wxml      — 欠款显示
  pages/admin/customers/customers.wxss      — 欠款高亮样式
  pages/checkout/checkout.js                — onSubmit订单数据加payment_status/paid_amount默认值
```

---

### Task 1: Mock 数据模型加付款字段

**Files:**
- Modify: `utils/mock.js`

- [ ] **Step 1: mockOrders 每个订单加 payment_status 和 paid_amount**

修改 3 个 mock 订单，每个对象增加两个字段。o001（已完成）设为 paid，o002（处理中）设为 unpaid，o003（处理中）设为 unpaid：

```js
const mockOrders = [
  {
    _id: 'o001',
    customerName: '温州服装厂',
    phone: '13800138001',
    address: '浙江省温州市鹿城区双屿街道工业区3号',
    items: [
      { productId: 'p001', name: '纯棉斜纹布条 2cm', price: 150, quantity: 100, unit: '米' },
      { productId: 'p003', name: '弹力斜纹包边条 3cm', price: 200, quantity: 50, unit: '米' },
    ],
    totalAmount: 25000,
    deliveryMethod: 'delivery',
    status: 'completed',
    payment_status: 'paid',
    paid_amount: 25000,
    pickedUp: true,
    location: { lat: 28.0185, lng: 120.6505 },
    remark: '颜色选黑色和白色各一半',
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    _id: 'o002',
    customerName: '陈大明',
    phone: '13900139002',
    address: '浙江省温州市瓯海区梧田街道月乐西街58号',
    items: [
      { productId: 'p007', name: '尼龙拉链 20cm', price: 50, quantity: 200, unit: '个' },
      { productId: 'p009', name: '树脂纽扣 15mm', price: 10, quantity: 500, unit: '个' },
    ],
    totalAmount: 15000,
    deliveryMethod: 'pickup',
    status: 'processing',
    payment_status: 'unpaid',
    paid_amount: 0,
    location: { lat: 28.0045, lng: 120.5619 },
    remark: '',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    _id: 'o003',
    customerName: '丽水纺织品公司',
    phone: '13700137003',
    address: '浙江省丽水市莲都区水阁工业区绿谷大道102号',
    items: [
      { productId: 'p002', name: '涤纶斜条 1.5cm', price: 80, quantity: 300, unit: '米' },
      { productId: 'p011', name: '织带 1cm', price: 35, quantity: 500, unit: '米' },
      { productId: 'p012', name: '弹性松紧带 0.8cm', price: 45, quantity: 200, unit: '米' },
    ],
    totalAmount: 50500,
    deliveryMethod: 'logistics',
    status: 'processing',
    payment_status: 'unpaid',
    paid_amount: 0,
    location: { lat: 28.4716, lng: 119.9156 },
    remark: '急单，请尽快发货',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
];
```

- [ ] **Step 2: mockCustomers 加 debt 字段**

每个客户对象加 `debt`（欠款总额，单位分）。温州服装厂的 o001 已付清故 debt=0，陈大明有 o002 欠款 15000：

```js
const mockCustomers = [
  { _id: 'c001', name: '温州服装厂', phone: '13800138001', discount: 0.9, totalOrders: 3, totalAmount: 25500, debt: 0, createdAt: Date.now() - 86400000 * 30 },
  { _id: 'c002', name: '陈大明', phone: '13900139002', discount: 0.85, totalOrders: 1, totalAmount: 15000, debt: 15000, createdAt: Date.now() - 86400000 * 15 },
];
```

- [ ] **Step 3: 验证 + Commit**

在演示模式下打开控制台，确认 mockOrders 和 mockCustomers 正常加载，无报错。

```bash
cd "C:\Users\86153\Desktop\wenzhou-xietiao-pifa\miniprogram"
git add utils/mock.js
git commit -m "feat: add payment_status/paid_amount to mock orders, debt to mock customers"
```

---

### Task 2: 仪表盘增强 — 日期筛选 + 客户排行 + 欠款统计

**Files:**
- Modify: `pages/admin/dashboard/dashboard.js`
- Modify: `pages/admin/dashboard/dashboard.wxml`
- Modify: `pages/admin/dashboard/dashboard.wxss`

- [ ] **Step 1: dashboard.js — 加日期筛选和扩展数据计算**

完整替换 `pages/admin/dashboard/dashboard.js` 为以下内容：

```js
Page({
  data: {
    dateRange: 'today',        // today | 7days | 30days
    dateLabel: '今天',
    // 统计卡片
    totalOrders: 0,
    totalSales: '0',
    pendingOrders: 0,          // 待处理（status=processing）
    unpaidAmount: '0',         // 未收款总额
    shortageCount: 0,
    // 销售趋势（按日期聚合）
    trendDays: [],
    // 产品排行
    topProducts: [],
    // 客户排行
    topCustomers: [],
    // 缺货预警
    shortageProducts: []
  },

  onShow() {
    const app = getApp();
    if (!app.globalData.adminLoggedIn && !wx.getStorageSync('adminLoggedIn')) {
      wx.switchTab({ url: '/pages/admin/login/login' });
      return;
    }
    const role = wx.getStorageSync('adminRole') || app.globalData.adminRole || '';
    if (role !== 'manager') {
      wx.showToast({ title: '仅厂长可查看', icon: 'none' });
      wx.redirectTo({ url: '/pages/admin/orders/orders' });
      return;
    }
    this.loadDashboard();
  },

  loadDashboard() {
    const app = getApp();
    if (app.globalData.demoMode) {
      this.loadDemoDashboard();
      return;
    }
    this.loadDemoDashboard();
  },

  loadDemoDashboard() {
    const app = getApp();
    const saved = wx.getStorageSync('demoOrders') || [];
    const allOrders = [...saved, ...(app.globalData.demoOrders || [])];
    const unique = [];
    const seen = new Set();
    allOrders.forEach(o => {
      if (!seen.has(o._id)) { seen.add(o._id); unique.push(o); }
    });

    const products = app.globalData.demoProducts || [];

    // 日期范围过滤
    const now = Date.now();
    let rangeStart;
    if (this.data.dateRange === 'today') {
      rangeStart = new Date();
      rangeStart.setHours(0, 0, 0, 0);
      rangeStart = rangeStart.getTime();
    } else if (this.data.dateRange === '7days') {
      rangeStart = now - 7 * 86400000;
    } else {
      rangeStart = now - 30 * 86400000;
    }

    const rangeOrders = unique.filter(o => new Date(o.createdAt).getTime() >= rangeStart);

    // 销售趋势（按天聚合近7天）
    const trendDays = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date();
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const dayOrders = unique.filter(o => {
        const t = new Date(o.createdAt).getTime();
        return t >= dayStart.getTime() && t < dayEnd.getTime();
      });
      const daySales = dayOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      trendDays.push({
        label: (dayStart.getMonth() + 1) + '/' + dayStart.getDate(),
        orders: dayOrders.length,
        sales: (daySales / 100).toFixed(0),
        barHeight: daySales > 0 ? Math.max(8, Math.round((daySales / 10000) * 40)) : 0
      });
    }

    // 统计卡片
    const totalOrders = rangeOrders.length;
    const totalSales = rangeOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const pendingOrders = rangeOrders.filter(o => o.status === 'processing').length;
    const unpaidAmount = unique.filter(o => o.payment_status === 'unpaid').reduce((sum, o) => sum + (o.totalAmount || 0) - (o.paid_amount || 0), 0);

    // 缺货/紧张产品
    const shortageProducts = products
      .filter(p => p.status === 'out' || p.status === 'low')
      .map(p => ({
        _id: p._id,
        name: p.name,
        status: p.status,
        recentSalesText: ((p.recent_sales || 0) / 100).toFixed(0),
        lastProducedText: p.last_produced_at ? this.formatDaysAgo(p.last_produced_at) : ''
      }))
      .sort((a, b) => a.status === 'out' ? -1 : 1);

    // 产品销量排行（按 recent_sales 降序取前10）
    const maxSales = Math.max(1, ...products.map(p => p.recent_sales || 0));
    const topProducts = [...products]
      .sort((a, b) => (b.recent_sales || 0) - (a.recent_sales || 0))
      .slice(0, 10)
      .map(p => ({
        _id: p._id,
        name: p.name,
        category: p.category,
        unit: p.unit,
        recentSalesText: ((p.recent_sales || 0) / 100).toFixed(0),
        barPercent: Math.round(((p.recent_sales || 0) / maxSales) * 100)
      }));

    // 客户消费排行（按订单金额汇总，取前10）
    const custMap = {};
    rangeOrders.forEach(o => {
      const key = o.phone || '未知';
      if (!custMap[key]) {
        custMap[key] = { name: o.customerName || '未知', phone: key, totalAmount: 0, orderCount: 0 };
      }
      custMap[key].totalAmount += (o.totalAmount || 0);
      custMap[key].orderCount += 1;
    });
    const maxCustAmount = Math.max(1, ...Object.values(custMap).map(c => c.totalAmount));
    const topCustomers = Object.values(custMap)
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 10)
      .map((c, i) => ({
        ...c,
        amountText: (c.totalAmount / 100).toFixed(0),
        barPercent: Math.round((c.totalAmount / maxCustAmount) * 100)
      }));

    this.setData({
      totalOrders,
      totalSales: (totalSales / 100).toFixed(0),
      pendingOrders,
      unpaidAmount: (unpaidAmount / 100).toFixed(0),
      shortageCount: shortageProducts.length,
      trendDays,
      topProducts,
      topCustomers,
      shortageProducts
    });
  },

  onDateTap(e) {
    const range = e.currentTarget.dataset.range;
    const labels = { today: '今天', '7days': '近7天', '30days': '近30天' };
    this.setData({ dateRange: range, dateLabel: labels[range] });
    this.loadDashboard();
  },

  formatDaysAgo(ts) {
    const days = Math.floor((Date.now() - ts) / 86400000);
    if (days === 0) return '今天';
    if (days === 1) return '昨天';
    return days + '天前';
  },

  onFilterShortage() {
    wx.navigateTo({ url: '/pages/admin/products/products?filter=shortage' });
  },

  onBackToOrders() {
    wx.redirectTo({ url: '/pages/admin/orders/orders' });
  }
});
```

- [ ] **Step 2: dashboard.wxml — 完整替换为增强版**

```html
<view class="container">
  <!-- 顶部栏 -->
  <view class="admin-top-bar">
    <view class="back-btn" bindtap="onBackToOrders">← 返回订单</view>
    <text class="dash-title">📊 经营看板</text>
  </view>

  <!-- 日期筛选 tabs -->
  <view class="date-tabs">
    <view class="date-tab {{dateRange === 'today' ? 'active' : ''}}" data-range="today" bindtap="onDateTap">今天</view>
    <view class="date-tab {{dateRange === '7days' ? 'active' : ''}}" data-range="7days" bindtap="onDateTap">近7天</view>
    <view class="date-tab {{dateRange === '30days' ? 'active' : ''}}" data-range="30days" bindtap="onDateTap">近30天</view>
  </view>

  <!-- 统计卡片 第一行 -->
  <view class="stats-row">
    <view class="stat-card">
      <view class="stat-value">{{totalOrders}}</view>
      <view class="stat-label">订单数</view>
    </view>
    <view class="stat-card">
      <view class="stat-value">¥{{totalSales}}</view>
      <view class="stat-label">销售额</view>
    </view>
    <view class="stat-card">
      <view class="stat-value stat-warn">{{pendingOrders}}</view>
      <view class="stat-label">待处理</view>
    </view>
  </view>

  <!-- 统计卡片 第二行 -->
  <view class="stats-row">
    <view class="stat-card stat-card-debt">
      <view class="stat-value stat-debt">¥{{unpaidAmount}}</view>
      <view class="stat-label">未收款</view>
    </view>
    <view class="stat-card">
      <view class="stat-value stat-warn">{{shortageCount}}</view>
      <view class="stat-label">缺货预警</view>
    </view>
    <view class="stat-card stat-card-placeholder"></view>
  </view>

  <!-- 近7天销售趋势 -->
  <view class="section">
    <view class="section-header">
      <text class="section-title">📈 近7天趋势</text>
    </view>
    <view class="trend-chart">
      <view class="trend-bar-col" wx:for="{{trendDays}}" wx:key="label">
        <view class="trend-bar-label">{{item.sales}}</view>
        <view class="trend-bar" style="height: {{item.barHeight}}rpx"></view>
        <view class="trend-day-label">{{item.label}}</view>
      </view>
    </view>
  </view>

  <!-- 客户消费排行 -->
  <view class="section">
    <view class="section-header">
      <text class="section-title">👥 客户消费排行</text>
    </view>
    <view wx:if="{{topCustomers.length === 0}}" class="empty-state">
      <text>暂无数据</text>
    </view>
    <view wx:else class="rank-list">
      <view class="rank-item" wx:for="{{topCustomers}}" wx:key="phone">
        <view class="rank-num {{index < 3 ? 'rank-top' + (index + 1) : ''}}">{{index + 1}}</view>
        <view class="rank-info">
          <view class="rank-name">{{item.name}}</view>
          <view class="rank-meta">{{item.orderCount}}单 · {{item.phone}}</view>
        </view>
        <view class="rank-sales">
          <view class="rank-amount">¥{{item.amountText}}</view>
          <view class="rank-bar-bg">
            <view class="rank-bar-fill" style="width: {{item.barPercent}}%"></view>
          </view>
        </view>
      </view>
    </view>
  </view>

  <!-- 产品销量排行 -->
  <view class="section">
    <view class="section-header">
      <text class="section-title">🔥 产品销量排行</text>
    </view>
    <view wx:if="{{topProducts.length === 0}}" class="empty-state">
      <text>暂无销售数据</text>
    </view>
    <view wx:else class="rank-list">
      <view class="rank-item" wx:for="{{topProducts}}" wx:key="_id">
        <view class="rank-num {{index < 3 ? 'rank-top' + (index + 1) : ''}}">{{index + 1}}</view>
        <view class="rank-info">
          <view class="rank-name">{{item.name}}</view>
          <view class="rank-meta">{{item.category}} · {{item.unit}}</view>
        </view>
        <view class="rank-sales">
          <view class="rank-amount">¥{{item.recentSalesText}}</view>
          <view class="rank-bar-bg">
            <view class="rank-bar-fill" style="width: {{item.barPercent}}%"></view>
          </view>
        </view>
      </view>
    </view>
  </view>

  <!-- 缺货预警列表 -->
  <view class="section">
    <view class="section-header">
      <text class="section-title">⚠️ 缺货预警</text>
      <text class="section-more" bindtap="onFilterShortage">查看全部</text>
    </view>
    <view wx:if="{{shortageProducts.length === 0}}" class="empty-state">
      <text>所有产品库存充足 🎉</text>
    </view>
    <view wx:else class="shortage-list">
      <view class="shortage-item {{item.status === 'out' ? 'so-out' : 'so-low'}}"
        wx:for="{{shortageProducts}}" wx:key="_id">
        <view class="si-status">{{item.status === 'out' ? '🔴 缺货' : '🟡 紧张'}}</view>
        <view class="si-name">{{item.name}}</view>
        <view class="si-meta">
          <text>近7天销 ¥{{item.recentSalesText}}</text>
          <text wx:if="{{item.lastProducedText}}"> · 上次生产 {{item.lastProducedText}}</text>
        </view>
      </view>
    </view>
  </view>
</view>
```

- [ ] **Step 3: dashboard.wxss — 完整替换为增强版**

```css
.admin-top-bar {
  display: flex;
  align-items: center;
  margin-bottom: 16rpx;
}

.back-btn {
  font-size: 26rpx;
  color: #666;
  padding: 10rpx 0;
  margin-right: 20rpx;
}

.dash-title {
  font-size: 30rpx;
  font-weight: bold;
}

/* 日期 tabs */
.date-tabs {
  display: flex;
  gap: 12rpx;
  margin-bottom: 20rpx;
}

.date-tab {
  font-size: 24rpx;
  color: #666;
  background: #f5f5f5;
  padding: 10rpx 24rpx;
  border-radius: 20rpx;
}

.date-tab.active {
  background: #d32f2f;
  color: #fff;
}

/* 统计卡片 */
.stats-row {
  display: flex;
  gap: 16rpx;
  margin-bottom: 16rpx;
}

.stat-card {
  flex: 1;
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx 16rpx;
  text-align: center;
  box-shadow: 0 2rpx 10rpx rgba(0,0,0,0.04);
}

.stat-card-debt {
  background: linear-gradient(135deg, #fff5f5, #ffebee);
}

.stat-card-placeholder {
  visibility: hidden;
}

.stat-value {
  font-size: 40rpx;
  font-weight: bold;
  color: #333;
}

.stat-warn { color: #f44336; }
.stat-debt { color: #d32f2f; }

.stat-label {
  font-size: 22rpx;
  color: #999;
  margin-top: 8rpx;
}

/* 趋势图 */
.section {
  margin-bottom: 24rpx;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: bold;
}

.section-more {
  font-size: 24rpx;
  color: #2196f3;
}

.trend-chart {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  background: #fff;
  border-radius: 12rpx;
  padding: 24rpx 12rpx 12rpx;
  height: 200rpx;
}

.trend-bar-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  height: 100%;
}

.trend-bar-label {
  font-size: 18rpx;
  color: #999;
  margin-bottom: 4rpx;
}

.trend-bar {
  width: 32rpx;
  background: linear-gradient(180deg, #ef5350, #d32f2f);
  border-radius: 4rpx 4rpx 0 0;
  min-height: 4rpx;
  transition: height 0.3s;
}

.trend-day-label {
  font-size: 18rpx;
  color: #999;
  margin-top: 8rpx;
}

/* 缺货列表 */
.shortage-item {
  background: #fff;
  border-radius: 12rpx;
  padding: 20rpx;
  margin-bottom: 12rpx;
  border-left: 6rpx solid transparent;
}

.so-out { border-left-color: #f44336; }
.so-low { border-left-color: #ff9800; }

.si-status {
  font-size: 22rpx;
  margin-bottom: 6rpx;
}

.si-name {
  font-size: 28rpx;
  font-weight: 500;
}

.si-meta {
  font-size: 22rpx;
  color: #999;
  margin-top: 6rpx;
}

/* 排行 */
.rank-list {
  background: #fff;
  border-radius: 12rpx;
  overflow: hidden;
}

.rank-item {
  display: flex;
  align-items: center;
  padding: 16rpx 20rpx;
  border-bottom: 1rpx solid #f5f5f5;
}

.rank-item:last-child {
  border-bottom: none;
}

.rank-num {
  width: 48rpx;
  height: 48rpx;
  line-height: 48rpx;
  text-align: center;
  font-size: 28rpx;
  font-weight: bold;
  color: #999;
  background: #f5f5f5;
  border-radius: 50%;
  flex-shrink: 0;
}

.rank-top1 { background: #ffd700; color: #fff; }
.rank-top2 { background: #c0c0c0; color: #fff; }
.rank-top3 { background: #cd7f32; color: #fff; }

.rank-info {
  flex: 1;
  margin-left: 16rpx;
  overflow: hidden;
}

.rank-name {
  font-size: 26rpx;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rank-meta {
  font-size: 22rpx;
  color: #999;
  margin-top: 4rpx;
}

.rank-sales {
  width: 200rpx;
  flex-shrink: 0;
  margin-left: 16rpx;
}

.rank-amount {
  font-size: 26rpx;
  font-weight: bold;
  color: #d32f2f;
  text-align: right;
  margin-bottom: 6rpx;
}

.rank-bar-bg {
  height: 8rpx;
  background: #f0f0f0;
  border-radius: 4rpx;
  overflow: hidden;
}

.rank-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #ff9800, #f44336);
  border-radius: 4rpx;
  min-width: 8rpx;
}

.empty-state {
  text-align: center;
  padding: 40rpx 0;
  color: #999;
  font-size: 26rpx;
  background: #fff;
  border-radius: 12rpx;
}
```

- [ ] **Step 4: 验证**

演示模式下，厂长登录 → 仪表盘：
- 日期 tabs（今天/近7天/近30天）可切换，数据跟着变
- 6 个统计卡片（订单数/销售额/待处理/未收款/缺货预警/+占位）
- 近7天趋势柱状图可见
- 客户消费排行显示温州服装厂和陈大明
- 产品销量排行的条状图正确

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\86153\Desktop\wenzhou-xietiao-pifa\miniprogram"
git add pages/admin/dashboard/
git commit -m "feat: enhance dashboard with date filter, customer ranking, debt stats, and sales trend"
```

---

### Task 3: 管理后台订单加付款状态标记

**Files:**
- Modify: `pages/admin/orders/orders.js`
- Modify: `pages/admin/orders/orders.wxml`
- Modify: `pages/admin/orders/orders.wxss`

- [ ] **Step 1: orders.js — 付款状态数据映射 + 标记方法**

在 `loadOrders()` 的 demo 分支订单映射中（`orders.map(order => ({...})`），给每个订单加付款状态文本：

在已有映射对象中加入：
```js
paymentStatusText: order.payment_status === 'paid' ? '已付款' : '未付款',
```

在云函数分支同样处理。

添加两个方法，放在 `onTogglePickedUp` 方法之后：

```js
// 标记已付款/未付款
async onTogglePayment(e) {
  const { orderId } = e.currentTarget.dataset;
  const app = getApp();

  if (app.globalData.demoMode) {
    const update = (list) => {
      const o = list.find(o => o._id === orderId);
      if (o) {
        if (o.payment_status === 'paid') {
          o.payment_status = 'unpaid';
          o.paid_amount = 0;
        } else {
          o.payment_status = 'paid';
          o.paid_amount = o.totalAmount;
        }
      }
    };
    update(app.globalData.demoOrders);
    const saved = wx.getStorageSync('demoOrders') || [];
    update(saved);
    wx.setStorageSync('demoOrders', saved);
    wx.showToast({ title: '已更新', icon: 'success' });
    this.loadOrders();
    return;
  }

  try {
    const res = await wx.cloud.callFunction({
      name: 'adminUpdateOrderStatus',
      data: {
        orderId,
        payment_status: this.data.orders.find(o => o._id === orderId).payment_status === 'paid' ? 'unpaid' : 'paid'
      }
    });
    if (res.result.code === 0) {
      wx.showToast({ title: '已更新', icon: 'success' });
      this.loadOrders();
    }
  } catch (err) {
    wx.showToast({ title: '操作失败', icon: 'none' });
  }
},
```

- [ ] **Step 2: orders.wxml — 订单卡片加付款状态 badge 和标记按钮**

在订单头部的 badges 区域（status badge 旁边），添加付款状态 badge。找到：
```html
<view class="badge badge-{{item.status}}">{{item.statusText}}</view>
```
在后面（同 header-badges 内）添加：
```html
<view class="badge badge-payment-{{item.payment_status}}">{{item.paymentStatusText}}</view>
```

在订单底部操作区（footer-actions 内），添加标记已付/未付按钮。找到 `<!-- 更改状态 -->` 的按钮，在其前面添加：
```html
<!-- 标记已付/未付（厂长可见） -->
<view wx:if="{{isManager}}" class="payment-toggle-btn {{item.payment_status === 'paid' ? 'pt-paid' : 'pt-unpaid'}}" data-order-id="{{item._id}}" catchtap="onTogglePayment">
  {{item.payment_status === 'paid' ? '✓ 已付款' : '标记已付'}}
</view>
```

- [ ] **Step 3: orders.wxss — 付款状态样式**

添加付款状态 badge 和按钮样式：
```css
/* 付款状态 badge */
.badge-payment-paid {
  background: #e8f5e9;
  color: #2e7d32;
}

.badge-payment-unpaid {
  background: #fff3e0;
  color: #e65100;
}

/* 标记已付/未付按钮 */
.payment-toggle-btn {
  font-size: 22rpx;
  padding: 8rpx 18rpx;
  border-radius: 6rpx;
}

.pt-unpaid {
  color: #ff9800;
  border: 1rpx solid #ff9800;
}

.pt-unpaid:active {
  background: #fff3e0;
}

.pt-paid {
  color: #2e7d32;
  background: #e8f5e9;
  border: 1rpx solid #a5d6a7;
}
```

- [ ] **Step 4: 验证**

演示模式下，厂长登录后台：
- o001 显示绿色"已付款"badge，o002/o003 显示橙色"未付款"badge
- 点击 o002 的"标记已付"按钮 → badge 变为"已付款"
- 再点击一次 toggle 回"未付款"
- 送货员/调货员不应看到标记按钮

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\86153\Desktop\wenzhou-xietiao-pifa\miniprogram"
git add pages/admin/orders/
git commit -m "feat: add payment status badge and paid/unpaid toggle to admin orders"
```

---

### Task 4: 客户管理列表加欠款显示

**Files:**
- Modify: `pages/admin/customers/customers.js`
- Modify: `pages/admin/customers/customers.wxml`
- Modify: `pages/admin/customers/customers.wxss`

- [ ] **Step 1: customers.js — 数据映射加 debtText**

在 `formatCustomers` 方法中，给每个客户对象加 `debtText`。当前返回：
```js
return {
  ...c,
  discountLabel: c.discount < 1 ? (c.discount * 10).toFixed(1).replace(/\.0$/, '') + '折' : '',
  amountText: (c.totalAmount / 100).toFixed(2)
};
```
改为：
```js
return {
  ...c,
  discountLabel: c.discount < 1 ? (c.discount * 10).toFixed(1).replace(/\.0$/, '') + '折' : '',
  amountText: (c.totalAmount / 100).toFixed(2),
  debtText: c.debt > 0 ? ((c.debt / 100).toFixed(2)) : ''
};
```

同时在 `loadCustomers()` 的 demo 分支中，如果客户没有 debt 字段（旧数据兼容），需要从订单计算。在 demo 分支的 `customers.map` 之前加：
```js
// 从订单计算欠款（兼容旧客户数据无debt字段）
const allOrders = [...(wx.getStorageSync('demoOrders') || []), ...(app.globalData.demoOrders || [])];
customers = customers.map(c => {
  if (c.debt === undefined) {
    c.debt = allOrders
      .filter(o => o.phone === c.phone && o.payment_status === 'unpaid')
      .reduce((sum, o) => sum + (o.totalAmount || 0) - (o.paid_amount || 0), 0);
  }
  return c;
});
```

- [ ] **Step 2: customers.wxml — 欠款显示**

在客户卡片的 `cust-discount` 区域（累计订单后），加欠款显示。找到：
```html
<text wx:if="{{item.totalOrders > 0}}" class="cust-stats">累计{{item.totalOrders}}单 ¥{{item.amountText}}</text>
```
在后面加：
```html
<text wx:if="{{item.debtText}}" class="cust-debt">欠款 ¥{{item.debtText}}</text>
```

- [ ] **Step 3: customers.wxss — 欠款高亮样式**

在文件末尾添加：
```css
.cust-debt {
  font-size: 24rpx;
  color: #f44336;
  font-weight: 500;
  margin-left: 16rpx;
}
```

- [ ] **Step 4: 验证**

演示模式下，厂长 → 客户管理：
- 陈大明应显示橙色"欠款 ¥150.00"
- 温州服装厂不显示欠款（debt=0 被 wx:if 过滤）

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\86153\Desktop\wenzhou-xietiao-pifa\miniprogram"
git add pages/admin/customers/
git commit -m "feat: show customer debt in admin customer list"
```

---

### Task 5: 下单时写入 payment_status 默认值

**Files:**
- Modify: `pages/checkout/checkout.js`

- [ ] **Step 1: checkout.js — onSubmit 订单数据加字段**

在 `onSubmit()` 方法中，`orderData` 对象目前包含 status/createdAt 等字段。在 `createdAt` 后面加两个字段：

```js
const orderData = {
  customerName: customerName.trim(),
  phone: phone.trim(),
  address: address.trim(),
  remark: this.data.form.remark.trim(),
  items: this.data.items.map(item => ({
    productId: item._id,
    name: item.name,
    price: item.price,
    quantity: item.quantity,
    unit: item.unit
  })),
  totalAmount: Math.round(parseFloat(this.data.totalAmount) * 100),
  discount: this.data.customerDiscount,
  deliveryMethod: this.data.deliveryMethod,
  status: 'processing',
  payment_status: 'unpaid',
  paid_amount: 0,
  location: this.data.pickedLocation || undefined,
  createdAt: new Date().toISOString()
};
```

注意：`updateExistingOrder` 分支也需同样处理。在构建 `orderData` 后、调用 `updateExistingOrder` 前，确保 `payment_status` 和 `paid_amount` 已包含。

- [ ] **Step 2: 验证**

演示模式下：
- 打开首页 → 加购 → 结算 → 提交订单
- 进入厂长后台 → 订单列表，新订单应显示"未付款"badge

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\86153\Desktop\wenzhou-xietiao-pifa\miniprogram"
git add pages/checkout/checkout.js
git commit -m "feat: set default payment_status=unpaid and paid_amount=0 on order submit"
```

---

## 自检清单

1. **Spec 覆盖检查：**
   - [x] P0-② 日期筛选（今天/近7天/近30天）— Task 2
   - [x] P0-② 销售额趋势（近7天柱状图）— Task 2
   - [x] P0-② 客户消费排行（按消费金额Top10）— Task 2
   - [x] P0-② 待处理订单数统计 — Task 2
   - [x] P0-③ 订单 payment_status (paid/unpaid) + paid_amount — Task 1, 3, 5
   - [x] P0-③ 客户 debt 欠款汇总 — Task 1, 4
   - [x] P0-③ 一键标记已付/未付 — Task 3
   - [x] P0-③ 客户列表欠款显示 — Task 4

2. **无空占位符：** 所有步骤含完整代码。

3. **类型一致性：**
   - `payment_status`: `'paid' | 'unpaid'` 全篇统一
   - `paid_amount` / `debt`: 单位"分"，全篇统一
   - `dateRange`: `'today' | '7days' | '30days'` 全篇统一
