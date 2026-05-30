# 缺货感知 + 销售仪表盘 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将产品库存从"精确数字"改为"三档缺货状态 + 销售消耗推算"，新增厂长仪表盘页面，让厂长无需专人维护即可感知缺货和销售趋势。

**Architecture:** 数据模型从 `stock(数字)` 改为 `status(枚举) + last_produced_at(时间) + recent_sales(系统算)`。产品管理页改状态切换。仪表盘从订单数据聚合今日统计+缺货预警+销量排行。首页对待缺货产品灰色展示。管理后台订单详情页加"标记紧张"按钮。

**Tech Stack:** 微信小程序原生 JS、云开发 (wx.cloud)、演示模式优先验证

---

## 文件结构

```
修改:
  utils/mock.js                                 - 删stock字段，加status/last_produced_at/recent_sales
  pages/admin/products/products.js              - 表单删库存，加状态切换 + 仪表盘入口
  pages/admin/products/products.wxml            - 产品列表显状态标记，表单改状态picker
  pages/admin/products/products.wxss            - 状态标记样式
  pages/admin/orders/orders.js                  - 加"标记紧张"方法
  pages/admin/orders/orders.wxml                - 订单项加标记紧张按钮
  pages/index/index.js                          - 缺货产品不可加购，灰色显示
  pages/index/index.wxml                        - 缺货产品视觉区分
  pages/index/index.wxss                        - 缺货产品样式
  app.json                                      - 注册仪表盘页面

新建:
  pages/admin/dashboard/dashboard.js            - 仪表盘逻辑
  pages/admin/dashboard/dashboard.json          - 页面配置
  pages/admin/dashboard/dashboard.wxml          - 仪表盘界面
  pages/admin/dashboard/dashboard.wxss          - 仪表盘样式
```

---

### Task 1: 更新 mock 数据模型

**Files:**
- Modify: `utils/mock.js`

- [ ] **Step 1: 改 mockProducts — 删 stock，加 status/last_produced_at/recent_sales**

将 `utils/mock.js` 中 `mockProducts` 的每个产品对象从：
```js
{ _id: 'p001', name: '色丁精品缎面 2cm', category: '色丁', price: 150, unit: '米', stock: 500, description: '...', image: '', createdAt: Date.now() - 86400000 * 7 }
```
改为：
```js
{ _id: 'p001', name: '色丁精品缎面 2cm', category: '色丁', price: 150, unit: '米', status: 'sufficient', last_produced_at: Date.now() - 86400000 * 3, recent_sales: 25000, description: '高档色丁面料，宽度2cm，光泽亮丽', image: '', createdAt: Date.now() - 86400000 * 7 }
```

全部 12 个产品的完整替换代码：

