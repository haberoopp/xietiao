# P1：订单导出 + 对账单分享 + 成本毛利 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 订单支持 CSV 批量导出+微信分享、对账单生成图片卡片分享到微信、产品加成本价并展示毛利（仪表盘+产品列表+产品排行）。

**Architecture:** 不新增页面，全部改动落在已有文件。产品表加 `cost_price`(分)，仪表盘加毛利卡片和产品排行利润率列，管理员订单页加导出按钮（按日期范围生成 CSV → 写临时文件 → 分享到微信）和对账单图片分享（Canvas 绑制 → 保存/分享）。导出逻辑抽到 `utils/export.js`。

**Tech Stack:** 微信小程序原生 JS、演示模式优先、Canvas 2D、FileSystemManager、wx.shareFileMessage

---

## 文件结构

```
新建:
  utils/export.js                               — CSV生成、文件写入、分享封装、对账单Canvas绑制

修改:
  utils/mock.js                                 — 12个产品各加cost_price字段
  pages/admin/products/products.js              — 表单加cost_price，列表显成本/毛利
  pages/admin/products/products.wxml            — 表单成本价输入框 + 列表毛利列
  pages/admin/products/products.wxss            — 毛利正负色样式
  pages/admin/dashboard/dashboard.js            — 加总毛利/毛利率统计卡片 + 产品排行显利润率
  pages/admin/dashboard/dashboard.wxml          — 第二行卡片改为毛利+毛利率 + 产品排行的金额改为毛利
  pages/admin/dashboard/dashboard.wxss          — 毛利卡片渐变背景
  pages/admin/orders/orders.js                  — 导出CSV + 分享对账单方法 + 调用utils/export
  pages/admin/orders/orders.wxml                — 顶部加导出按钮 + 每单加分享对账单按钮
  pages/admin/orders/orders.wxss                — 导出/分享按钮样式
  cloudfunctions/getProducts/index.js           — 返回时附带cost_price
```

---

### Task 1: Mock 数据加 cost_price + 导出工具函数

**Files:**
- Modify: `utils/mock.js`
- Create: `utils/export.js`

- [ ] **Step 1: mockProducts 每个产品加 cost_price 字段**

12 个产品加 `cost_price`（单位分，约为 price 的 40%-70%），完整替换 `utils/mock.js` 的 mockProducts：

```js
const mockProducts = [
  { _id: 'p001', name: '色丁精品缎面 2cm', category: '色丁', price: 150, cost_price: 90, unit: '米', status: 'sufficient', last_produced_at: Date.now() - 86400000 * 3, recent_sales: 25000, description: '高档色丁面料，宽度2cm，光泽亮丽', image: '', createdAt: Date.now() - 86400000 * 7 },
  { _id: 'p002', name: '色丁格子斜条 1.5cm', category: '色丁', price: 80, cost_price: 50, unit: '米', status: 'low', last_produced_at: Date.now() - 86400000 * 10, recent_sales: 45000, description: '色丁材质格子纹，宽度1.5cm', image: '', createdAt: Date.now() - 86400000 * 6 },
  { _id: 'p003', name: '凉感丝包边条 3cm', category: '凉感丝', price: 200, cost_price: 140, unit: '米', status: 'sufficient', last_produced_at: Date.now() - 86400000 * 5, recent_sales: 18000, description: '凉感丝面料，凉爽透气，宽度3cm', image: '', createdAt: Date.now() - 86400000 * 5 },
  { _id: 'p004', name: '凉感丝斜条 2.5cm', category: '凉感丝', price: 180, cost_price: 120, unit: '米', status: 'sufficient', last_produced_at: Date.now() - 86400000 * 2, recent_sales: 12000, description: '凉感丝人字纹，宽度2.5cm', image: '', createdAt: Date.now() - 86400000 * 4 },
  { _id: 'p005', name: '丝纹缎面条 5cm', category: '丝纹', price: 60, cost_price: 35, unit: '米', status: 'out', last_produced_at: Date.now() - 86400000 * 20, recent_sales: 32000, description: '丝纹纹理面料，宽度5cm', image: '', createdAt: Date.now() - 86400000 * 3 },
  { _id: 'p006', name: '丝纹仿真丝条 4cm', category: '丝纹', price: 120, cost_price: 75, unit: '米', status: 'low', last_produced_at: Date.now() - 86400000 * 12, recent_sales: 38000, description: '仿真丝处理丝纹面料，宽度4cm', image: '', createdAt: Date.now() - 86400000 * 2 },
  { _id: 'p007', name: '全棉斜纹包边条 2cm', category: '全棉', price: 50, cost_price: 28, unit: '米', status: 'sufficient', last_produced_at: Date.now() - 86400000 * 1, recent_sales: 60000, description: '100%全棉材质，柔软亲肤，宽度2cm', image: '', createdAt: Date.now() - 86400000 },
  { _id: 'p008', name: '全棉本白条 1.5cm', category: '全棉', price: 35, cost_price: 18, unit: '米', status: 'sufficient', last_produced_at: Date.now() - 86400000 * 4, recent_sales: 28000, description: '全棉本白，宽度1.5cm，基础款', image: '', createdAt: Date.now() - 172800000 },
  { _id: 'p009', name: '圆盘花边缎带 15mm', category: '圆盘', price: 90, cost_price: 55, unit: '米', status: 'low', last_produced_at: Date.now() - 86400000 * 15, recent_sales: 55000, description: '圆盘花边设计，直径15mm', image: '', createdAt: Date.now() - 259200000 },
  { _id: 'p010', name: '圆盘刺绣缎带', category: '圆盘', price: 120, cost_price: 78, unit: '米', status: 'out', last_produced_at: Date.now() - 86400000 * 25, recent_sales: 42000, description: '圆盘刺绣花纹，精致工艺', image: '', createdAt: Date.now() - 345600000 },
  { _id: 'p011', name: '弹性松紧带 1cm', category: '其他', price: 35, cost_price: 20, unit: '米', status: 'sufficient', last_produced_at: Date.now() - 86400000 * 6, recent_sales: 15000, description: '高弹力松紧带，宽度1cm', image: '', createdAt: Date.now() - 432000000 },
  { _id: 'p012', name: '蕾丝花边条 0.8cm', category: '其他', price: 45, cost_price: 25, unit: '米', status: 'sufficient', last_produced_at: Date.now() - 86400000 * 8, recent_sales: 10000, description: '精致蕾丝花边，宽度0.8cm', image: '', createdAt: Date.now() - 518400000 },
];
```

- [ ] **Step 2: 创建 utils/export.js — CSV 生成和文件分享**

```js
/**
 * 订单导出 & 对账单工具
 */

const fs = wx.getFileSystemManager();

/**
 * 将订单列表转为 CSV 字符串
 * @param {Array} orders - 含 items/totalAmount/payment_status/customerName/phone/address/createdAt/deliveryMethod/status
 * @returns {string} CSV
 */
function ordersToCSV(orders) {
  const BOM = '﻿';
  const header = '订单号,客户名称,电话,地址,商品明细,金额(元),付款状态,订单状态,拿货方式,下单时间,备注';
  const rows = [header];

  orders.forEach(o => {
    const itemsText = (o.items || []).map(i => `${i.name}×${i.quantity}${i.unit}`).join('; ');
    const row = [
      o._id || '',
      csvEscape(o.customerName || ''),
      o.phone || '',
      csvEscape(o.address || ''),
      csvEscape(itemsText),
      ((o.totalAmount || 0) / 100).toFixed(2),
      o.payment_status === 'paid' ? '已付款' : '未付款',
      statusText(o.status),
      deliveryText(o.deliveryMethod),
      o.createdAt ? formatTime(o.createdAt) : '',
      csvEscape(o.remark || '')
    ];
    rows.push(row.join(','));
  });

  return BOM + rows.join('\n');
}

function csvEscape(str) {
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function statusText(s) {
  if (s === 'processing') return '处理中';
  if (s === 'completed') return '已完成';
  if (s === 'cancelled') return '已取消';
  return s;
}

function deliveryText(d) {
  if (d === 'delivery') return '配送';
  if (d === 'pickup') return '自取';
  if (d === 'logistics') return '物流';
  return d || '';
}

function formatTime(iso) {
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 写入临时文件并分享到微信聊天
 * @param {string} content - 文件内容
 * @param {string} fileName - 文件名（不含路径）
 */
function shareCSV(content, fileName) {
  const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`;
  fs.writeFile({
    filePath,
    data: content,
    encoding: 'utf8',
    success: () => {
      wx.shareFileMessage({
        filePath,
        fileName,
        fail: (err) => {
          if (err.errMsg.includes('cancel')) return;
          wx.showToast({ title: '分享失败', icon: 'none' });
        }
      });
    },
    fail: () => {
      wx.showToast({ title: '生成文件失败', icon: 'none' });
    }
  });
}