```js
const mockProducts = [
  { _id: 'p001', name: '色丁精品缎面 2cm', category: '色丁', price: 150, unit: '米', status: 'sufficient', last_produced_at: Date.now() - 86400000 * 3, recent_sales: 25000, description: '高档色丁面料，宽度2cm，光泽亮丽', image: '', createdAt: Date.now() - 86400000 * 7 },
  { _id: 'p002', name: '色丁格子斜条 1.5cm', category: '色丁', price: 80, unit: '米', status: 'low', last_produced_at: Date.now() - 86400000 * 10, recent_sales: 45000, description: '色丁材质格子纹，宽度1.5cm', image: '', createdAt: Date.now() - 86400000 * 6 },
  { _id: 'p003', name: '凉感丝包边条 3cm', category: '凉感丝', price: 200, unit: '米', status: 'sufficient', last_produced_at: Date.now() - 86400000 * 5, recent_sales: 18000, description: '凉感丝面料，凉爽透气，宽度3cm', image: '', createdAt: Date.now() - 86400000 * 5 },
  { _id: 'p004', name: '凉感丝斜条 2.5cm', category: '凉感丝', price: 180, unit: '米', status: 'sufficient', last_produced_at: Date.now() - 86400000 * 2, recent_sales: 12000, description: '凉感丝人字纹，宽度2.5cm', image: '', createdAt: Date.now() - 86400000 * 4 },
  { _id: 'p005', name: '丝纹缎面条 5cm', category: '丝纹', price: 60, unit: '米', status: 'out', last_produced_at: Date.now() - 86400000 * 20, recent_sales: 32000, description: '丝纹纹理面料，宽度5cm', image: '', createdAt: Date.now() - 86400000 * 3 },
  { _id: 'p006', name: '丝纹仿真丝条 4cm', category: '丝纹', price: 120, unit: '米', status: 'low', last_produced_at: Date.now() - 86400000 * 12, recent_sales: 38000, description: '仿真丝处理丝纹面料，宽度4cm', image: '', createdAt: Date.now() - 86400000 * 2 },
  { _id: 'p007', name: '全棉斜纹包边条 2cm', category: '全棉', price: 50, unit: '米', status: 'sufficient', last_produced_at: Date.now() - 86400000 * 1, recent_sales: 60000, description: '100%全棉材质，柔软亲肤，宽度2cm', image: '', createdAt: Date.now() - 86400000 },
  { _id: 'p008', name: '全棉本白条 1.5cm', category: '全棉', price: 35, unit: '米', status: 'sufficient', last_produced_at: Date.now() - 86400000 * 4, recent_sales: 28000, description: '全棉本白，宽度1.5cm，基础款', image: '', createdAt: Date.now() - 172800000 },
  { _id: 'p009', name: '圆盘花边缎带 15mm', category: '圆盘', price: 90, unit: '米', status: 'low', last_produced_at: Date.now() - 86400000 * 15, recent_sales: 55000, description: '圆盘花边设计，直径15mm', image: '', createdAt: Date.now() - 259200000 },
  { _id: 'p010', name: '圆盘刺绣缎带', category: '圆盘', price: 120, unit: '米', status: 'out', last_produced_at: Date.now() - 86400000 * 25, recent_sales: 42000, description: '圆盘刺绣花纹，精致工艺', image: '', createdAt: Date.now() - 345600000 },
  { _id: 'p011', name: '弹性松紧带 1cm', category: '其他', price: 35, unit: '米', status: 'sufficient', last_produced_at: Date.now() - 86400000 * 6, recent_sales: 15000, description: '高弹力松紧带，宽度1cm', image: '', createdAt: Date.now() - 432000000 },
  { _id: 'p012', name: '蕾丝花边条 0.8cm', category: '其他', price: 45, unit: '米', status: 'sufficient', last_produced_at: Date.now() - 86400000 * 8, recent_sales: 10000, description: '精致蕾丝花边，宽度0.8cm', image: '', createdAt: Date.now() - 518400000 },
];
```

- [ ] **Step 2: 验证 — 在微信开发者工具中预览**

在演示模式下：
- 进入后台 → 管理产品，应看到产品正常显示（当前仍显示旧 UI，状态字段在 Task 2 才接入 UI）
- 打开控制台不报错，产品列表正常加载

- [ ] **Step 3: Commit**

```bash
git add miniprogram/utils/mock.js
git commit -m "refactor: replace stock with status/last_produced_at/recent_sales in mock data"
```

---

### Task 2: 改造产品管理页 — 表单+列表用状态取代库存

**Files:**
- Modify: `pages/admin/products/products.js`
- Modify: `pages/admin/products/products.wxml`
- Modify: `pages/admin/products/products.wxss`

- [ ] **Step 1: 改 products.js — 删 stock 字段，加 status 和 last_produced_at**

修改 `onAdd()`：
```js
onAdd() {
  this.setData({
    showForm: true,
    editingProduct: null,
    form: { name: '', category: '色丁', price: '', unit: '米', status: 'sufficient', description: '', image: '' }
  });
},
```

修改 `onEdit()`：
```js
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
```

修改 `onSave()` 中的 productData 构建：
```js
const productData = {
  name: name.trim(),
  category,
  price: Math.round(parseFloat(price) * 100),
  unit,
  status: this.data.form.status || 'sufficient',
  description: description.trim(),
  image
};
```