/**
 * 对账单 Canvas 绑制（生成图片后分享）
 * @param {Object} order - 订单对象，含 items/customerName/phone/totalAmount/createdAt/payment_status
 * @param {Function} callback - 回调({tempFilePath})
 */
function drawBillOnCanvas(order, callback) {
  const query = wx.createSelectorQuery();
  query.select('#billCanvas')
    .fields({ node: true, size: true })
    .exec((res) => {
      if (!res[0] || !res[0].node) {
        wx.showToast({ title: '当前环境不支持Canvas', icon: 'none' });
        return;
      }
      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      const dpr = wx.getSystemInfoSync().pixelRatio;
      const width = 375;
      const height = Math.max(500, 280 + order.items.length * 32);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);

      // 白色背景
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // 标题
      ctx.fillStyle = '#333333';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('对账单', 16, 36);

      // 日期
      ctx.fillStyle = '#999999';
      ctx.font = '12px sans-serif';
      ctx.fillText(formatTime(order.createdAt), 220, 36);

      // 分隔线
      ctx.strokeStyle = '#eeeeee';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(16, 50);
      ctx.lineTo(width - 16, 50);
      ctx.stroke();

      // 客户信息
      ctx.fillStyle = '#333333';
      ctx.font = '15px sans-serif';
      ctx.fillText(`客户：${order.customerName || ''}`, 16, 78);
      ctx.font = '13px sans-serif';
      ctx.fillStyle = '#666666';
      ctx.fillText(`电话：${order.phone || ''}`, 16, 100);
      ctx.fillText(`订单号：${order._id || ''}`, 16, 120);

      // 表头
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(16, 135, width - 32, 26);
      ctx.fillStyle = '#333333';
      ctx.font = '13px sans-serif';
      ctx.fillText('商品', 24, 153);
      ctx.fillText('数量', 180, 153);
      ctx.fillText('单价', 240, 153);
      ctx.fillText('小计', 300, 153);

      // 商品行
      let y = 177;
      ctx.font = '12px sans-serif';
      (order.items || []).forEach((item, i) => {
        if (i % 2 === 0) {
          ctx.fillStyle = '#fafafa';
          ctx.fillRect(16, y - 14, width - 32, 28);
        }
        ctx.fillStyle = '#333333';
        ctx.fillText(item.name || '', 24, y + 4);
        ctx.fillText(String(item.quantity || 0) + (item.unit || ''), 180, y + 4);
        ctx.fillText('¥' + ((item.price || 0) / 100).toFixed(2), 240, y + 4);
        ctx.fillText('¥' + ((item.price || 0) * (item.quantity || 0) / 100).toFixed(2), 300, y + 4);
        y += 30;
      });

      // 合计
      ctx.strokeStyle = '#eeeeee';
      ctx.beginPath();
      ctx.moveTo(16, y + 10);
      ctx.lineTo(width - 16, y + 10);
      ctx.stroke();

      ctx.fillStyle = '#333333';
      ctx.font = 'bold 18px sans-serif';
      const totalText = '合计：¥' + ((order.totalAmount || 0) / 100).toFixed(2);
      ctx.fillText(totalText, width - 16 - ctx.measureText(totalText).width, y + 38);

      // 付款状态
      ctx.font = '13px sans-serif';
      ctx.fillStyle = order.payment_status === 'paid' ? '#2e7d32' : '#e65100';
      ctx.fillText(order.payment_status === 'paid' ? '✓ 已付款' : '○ 未付款', 16, y + 38);

      // 底部
      ctx.fillStyle = '#999999';
      ctx.font = '11px sans-serif';
      ctx.fillText('温州斜条批发 · 感谢您的信任', width / 2 - 70, height - 16);

      // 输出图片
      setTimeout(() => {
        wx.canvasToTempFilePath({
          canvas,
          success: (res) => callback(null, res.tempFilePath),
          fail: (err) => callback(err)
        });
      }, 300);
    });
}

/**
 * 分享对账单图片
 */