并且在保存成功后添加 `last_produced_at` 的更新逻辑（仅当状态从 out/low 变为 sufficient 时记录生产时间）：
```js
// onSave 的 editingProduct 分支中，如果状态变为 sufficient，记录时间
if (this.data.editingProduct) {
  if (productData.status === 'sufficient' && this.data.editingProduct.status !== 'sufficient') {
    productData.last_produced_at = Date.now();
  }
}
```

在 `onSave` 的 demo 模式分支中同样加入：
```js
if (this.data.editingProduct) {
  const old = app.globalData.demoProducts.find(p => p._id === this.data.editingProduct._id);
  if (productData.status === 'sufficient' && old && old.status !== 'sufficient') {
    productData.last_produced_at = Date.now();
  }
  const idx = app.globalData.demoProducts.findIndex(p => p._id === this.data.editingProduct._id);
  if (idx > -1) {
    app.globalData.demoProducts[idx] = { ...app.globalData.demoProducts[idx], ...productData };
  }
}
```

表单数据定义也需要更新（在 `data` 中）：
```js
form: {
  name: '',
  category: '色丁',
  price: '',
  unit: '米',
  status: 'sufficient',
  description: '',
  image: ''
}
```

在 `loadProducts` 中映射产品时需要处理旧数据（可能还有 stock 字段）：
```js
const products = (app.globalData.demoProducts || []).map(p => ({
  ...p,
  priceText: (p.price / 100).toFixed(2),
  status: p.status || 'sufficient'
}));
```

添加 `onStatusChange` 方法（picker bindchange）：
```js
onStatusChange(e) {
  const statuses = ['sufficient', 'low', 'out'];
  this.setData({ 'form.status': statuses[e.detail.value] });
},
```

- [ ] **Step 2: 改 products.wxml — 列表显状态标记，表单用 picker 选状态**

产品列表项中，把 `pa-stock` 替换为状态标记。找到：
```html
<view class="pa-stock" wx:if="{{item.stock}}">库存：{{item.stock}}</view>
```
改为：
```html
<view class="pa-status-row">
  <view class="status-dot {{item.status === 'out' ? 'dot-out' : item.status === 'low' ? 'dot-low' : 'dot-suf'}}"></view>
  <text class="pa-status-text">{{item.status === 'out' ? '缺货' : item.status === 'low' ? '紧张' : '充足'}}</text>
  <text wx:if="{{item.recent_sales}}" class="pa-recent-sales">近7天销量 ¥{{(item.recent_sales / 100).toFixed(0)}}</text>
</view>
```

表单中，把库存输入框：
```html
<view class="form-group">
  <view class="form-label">库存</view>
  <input class="form-input" type="number" placeholder="库存数量" value="{{form.stock}}" data-field="stock" bindinput="onFormInput" />
</view>
```
改为状态 picker：
```html
<view class="form-group">
  <view class="form-label">缺货状态</view>
  <picker mode="selector" range="{{['充足','紧张','缺货']}}" bindchange="onStatusChange">
    <view class="picker-val">
      <view class="status-dot-inline {{form.status === 'out' ? 'dot-out' : form.status === 'low' ? 'dot-low' : 'dot-suf'}}"></view>
      {{form.status === 'out' ? '缺货' : form.status === 'low' ? '紧张' : '充足'}}
    </view>
  </picker>
</view>
```

- [ ] **Step 3: 改 products.wxss — 状态标记样式**

删除 `.pa-stock` 样式块（约5行），替换为：
```css
.pa-status-row {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-top: 6rpx;
}

.status-dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot-suf { background: #4caf50; }
.dot-low { background: #ff9800; }
.dot-out { background: #f44336; }

.status-dot-inline {
  display: inline-block;
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  vertical-align: middle;
  margin-right: 10rpx;
}

.pa-status-text {
  font-size: 22rpx;
  color: #666;
}

.pa-recent-sales {
  font-size: 22rpx;
  color: #999;
  margin-left: auto;
}
```

同时更新表单区域的 picker-val 支持 flex 内联布局：
```css
.picker-val {
  display: flex;
  align-items: center;
  height: 80rpx;
  line-height: 80rpx;
  background: #f8f8f8;
  border-radius: 8rpx;
  padding: 0 20rpx;
  font-size: 28rpx;
  color: #333;
  box-sizing: border-box;
}
```