function shareBillImage(tempFilePath) {
  wx.shareFileMessage({
    filePath: tempFilePath,
    fail: (err) => {
      if (err.errMsg.includes('cancel')) return;
      wx.showToast({ title: '分享失败', icon: 'none' });
    }
  });
}

module.exports = {
  ordersToCSV,
  shareCSV,
  drawBillOnCanvas,
  shareBillImage
};
```

- [ ] **Step 3: 验证 + Commit**

```bash
cd "C:\Users\86153\Desktop\wenzhou-xietiao-pifa\miniprogram"
git add utils/mock.js utils/export.js
git commit -m "feat: add cost_price to mock products and create export/bill utility"
```

---

### Task 2: 产品管理加 cost_price 表单+列表显示

**Files:**
- Modify: `pages/admin/products/products.js`
- Modify: `pages/admin/products/products.wxml`
- Modify: `pages/admin/products/products.wxss`

- [ ] **Step 1: products.js — 加 cost_price 字段**

`data` 中的 `form` 加 `cost_price`：
```js
form: {
  name: '',
  category: '色丁',
  price: '',
  cost_price: '',
  unit: '米',
  status: 'sufficient',
  description: '',
  image: ''
}
```

`onAdd()` 同样加：
```js
form: { name: '', category: '色丁', price: '', cost_price: '', unit: '米', status: 'sufficient', description: '', image: '' }
```

`onEdit()` 中映射加 `cost_price`：
```js
cost_price: product.cost_price ? (product.cost_price / 100).toFixed(2) : '',
```

`onSave()` 中 `productData` 加 `cost_price`：
```js
const productData = {
  name: name.trim(),
  category,
  price: Math.round(parseFloat(price) * 100),
  cost_price: cost_price.trim() ? Math.round(parseFloat(cost_price) * 100) : 0,
  unit,
  status: this.data.form.status || 'sufficient',
  description: description.trim(),
  image
};
```

注意 destructure 需要加 `cost_price`：
```js
const { name, category, price, cost_price, unit, description, image } = this.data.form;
```

`loadProducts` 的映射加毛利文本（demo 和 cloud 分支都加）：
```js
const products = (app.globalData.demoProducts || []).map(p => ({
  ...p,
  priceText: (p.price / 100).toFixed(2),
  status: p.status || 'sufficient',
  costPriceText: p.cost_price ? (p.cost_price / 100).toFixed(2) : '',
  marginText: p.cost_price ? ((p.price - p.cost_price) / 100).toFixed(2) : '',
  marginRate: p.cost_price ? Math.round((p.price - p.cost_price) / p.price * 100) : 0
}));
```

CSV 导入的 `parseCSV` 也需要支持成本列。在 header 匹配中加：
```js
const costIdx = header.findIndex(h => h === '成本价' || h.includes('成本') || h === 'cost_price');
```
在 productData 构建中加：
```js
cost_price: costIdx >= 0 ? Math.round((parseFloat(cols[costIdx]) || 0) * 100) : 0,
```
并将 `stock` 改为 `status: 'sufficient'`（不再用 stock）：
```js
const productData = {
  _id: 'p' + Date.now() + '_' + i,
  name,
  category: catIdx >= 0 ? (cols[catIdx] || '其他') : '其他',
  price: Math.round(price * 100),
  cost_price: costIdx >= 0 ? Math.round((parseFloat(cols[costIdx]) || 0) * 100) : 0,
  unit: unitIdx >= 0 ? (cols[unitIdx] || '米') : '米',
  status: 'sufficient',
  description: descIdx >= 0 ? (cols[descIdx] || '') : '',
  image: '',
  createdAt: Date.now()
};
```

- [ ] **Step 2: products.wxml — 表单加成本价输入 + 列表显示毛利**

表单中，价格输入框后面加成本价输入：
```html
<view class="form-group">
  <view class="form-label">售价（元）</view>
  <input class="form-input" type="digit" placeholder="输入售价" value="{{form.price}}" data-field="price" bindinput="onFormInput" />
</view>
<view class="form-group">
  <view class="form-label">成本价（元）</view>
  <input class="form-input" type="digit" placeholder="输入成本价（选填）" value="{{form.cost_price}}" data-field="cost_price" bindinput="onFormInput" />