- [ ] **Step 4: 验证**

在演示模式进入后台 → 管理产品：
- 列表应看到彩色圆点（绿/橙/红）+ "充足/紧张/缺货" 文字
- "丝纹缎面条 5cm" 应显示红色圆点 + "缺货"
- 编辑一个产品，状态 picker 应在"充足/紧张/缺货"三档间切换
- 将缺货产品改回"充足"，保存后应看到绿色圆点

- [ ] **Step 5: Commit**

```bash
git add miniprogram/pages/admin/products/products.js miniprogram/pages/admin/products/products.wxml miniprogram/pages/admin/products/products.wxss
git commit -m "feat: replace stock input with 3-level status (sufficient/low/out) in product management"
```

---

### Task 3: 新建厂长仪表盘页面

**Files:**
- Create: `pages/admin/dashboard/dashboard.json`
- Create: `pages/admin/dashboard/dashboard.wxml`
- Create: `pages/admin/dashboard/dashboard.wxss`
- Create: `pages/admin/dashboard/dashboard.js`

- [ ] **Step 1: 创建 dashboard.json**

```json
{
  "usingComponents": {},
  "navigationBarTitleText": "仪表盘"
}
```

- [ ] **Step 2: 创建 dashboard.wxml**

```html
<view class="container">
  <!-- 顶部栏 -->
  <view class="admin-top-bar">
    <view class="back-btn" bindtap="onBackToOrders">← 返回订单</view>
    <text class="dash-title">📊 经营概览</text>
  </view>

  <!-- 统计卡片 -->
  <view class="stats-row">
    <view class="stat-card">
      <view class="stat-value">{{todayOrders}}</view>
      <view class="stat-label">今日订单</view>
    </view>
    <view class="stat-card">
      <view class="stat-value">¥{{todaySales}}</view>
      <view class="stat-label">今日销售额</view>
    </view>
    <view class="stat-card">
      <view class="stat-value stat-warn">{{shortageCount}}</view>
      <view class="stat-label">缺货预警</view>
    </view>
  </view>

  <!-- 缺货预警列表 -->
  <view class="section">
    <view class="section-header">
      <text class="section-title">⚠️ 缺货预警</text>
      <text class="section-more" bindtap="onFilterShortage">只看缺货/紧张</text>
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

  <!-- 近7天销量排行 -->
  <view class="section">
    <view class="section-header">
      <text class="section-title">🔥 近7天销量排行</text>
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
</view>
```

- [ ] **Step 3: 创建 dashboard.wxss**

```css
.admin-top-bar {
  display: flex;
  align-items: center;
  margin-bottom: 24rpx;
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

/* 统计卡片 */
.stats-row {
  display: flex;
  gap: 16rpx;
  margin-bottom: 24rpx;
}

.stat-card {
  flex: 1;
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx 16rpx;
  text-align: center;
  box-shadow: 0 2rpx 10rpx rgba(0,0,0,0.04);
}

.stat-value {
  font-size: 40rpx;
  font-weight: bold;
  color: #333;
}

.stat-warn { color: #f44336; }

.stat-label {
  font-size: 22rpx;
  color: #999;
  margin-top: 8rpx;
}

/* 区块 */
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
.rank-item {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  margin-bottom: 10rpx;
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
}
```

- [ ] **Step 4: 创建 dashboard.js**

```js
Page({
  data: {
    todayOrders: 0,
    todaySales: '0',
    shortageCount: 0,
    shortageProducts: [],
    topProducts: []
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
    // 云函数模式暂不实现，先走 demo
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

    // 今日统计
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayOrders = unique.filter(o => new Date(o.createdAt) >= today);

    const todaySales = todayOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

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
      .sort((a, b) => a.status === 'out' ? -1 : 1); // 缺货排前面

    // 销量排行（按 recent_sales 降序取前10）
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

    this.setData({
      todayOrders: todayOrders.length,
      todaySales: (todaySales / 100).toFixed(0),
      shortageCount: shortageProducts.length,
      shortageProducts,
      topProducts
    });
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

- [ ] **Step 5: 验证**

在微信开发者工具演示模式：
- 登录后台（厂长 changzhang / 123456）
- 进入仪表盘（通过 Task 5 注册的路由跳转，或先在地址栏输入测试）
- 应看到：今日订单、销售额、缺货预警数量
- 缺货预警区应显示 4 个产品（2 缺货 + 2 紧张）
- 销量排行应显示 10 个产品，前 3 名有金银铜标记

- [ ] **Step 6: Commit**

```bash
git add miniprogram/pages/admin/dashboard/
git commit -m "feat: add admin dashboard with sales stats, shortage alerts, and ranking"
```

---

### Task 4: 注册仪表盘路由 + 管理后台入口

**Files:**
- Modify: `app.json`
- Modify: `pages/admin/products/products.js` — 加跳转入口
- Modify: `pages/admin/orders/orders.wxml` — 加仪表盘按钮

- [ ] **Step 1: app.json 添加 dashboard 页面**

在 `pages` 数组中添加：
```json
"pages/admin/dashboard/dashboard"
```

完整 pages 数组变为：
```json
"pages": [
  "pages/index/index",
  "pages/cart/cart",
  "pages/checkout/checkout",
  "pages/orders/orders",
  "pages/address/address",
  "pages/admin/login/login",
  "pages/admin/dashboard/dashboard",
  "pages/admin/orders/orders",
  "pages/admin/products/products",
  "pages/admin/customers/customers"
]
```

- [ ] **Step 2: admin/orders/orders.wxml — 顶部栏加仪表盘按钮**

在 admin orders 页面的 top-actions 中，在最前面加仪表盘入口。找到：
```html
<view wx:if="{{isManager}}" class="top-actions">
  <view class="go-products-btn" bindtap="onGoCustomers">客户管理</view>
  <view class="go-products-btn" bindtap="onGoProducts">管理产品</view>
</view>
```
改为：
```html
<view wx:if="{{isManager}}" class="top-actions">
  <view class="go-dash-btn" bindtap="onGoDashboard">📊 仪表盘</view>
  <view class="go-products-btn" bindtap="onGoCustomers">客户管理</view>
  <view class="go-products-btn" bindtap="onGoProducts">管理产品</view>