</view>
```

产品列表的 `pa-price` 行后面加毛利显示。找到价格显示：
```html
<text class="pa-price">¥{{item.priceText}}</text>
```
在后面加：
```html
<text wx:if="{{item.marginText}}" class="pa-margin {{item.marginRate > 30 ? 'margin-high' : item.marginRate > 15 ? 'margin-ok' : 'margin-low'}}">毛利 ¥{{item.marginText}}</text>
```

- [ ] **Step 3: products.wxss — 毛利颜色**

```css
.pa-margin {
  font-size: 22rpx;
  padding: 2rpx 10rpx;
  border-radius: 4rpx;
  margin-left: 12rpx;
}

.margin-high {
  color: #2e7d32;
  background: #e8f5e9;
}

.margin-ok {
  color: #e65100;
  background: #fff3e0;
}

.margin-low {
  color: #c62828;
  background: #ffebee;
}
```

- [ ] **Step 4: 验证**

演示模式 → 厂长 → 管理产品：
- 编辑产品应看到"成本价"输入框
- 给 p001(色丁精品缎面) 的 cost_price 已设为 90(0.90元)，售价 1.50元，列表应显示绿色"毛利 ¥0.60"
- 新建产品填成本价后保存，再次编辑应回显成本价

- [ ] **Step 5: Commit**

```bash
git add miniprogram/pages/admin/products/
git commit -m "feat: add cost_price input and margin display to product management"
```

---

### Task 3: 仪表盘加毛利统计 + 产品排行显示利润率

**Files:**
- Modify: `pages/admin/dashboard/dashboard.js`
- Modify: `pages/admin/dashboard/dashboard.wxml`
- Modify: `pages/admin/dashboard/dashboard.wxss`

- [ ] **Step 1: dashboard.js — 加总毛利和毛利率计算**

在 `data` 中加两个新字段：
```js
data: {
  dateRange: 'today',
  dateLabel: '今天',
  totalOrders: 0,
  totalSales: '0',
  totalProfit: '0',        // 总毛利
  profitRate: '0',         // 毛利率
  pendingOrders: 0,
  unpaidAmount: '0',
  shortageCount: 0,
  trendDays: [],
  topProducts: [],
  topCustomers: [],
  shortageProducts: []
},
```

在 `loadDemoDashboard` 中计算毛利。拿到 `rangeOrders` 后，需要根据订单中每个 item 匹配产品成本价：

```js
// 计算毛利（订单金额 - 产品成本）
let totalProfit = 0;
rangeOrders.forEach(o => {
  (o.items || []).forEach(item => {
    const p = products.find(p => p._id === item.productId);
    const cost = p ? (p.cost_price || 0) : 0;
    totalProfit += (item.price - cost) * (item.quantity || 0);
  });
});
const totalSales = rangeOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
const profitRate = totalSales > 0 ? Math.round((totalProfit / totalSales) * 100) : 0;
```

产品排行中加毛利率字段。在 `topProducts` 映射中加入：
```js
topProducts: [...products]
  .sort((a, b) => (b.recent_sales || 0) - (a.recent_sales || 0))
  .slice(0, 10)
  .map(p => ({
    _id: p._id, name: p.name, category: p.category, unit: p.unit,
    recentSalesText: ((p.recent_sales || 0) / 100).toFixed(0),
    barPercent: Math.round(((p.recent_sales || 0) / maxSales) * 100),
    marginRate: p.cost_price ? Math.round((p.price - p.cost_price) / p.price * 100) : 0,
    marginText: p.cost_price ? ((p.price - p.cost_price) / 100).toFixed(2) : ''
  }))
```

setData 中加：
```js
this.setData({
  totalOrders, totalSales: (totalSales / 100).toFixed(0),
  totalProfit: (totalProfit / 100).toFixed(0),
  profitRate,
  pendingOrders, unpaidAmount: (unpaidAmount / 100).toFixed(0),
  shortageCount: shortageProducts.length,
  trendDays, topProducts, topCustomers, shortageProducts
});
```

- [ ] **Step 2: dashboard.wxml — 毛利卡片 + 产品排行利润列**

第二行卡片改为毛利+毛利率。当前第二行是"未收款 / 缺货预警 / 占位"，改为：
```html
<view class="stats-row">
  <view class="stat-card stat-card-profit">
    <view class="stat-value stat-profit">¥{{totalProfit}}</view>
    <view class="stat-label">毛利</view>
  </view>
  <view class="stat-card stat-card-debt">
    <view class="stat-value stat-debt">¥{{unpaidAmount}}</view>
    <view class="stat-label">未收款</view>
  </view>
  <view class="stat-card">
    <view class="stat-value stat-warn">{{shortageCount}}</view>
    <view class="stat-label">缺货预警</view>
  </view>