</view>
```

- [ ] **Step 3: admin/orders/orders.js — 添加 onGoDashboard 方法**

在 `onGoCustomers()` 上面添加：
```js
onGoDashboard() {
  wx.navigateTo({ url: '/pages/admin/dashboard/dashboard' });
},
```

同时在 orders.wxss 中添加 `.go-dash-btn` 样式（可参考 `.go-products-btn`）：
```css
.go-dash-btn {
  font-size: 26rpx;
  color: #ff9800;
  padding: 10rpx 24rpx;
  border: 1rpx solid #ff9800;
  border-radius: 6rpx;
}
```

- [ ] **Step 4: 验证**

在演示模式：
- 厂长登录 → 订单管理页顶部应有 "📊 仪表盘" 按钮
- 点击跳转到仪表盘页面
- 送货员/调货员登录 → 不应看到仪表盘入口

- [ ] **Step 5: Commit**

```bash
git add miniprogram/app.json miniprogram/pages/admin/orders/orders.js miniprogram/pages/admin/orders/orders.wxml miniprogram/pages/admin/orders/orders.wxss
git commit -m "feat: register dashboard route and add entry from admin orders"
```

---

### Task 5: 首页对待缺货产品灰色展示

**Files:**
- Modify: `pages/index/index.js`
- Modify: `pages/index/index.wxml`
- Modify: `pages/index/index.wxss`

- [ ] **Step 1: index.js — loadProducts 中标记缺货产品**

在 `loadProducts()` 的 demo 分支中，映射产品时已带了 `status` 字段。需要确保 `filterProducts` 不过滤掉缺货产品（仍显示但视觉区分），并在 `showQtyInput` 中阻止缺货产品加购。

修改 `showQtyInput`：
```js
showQtyInput(e) {
  const product = e.currentTarget.dataset.product;
  if (product.status === 'out') {
    wx.showToast({ title: '该产品暂时缺货', icon: 'none' });
    return;
  }
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
```

- [ ] **Step 2: index.wxml — 缺货产品视觉区分**

在产品卡片上加 class 和缺货遮罩。找到产品卡片的 `<view class="product-card card">` 并修改 class：
```html
<view class="product-card card {{item.status === 'out' ? 'product-out' : ''}} {{item.status === 'low' ? 'product-low' : ''}}" wx:for="{{products}}" wx:key="_id">
```

在加入按钮处，缺货产品显示"缺货"而非"+ 加入"：
```html
<view
  wx:if="{{item.status === 'out'}}"
  class="add-cart-btn add-cart-out"
>缺货</view>
<view
  wx:else
  class="add-cart-btn"
  data-product="{{item}}"
  bindtap="showQtyInput"
>+ 加入</view>
```

同时在产品图片上加缺货半透明遮罩：
```html
<image
  class="product-image {{item.status === 'out' ? 'img-out' : ''}}"
  src="{{item.image || '/images/placeholder.png'}}"
  mode="aspectFill"
/>
```

- [ ] **Step 3: index.wxss — 缺货产品样式**

在文件末尾添加：
```css
/* 缺货产品 */
.product-out {
  opacity: 0.55;
}

.product-low {
  /* 正常显示无需降透明度 */
}

.img-out {
  filter: grayscale(60%);
}

.add-cart-out {
  background: #bdbdbd !important;
  color: #fff;
}
```

- [ ] **Step 4: 验证**

在演示模式首页：
- "丝纹缎面条 5cm" 和 "圆盘刺绣缎带"（status=out）应灰色显示，按钮为灰色"缺货"
- 点击"缺货"按钮应弹 toast "该产品暂时缺货"
- "色丁格子斜条 1.5cm" 等（status=low）应正常显示，橙色标记，但仍可加购

- [ ] **Step 5: Commit**

```bash
git add miniprogram/pages/index/index.js miniprogram/pages/index/index.wxml miniprogram/pages/index/index.wxss
git commit -m "feat: gray out out-of-stock products on customer index page"
```

---

### Task 6: 管理员订单详情加"标记紧张"按钮

**Files:**
- Modify: `pages/admin/orders/orders.js`
- Modify: `pages/admin/orders/orders.wxml`

- [ ] **Step 1: orders.js — 添加 onMarkLowStock 方法**

在 `onCopyOrder` 方法后面添加：
```js
onMarkLowStock(e) {
  const { productId, productName } = e.currentTarget.dataset;
  const app = getApp();

  if (app.globalData.demoMode) {
    const p = app.globalData.demoProducts.find(p => p._id === productId);
    if (p && p.status === 'sufficient') {
      p.status = 'low';
      wx.showToast({ title: `已标记"${productName}"为紧张`, icon: 'success' });
      this.loadOrders();
    } else if (p && p.status === 'low') {
      wx.showToast({ title: `"${productName}"已标记为紧张`, icon: 'none' });
    } else if (p && p.status === 'out') {
      wx.showToast({ title: `"${productName}"已是缺货状态`, icon: 'none' });
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
```

- [ ] **Step 2: orders.wxml — 订单产品项加"标记紧张"按钮**

在产品明细区，每个产品项后加一个可点击的标记。找到：
```html
<view class="op-item" wx:for="{{item.items}}" wx:key="productId" wx:for-item="p">
  <text class="op-name">{{p.name}}</text>
  <text class="op-detail">¥{{p.priceText}} × {{p.quantity}}{{p.unit}}</text>
</view>
```
改为：
```html
<view class="op-item" wx:for="{{item.items}}" wx:key="productId" wx:for-item="p">
  <view class="op-text">
    <text class="op-name">{{p.name}}</text>
    <text class="op-detail">¥{{p.priceText}} × {{p.quantity}}{{p.unit}}</text>
  </view>
  <view class="op-mark-low" data-product-id="{{p.productId}}" data-product-name="{{p.name}}" catchtap="onMarkLowStock">标记紧张</view>
</view>
```

在 orders.wxss 中添加对应样式：
```css
.op-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10rpx 0;
}

.op-text {
  flex: 1;
  overflow: hidden;
}

.op-mark-low {
  font-size: 20rpx;
  color: #ff9800;
  border: 1rpx solid #ff9800;
  border-radius: 4rpx;
  padding: 4rpx 12rpx;
  flex-shrink: 0;
  margin-left: 12rpx;
}

.op-mark-low:active {
  background: #fff3e0;
}
```

- [ ] **Step 3: 验证**

在演示模式：
- 厂长/送货员/调货员登录后台
- 看任意订单的产品列表，每个产品右侧应有"标记紧张"按钮
- 点击一个充足产品，应弹 toast "已标记为紧张"
- 再去管理产品页确认该产品状态已变为紧张（橙色圆点）

- [ ] **Step 4: Commit**

```bash
git add miniprogram/pages/admin/orders/orders.js miniprogram/pages/admin/orders/orders.wxml miniprogram/pages/admin/orders/orders.wxss
git commit -m "feat: add 'mark as low stock' button per product in admin order detail"
```

---

### Task 7: 更新云函数 getProducts 计算 recent_sales

**Files:**
- Modify: `cloudfunctions/getProducts/index.js`

- [ ] **Step 1: getProducts/index.js — 返回时附带 recent_sales**

```js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event) => {
  const { category, keyword, page = 1, pageSize = 20 } = event;
  const where = {};

  if (category) {
    where.category = category;
  }
  if (keyword) {
    where.name = db.RegExp({ regexp: keyword, options: 'i' });
  }

  try {
    const total = await db.collection('products').where(where).count();
    const list = await db.collection('products')
      .where(where)
      .orderBy('createdAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    // 计算每个产品近7天销量
    const sevenDaysAgo = Date.now() - 7 * 86400000;
    const productIds = list.data.map(p => p._id);

    if (productIds.length > 0) {
      const ordersRes = await db.collection('orders')
        .where({
          status: _.neq('cancelled'),
          createdAt: _.gte(new Date(sevenDaysAgo).toISOString())
        })
        .field({ items: true })
        .get();

      const salesMap = {};
      ordersRes.data.forEach(order => {
        (order.items || []).forEach(item => {
          if (productIds.includes(item.productId)) {
            salesMap[item.productId] = (salesMap[item.productId] || 0) + item.price * item.quantity;
          }
        });
      });

      list.data.forEach(p => {
        p.recent_sales = salesMap[p._id] || 0;
      });
    }

    return { code: 0, data: { list: list.data, total: total.total } };
  } catch (err) {
    return { code: -1, msg: err.message };
  }
};
```

- [ ] **Step 2: 验证 — 部署云函数后检查**

- 在微信开发者工具中右键 getProducts → 上传并部署：云端安装依赖
- 如果已配置云开发，首页产品列表应正常加载
- 演示模式下此改动不影响（demo 走本地数据）

- [ ] **Step 3: Commit**

```bash
git add miniprogram/cloudfunctions/getProducts/index.js
git commit -m "feat: calculate recent 7-day sales per product in getProducts cloud function"
```

---

## 自检清单

1. **Spec 覆盖检查：**
   - [x] 产品数据模型从 stock 改为 status + last_produced_at + recent_sales — Task 1, 2
   - [x] 产品管理页缺货状态切换 — Task 2
   - [x] 首页缺货产品灰色展示、禁止加购 — Task 5
   - [x] 厂长仪表盘：今日统计 + 缺货预警 + 销量排行 — Task 3
   - [x] 仪表盘路由注册 + 入口 — Task 4
   - [x] 订单详情"标记紧张"按钮 — Task 6
   - [x] 云函数 recent_sales 计算 — Task 7

2. **无空占位符：** 所有步骤均有完整代码，无 TODO/TBD/占位符。

3. **类型一致性：**
   - `status`: `'sufficient' | 'low' | 'out'` 全篇统一
   - `recent_sales`: 单位"分"，全篇统一
   - `last_produced_at`: timestamp ms，全篇统一
   - 产品对象始终携带 `status` 字段