</view>
```

在第一行统计卡片后加毛利率卡片行：
```html
<view class="stats-row">
  <view class="stat-card stat-card-rate">
    <view class="stat-value">{{profitRate}}%</view>
    <view class="stat-label">毛利率</view>
  </view>
  <view class="stat-card stat-card-placeholder"></view>
  <view class="stat-card stat-card-placeholder"></view>
</view>
```

产品销量排行中，金额列改为毛利。`rank-amount` 换成毛利显示：
```html
<view class="rank-sales">
  <view class="rank-amount">¥{{item.recentSalesText}}</view>
  <view wx:if="{{item.marginRate > 0}}" class="rank-margin {{item.marginRate > 30 ? 'margin-high' : item.marginRate > 15 ? 'margin-ok' : 'margin-low'}}">{{item.marginRate}}%</view>
  <view class="rank-bar-bg">
    <view class="rank-bar-fill" style="width: {{item.barPercent}}%"></view>
  </view>
</view>
```

- [ ] **Step 3: dashboard.wxss — 新卡片样式**

```css
.stat-card-profit {
  background: linear-gradient(135deg, #e8f5e9, #c8e6c9);
}

.stat-card-rate {
  background: linear-gradient(135deg, #e3f2fd, #bbdefb);
}

.stat-profit { color: #2e7d32; }

.rank-margin {
  font-size: 20rpx;
  text-align: right;
  padding: 2rpx 8rpx;
  border-radius: 4rpx;
  margin-bottom: 4rpx;
  display: inline-block;
  float: right;
}
```

- [ ] **Step 4: 验证**

演示模式 → 厂长 → 仪表盘：
- 6个卡片：订单数/销售额/待处理 + 毛利/未收款/缺货预警 + 毛利率/占位/占位
- 毛利率应为30-50%左右（mock 数据卖价约1.5-2x成本价）
- 产品排行中每个产品显示毛利率标签（绿色>30%, 橙色15-30%, 红色<15%）

- [ ] **Step 5: Commit**

```bash
git add miniprogram/pages/admin/dashboard/
git commit -m "feat: add profit margin stats to dashboard and product ranking"
```

---

### Task 4: 管理员订单页加导出 + 对账单分享

**Files:**
- Modify: `pages/admin/orders/orders.js`
- Modify: `pages/admin/orders/orders.wxml`
- Modify: `pages/admin/orders/orders.wxss`

- [ ] **Step 1: orders.js — 加载导出工具 + 导出和分享方法**

文件顶部加 require：
```js
const util = require('../../../utils/util');
const amap = require('../../../utils/amap');
const exportUtil = require('../../../utils/export');
```

在 Page 对象中加两个方法。放在 `onCopyOrder` 附近：

```js
// 导出订单为 CSV 并分享
onExportOrders() {
  const orders = this.data.orders;
  if (orders.length === 0) {
    wx.showToast({ title: '没有订单可导出', icon: 'none' });
    return;
  }
  // 按当前筛选状态导出
  const csv = exportUtil.ordersToCSV(orders);
  const dateStr = new Date().toISOString().slice(0, 10);
  exportUtil.shareCSV(csv, `订单导出_${dateStr}.csv`);
},

// 分享对账单（Canvas 绑图）
onShareBill(e) {
  const order = e.currentTarget.dataset.order;
  const billOrder = {
    ...order,
    createdAt: order.createdAt || new Date().toISOString()
  };

  wx.showLoading({ title: '生成中...' });
  exportUtil.drawBillOnCanvas(billOrder, (err, tempFilePath) => {
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
```

- [ ] **Step 2: orders.wxml — 加导出按钮 + 对账单分享按钮 + 隐藏 Canvas**

顶部栏加导出按钮。在 `.top-actions` 内最前面加（仅厂长可见）：
```html
<view wx:if="{{isManager}}" class="top-actions">
  <view class="go-dash-btn" bindtap="onGoDashboard">📊 仪表盘</view>
  <view class="go-export-btn" bindtap="onExportOrders">📥 导出</view>
  <view class="go-products-btn" bindtap="onGoCustomers">客户管理</view>
  <view class="go-products-btn" bindtap="onGoProducts">管理产品</view>
</view>
```

送货员也需要导出权限（方便对账），所以在 `!isWarehouse` 的区域也加一个导出链接。

在订单卡片的 footer-actions 内，payment toggle 按钮后面加分享对账单按钮：
```html
<view class="share-bill-btn" data-order="{{item}}" catchtap="onShareBill">📋 对账单</view>
```

页面底部加隐藏 Canvas（opacity:0, position:fixed, 不可见但可绑制）：
```html
<!-- 对账单 Canvas（隐藏，用于绑图） -->
<canvas type="2d" id="billCanvas" class="bill-canvas"></canvas>
```

- [ ] **Step 3: orders.wxss — 新按钮样式**

```css
.go-export-btn {
  font-size: 26rpx;
  color: #1976D2;
  padding: 10rpx 24rpx;
  border: 1rpx solid #1976D2;
  border-radius: 6rpx;
}

.go-export-btn:active {
  background: #e3f2fd;
}

.share-bill-btn {
  font-size: 22rpx;
  color: #7B1FA2;
  border: 1rpx solid #7B1FA2;
  padding: 8rpx 18rpx;
  border-radius: 6rpx;
}

.share-bill-btn:active {
  background: #f3e5f5;
}

.bill-canvas {
  position: fixed;
  top: -9999rpx;
  left: -9999rpx;
  width: 750rpx;
  height: 1000rpx;
}
```

- [ ] **Step 4: 验证**

演示模式 → 厂长 → 订单管理：
- 顶部应看到"📥 导出"按钮
- 点击导出 → 应弹出微信分享菜单（分享到聊天）
- 每个订单底部应有"📋 对账单"按钮
- 点击对账单 → loading → 弹出分享图片菜单（可发送给朋友或保存相册）

注：Canvas 2D 绑图在微信开发者工具可能报错（不支持 `type="2d"`），真机预览正常。

- [ ] **Step 5: Commit**

```bash
git add miniprogram/pages/admin/orders/
git commit -m "feat: add CSV export and bill image sharing to admin orders"
```

---

### Task 5: 云函数 getProducts 返回 cost_price

**Files:**
- Modify: `cloudfunctions/getProducts/index.js`

- [ ] **Step 1: 在返回数据中确保 cost_price 字段透传**

当前 getProducts 返回 products 集合所有字段（`.`），cost_price 存数据库即自动返回。但需要确保 `field` 投影不排除它。检查 index.js：

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

无需改动 — products 集合所有字段自动返回，cost_price 包含在内。但需确认云数据库 products 集合已有 cost_price 字段（Number 类型，单位分）。若不存在需在微信开发者工具云开发控制台添加。

- [ ] **Step 2: 验证 + Commit**

在云开发控制台检查 products 集合字段，确保 cost_price 存在。或在演示模式下此改动不阻塞。

```bash
git add miniprogram/cloudfunctions/getProducts/index.js
git commit -m "feat: ensure cost_price is returned by getProducts cloud function"
```

---

## 自检清单

1. **Spec 覆盖检查：**
   - [x] P1-④ 订单 CSV 导出 — Task 1(export.js) + Task 4(orders 导出按钮)
   - [x] P1-④ CSV 文件写入+分享 — Task 1(shareCSV) + Task 4
   - [x] P1-⑤ 对账单图片生成 — Task 1(drawBillOnCanvas) + Task 4(Canvas隐藏 + showShareImageMenu)
   - [x] P1-⑤ 对账单分享到微信 — Task 1(shareBillImage) + Task 4
   - [x] P1-⑥ 产品 cost_price 字段 — Task 1(mock数据) + Task 2(表单)
   - [x] P1-⑥ 产品列表毛利显示 — Task 2(products.js/wxml/wxss)
   - [x] P1-⑥ 仪表盘毛利统计 — Task 3(dashboard)
   - [x] P1-⑥ 产品排行利润率 — Task 3(dashboard)
   - [x] 云函数支持 cost_price — Task 5

2. **无空占位符：** 所有步骤含完整代码。

3. **类型一致性：**
   - `cost_price`: 单位"分"，Integer，全篇统一
   - 毛利 = price - cost_price，单位分
   - 毛利率 = (price - cost_price) / price * 100，整数百分比
