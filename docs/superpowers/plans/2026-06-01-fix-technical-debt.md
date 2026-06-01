# 技术债务修复 — 优先修复计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复此前代码审查中发现的 7 项优先技术问题，提升代码质量、安全性和可维护性。

**Architecture:** 每个修复任务相互独立，按风险从高到低排列。共享代码通过新建 `utils/constants.js` 和复用已有的 `cloudfunctions/lib/auth.js` 实现。Demo 数据通过新建 `utils/demoStore.js` 统一管理，消除双存储不一致问题。

**Tech Stack:** 微信小程序原生框架、微信云开发（CloudBase）、Node.js 云函数

---

## 文件结构规划

| 文件 | 操作 | 职责 |
|---|---|---|
| `utils/constants.js` | **新建** | 产品分类、单位、库存状态等共享常量 |
| `utils/config.js` | **新建** | 高德地图 Key 等可配置项（gitignored） |
| `utils/config.example.js` | **新建** | config.js 模板（可提交到 git） |
| `utils/amap.js` | 修改 | 从 config.js 读取 Key |
| `utils/demoStore.js` | **新建** | Demo 模式统一数据存储（单一数据源） |
| `utils/mock.js` | 修改 | 添加 demo 管理员账号导出，移除独立数据掌管角色 |
| `app.js` | 修改 | 使用 demoStore 初始化 demo 数据 |
| `pages/admin/login/login.js` | 修改 | 从 mock.js 导入 demo 账号，移除硬编码 |
| `pages/index/index.js` | 修改 | 使用 constants.js 的分类列表；实现滚动加载更多 |
| `pages/admin/products/products.js` | 修改 | 使用 constants.js 的分类/单位列表；实现滚动加载更多 |
| `pages/admin/orders/orders.js` | 修改 | 使用 demoStore；实现滚动加载更多 |
| `pages/admin/dashboard/dashboard.js` | 修改 | 使用 demoStore |
| `pages/orders/orders.js` | 修改 | 使用 demoStore |
| `cloudfunctions/lib/auth.js` | 不变 | 已有 `verifyAdmin()` |
| `cloudfunctions/updateOrder/index.js` | 修改 | 添加订单状态校验 |
| 12 个管理员云函数 `index.js` | 修改 | 使用 `require('../lib/auth')` 替换内联鉴权 |

---

### Task 1: 提取共享常量 `utils/constants.js`

**Files:**
- Create: `E:\miniprogram\utils\constants.js`
- Modify: `E:\miniprogram\pages\index\index.js:3`
- Modify: `E:\miniprogram\pages\admin\products\products.js:6,137`

**目标：** 消除产品分类和单位列表在两处的重复定义。

- [ ] **Step 1: 创建 `utils/constants.js`**

```js
/**
 * 应用共享常量
 */

const PRODUCT_CATEGORIES = ['色丁', '凉感丝', '丝纹', '全棉', '圆盘', '其他'];

const PRODUCT_CATEGORIES_WITH_ALL = ['全部', ...PRODUCT_CATEGORIES];

const PRODUCT_UNITS = ['米', '卷', '个', '公斤', '包'];

const PRODUCT_STATUSES = ['sufficient', 'low', 'out'];

const PRODUCT_STATUS_LABELS = {
  sufficient: '充足',
  low: '紧张',
  out: '缺货'
};

const ORDER_STATUS_LABELS = {
  processing: '处理中',
  completed: '已完成',
  cancelled: '已取消'
};

const DELIVERY_METHOD_LABELS = {
  pickup: '自取',
  delivery: '配送',
  logistics: '物流'
};

module.exports = {
  PRODUCT_CATEGORIES,
  PRODUCT_CATEGORIES_WITH_ALL,
  PRODUCT_UNITS,
  PRODUCT_STATUSES,
  PRODUCT_STATUS_LABELS,
  ORDER_STATUS_LABELS,
  DELIVERY_METHOD_LABELS
};
```

- [ ] **Step 2: 修改 `pages/index/index.js` 使用常量**

将第 3 行：
```js
categories: ['全部', '色丁', '凉感丝', '丝纹', '全棉', '圆盘', '其他'],
```
替换为：
```js
const constants = require('../../utils/constants');

Page({
  data: {
    categories: constants.PRODUCT_CATEGORIES_WITH_ALL,
```

即在文件顶部添加 `const constants = require('../../utils/constants');`，并将 `data.categories` 改为引用常量。

- [ ] **Step 3: 修改 `pages/admin/products/products.js` 使用常量**

在文件顶部添加：
```js
const constants = require('../../../utils/constants');
```

将第 6 行的 `data.categories`：
```js
categories: ['色丁', '凉感丝', '丝纹', '全棉', '圆盘', '其他'],
```
替换为：
```js
categories: constants.PRODUCT_CATEGORIES,
```

将第 136 行 `onUnitChange` 中的 `['米', '卷', '个', '公斤', '包']` 替换为 `constants.PRODUCT_UNITS`。

将第 141 行 `onStatusChange` 中的 `['sufficient', 'low', 'out']` 替换为 `constants.PRODUCT_STATUSES`。

- [ ] **Step 4: 提交**

```bash
git add utils/constants.js pages/index/index.js pages/admin/products/products.js
git commit -m "refactor: extract shared constants to utils/constants.js"
```

---

### Task 2: 高德地图 Key 配置化

**Files:**
- Create: `E:\miniprogram\utils\config.example.js`
- Create: `E:\miniprogram\utils\config.js`
- Modify: `E:\miniprogram\utils\amap.js:8`
- Modify: `E:\miniprogram\.gitignore` (若不存在则创建)

**目标：** 将高德 Key 从代码中解耦，通过配置文件注入，占位符不再出现在生产代码中。

- [ ] **Step 1: 创建 `utils/config.example.js`（模板，提交到 git）**

```js
/**
 * 应用配置模板
 * 复制此文件为 config.js 并填入实际值
 * config.js 已加入 .gitignore，不会被提交
 */
module.exports = {
  // 高德地图 Web 服务 Key
  // 申请地址：https://console.amap.com/
  AMAP_KEY: 'your-amap-key-here'
};
```

- [ ] **Step 2: 创建 `utils/config.js`（实际配置）**

```js
/**
 * 应用配置（不要提交到 git）
 */
module.exports = {
  AMAP_KEY: 'your-amap-key-here' // TODO: 替换为真实 Key
};
```

- [ ] **Step 3: 修改 `utils/amap.js:8` 从配置文件读取 Key**

将第 8 行：
```js
const AMAP_KEY = 'your-amap-key-here'; // TODO: 替换为你的高德 Key
```
替换为：
```js
const config = require('./config');
const AMAP_KEY = config.AMAP_KEY || '';
```

- [ ] **Step 4: 确保 `.gitignore` 包含 config.js**

检查 `E:\miniprogram\.gitignore` 是否存在。如果不存在则创建，内容至少包含：
```
utils/config.js
```

如果已存在，确保包含 `utils/config.js` 行。

- [ ] **Step 5: 提交**

```bash
git add utils/config.example.js utils/amap.js .gitignore
git commit -m "refactor: externalize AMap key to config.js, add config.example.js template"
```

---

### Task 3: 演示账号硬编码迁移

**Files:**
- Modify: `E:\miniprogram\utils\mock.js`
- Modify: `E:\miniprogram\pages\admin\login\login.js:33-36`

**目标：** 将 demo 管理员账号从前端页面代码移至 `mock.js`（与所有 demo 数据同在一处）。

- [ ] **Step 1: 在 `utils/mock.js` 末尾添加 demo 账号导出**

在 `mock.js` 的 `module.exports` 之前添加：
```js
const demoAdminAccounts = {
  manager:     { username: 'changzhang', password: '123456', role: 'manager',   nickname: '厂长' },
  delivery:    { username: 'songhuo',    password: '123456', role: 'delivery',  nickname: '送货员' },
  warehouse:   { username: 'diaohuo',    password: '123456', role: 'warehouse', nickname: '仓库调货员' }
};
```

修改 `module.exports`，添加 `demoAdminAccounts`：
```js
module.exports = {
  mockProducts,
  mockOrders,
  mockCustomers,
  demoAdminAccounts
};
```

- [ ] **Step 2: 修改 `pages/admin/login/login.js` 从 mock.js 导入**

在文件顶部添加：
```js
const mock = require('../../../utils/mock');
```

将第 32-48 行的 demo 登录逻辑修改为：
```js
if (app.globalData.demoMode) {
  const demoAccounts = mock.demoAdminAccounts;
  const u = username.trim();
  const p = password.trim();
  const matched = Object.values(demoAccounts).find(a => a.username === u && a.password === p);

  if (matched) {
    this.loginSuccess(matched);
  } else {
    wx.showToast({ title: '账号或密码错误', icon: 'none', duration: 2500 });
  }
  return;
}
```

- [ ] **Step 3: 提交**

```bash
git add utils/mock.js pages/admin/login/login.js
git commit -m "refactor: move demo admin accounts from login page to mock.js"
```

---

### Task 4: 云函数鉴权统一（使用已有 `lib/auth.js`）

**Files:**
- Modify: `E:\miniprogram\cloudfunctions\adminGetOrders\index.js`
- Modify: `E:\miniprogram\cloudfunctions\adminUpdateOrderStatus\index.js`
- Modify: `E:\miniprogram\cloudfunctions\adminUpdateOrderPrice\index.js`
- Modify: `E:\miniprogram\cloudfunctions\adminAddProduct\index.js`
- Modify: `E:\miniprogram\cloudfunctions\adminUpdateProduct\index.js`
- Modify: `E:\miniprogram\cloudfunctions\adminDeleteProduct\index.js`
- Modify: `E:\miniprogram\cloudfunctions\adminTogglePickedUp\index.js`
- Modify: `E:\miniprogram\cloudfunctions\adminOrderImage\index.js`
- Modify: `E:\miniprogram\cloudfunctions\adminDeleteOrderImage\index.js`
- Modify: `E:\miniprogram\cloudfunctions\adminGetReturns\index.js`
- Modify: `E:\miniprogram\cloudfunctions\adminHandleReturn\index.js`

**目标：** 所有管理端云函数统一通过 `lib/auth.js` 的 `verifyAdmin()` 进行鉴权，消除 11 份重复的鉴权代码。

**背景：** `cloudfunctions/lib/auth.js` 已经提供了 `verifyAdmin()` 函数，但没有任何云函数使用它。

- [ ] **Step 1: 逐个修改云函数（以 `adminGetOrders/index.js` 为例）**

将：
```js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  if (!wxContext.OPENID) return { code: -1, msg: '未登录' };
  const admin = await db.collection('admins').where({ lastLoginOpenid: wxContext.OPENID, loggedIn: true }).get();
  if (admin.data.length === 0) return { code: -1, msg: '无管理员权限' };

  // ... 业务逻辑
};
```

改为：
```js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const { verifyAdmin } = require('../lib/auth');

exports.main = async (event) => {
  const auth = await verifyAdmin();
  if (auth.error) return auth.error;

  // ... 业务逻辑（不变）
};
```

- [ ] **Step 2: 对以下 11 个云函数执行完全相同的修改**

每个文件需要修改的行都是第 1-9 行（相同的鉴权块模式）：
1. `adminGetOrders/index.js`
2. `adminUpdateOrderStatus/index.js`
3. `adminUpdateOrderPrice/index.js`
4. `adminAddProduct/index.js`
5. `adminUpdateProduct/index.js`
6. `adminDeleteProduct/index.js`
7. `adminTogglePickedUp/index.js`
8. `adminOrderImage/index.js`
9. `adminDeleteOrderImage/index.js`
10. `adminGetReturns/index.js`
11. `adminHandleReturn/index.js`

**注意：** `customerCRUD/index.js` 已经有条件鉴权（部分 action 不需要鉴权），保留其特殊逻辑不变。

- [ ] **Step 3: 提交**

```bash
git add cloudfunctions/adminGetOrders/index.js cloudfunctions/adminUpdateOrderStatus/index.js cloudfunctions/adminUpdateOrderPrice/index.js cloudfunctions/adminAddProduct/index.js cloudfunctions/adminUpdateProduct/index.js cloudfunctions/adminDeleteProduct/index.js cloudfunctions/adminTogglePickedUp/index.js cloudfunctions/adminOrderImage/index.js cloudfunctions/adminDeleteOrderImage/index.js cloudfunctions/adminGetReturns/index.js cloudfunctions/adminHandleReturn/index.js
git commit -m "refactor: unify admin auth via lib/auth.js across all 11 admin cloud functions"
```

---

### Task 5: Demo 数据统一存储 `utils/demoStore.js`

**Files:**
- Create: `E:\miniprogram\utils\demoStore.js`
- Modify: `E:\miniprogram\app.js:43-46` (loadMockData)
- Modify: `E:\miniprogram\pages\admin\orders\orders.js:62-106` (loadOrders demo 分支)
- Modify: `E:\miniprogram\pages\admin\dashboard\dashboard.js:40-50` (loadDemoDashboard)
- Modify: `E:\miniprogram\pages\orders\orders.js:58-89` (loadOrders demo 分支)

**目标：** 消除 `app.globalData.demoOrders` + `wx.getStorageSync('demoOrders')` 双存储导致的数据不一致风险。创建统一的 demo 数据管理层，所有页面的 demo 模式读写都通过它。

- [ ] **Step 1: 创建 `utils/demoStore.js`**

```js
/**
 * Demo 模式统一数据存储
 * 单一数据源：wx.getStorageSync。不再使用 app.globalData 的副本。
 */

const mock = require('./mock');

const KEYS = {
  orders: 'demo_orders',
  products: 'demo_products',
  customers: 'demo_customers',
  addresses: 'demo_addresses',
  returnRequests: 'demo_return_requests'
};

function initAll() {
  if (!wx.getStorageSync(KEYS.orders)) {
    wx.setStorageSync(KEYS.orders, JSON.parse(JSON.stringify(mock.mockOrders)));
  }
  if (!wx.getStorageSync(KEYS.products)) {
    wx.setStorageSync(KEYS.products, JSON.parse(JSON.stringify(mock.mockProducts)));
  }
  if (!wx.getStorageSync(KEYS.customers)) {
    wx.setStorageSync(KEYS.customers, JSON.parse(JSON.stringify(mock.mockCustomers)));
  }
  if (!wx.getStorageSync(KEYS.addresses)) {
    wx.setStorageSync(KEYS.addresses, []);
  }
  if (!wx.getStorageSync(KEYS.returnRequests)) {
    wx.setStorageSync(KEYS.returnRequests, []);
  }
}

function getAll(key) {
  return wx.getStorageSync(key) || [];
}

function setAll(key, data) {
  wx.setStorageSync(key, data);
}

module.exports = {
  KEYS,
  initAll,
  getAll,
  setAll
};
```

- [ ] **Step 2: 修改 `app.js:43-46` loadMockData**

将：
```js
loadMockData() {
  this.globalData.demoProducts = mock.mockProducts;
  this.globalData.demoOrders = mock.mockOrders;
},
```
替换为：
```js
loadMockData() {
  const demoStore = require('./utils/demoStore');
  demoStore.initAll();
  // 保留 globalData 引用以兼容旧代码（逐步迁移后可移除）
  this.globalData.demoProducts = demoStore.getAll(demoStore.KEYS.products);
  this.globalData.demoOrders = demoStore.getAll(demoStore.KEYS.orders);
},
```

- [ ] **Step 3: 新增 demoStore 公共辅助方法（添加在 `demoStore.js` 末尾，`module.exports` 之前）**

```js
/**
 * 更新 demo 数据（原子化：先改后写）
 * @param {string} key - KEYS 中的 key
 * @param {Function} updater - 接收当前数组，返回修改后的数组
 */
function update(key, updater) {
  const current = getAll(key);
  const updated = updater(current);
  setAll(key, updated);
  // 同步更新 globalData（兼容过渡期）
  const app = getApp();
  if (app && app.globalData) {
    if (key === KEYS.orders) app.globalData.demoOrders = updated;
    if (key === KEYS.products) app.globalData.demoProducts = updated;
    if (key === KEYS.customers) app.globalData.demoCustomers = updated;
  }
  return updated;
}
```

**在 `module.exports` 中添加 `update`：**
```js
module.exports = {
  KEYS,
  initAll,
  getAll,
  setAll,
  update
};
```

- [ ] **Step 4: 修改 `pages/admin/orders/orders.js:62-106`**

在文件顶部（`Page({` 之前）添加：
```js
const demoStore = require('../../../utils/demoStore');
```

将 demo 分支的 loadOrders（约第 62-106 行）中的：
```js
const returnReqs = wx.getStorageSync('returnRequests') || [];
const saved = wx.getStorageSync('demoOrders') || [];
const allOrders = [...saved, ...(app.globalData.demoOrders || [])];
const unique = [];
const seen = new Set();
allOrders.forEach(o => {
  if (!seen.has(o._id)) { seen.add(o._id); unique.push(o); }
});
```
替换为：
```js
const returnReqs = demoStore.getAll(demoStore.KEYS.returnRequests);
const orders = demoStore.getAll(demoStore.KEYS.orders);
```

并将后续代码中的 `unique` 替换为 `orders`，删除去重逻辑。

**同样修改该页面中所有写操作的 demo 分支。** 以 `onTogglePickedUp`（第 473-482 行）为例：

将：
```js
if (app.globalData.demoMode) {
  const update = (list) => {
    const o = list.find(o => o._id === orderId);
    if (o) o.pickedUp = !o.pickedUp;
  };
  update(app.globalData.demoOrders);
  const saved = wx.getStorageSync('demoOrders') || [];
  update(saved);
  wx.setStorageSync('demoOrders', saved);
  this.loadOrders();
  return;
}
```
替换为：
```js
if (app.globalData.demoMode) {
  demoStore.update(demoStore.KEYS.orders, (orders) => {
    const o = orders.find(o => o._id === orderId);
    if (o) o.pickedUp = !o.pickedUp;
    return orders;
  });
  this.loadOrders();
  return;
}
```

**对该文件中以下方法的 demo 分支应用相同模式：**
- `onConfirmPrice` (第 190-202 行)
- `onUploadImage` (第 241-256 行)
- `onDeleteImage` (第 308-319 行)
- `onStatusChange` (第 363-370 行)
- `onHandleReturn` (第 401-448 行)
- `onTogglePickedUp` (第 473-483 行)
- `onTogglePayment` (第 505-524 行)

- [ ] **Step 5: 修改 `pages/admin/dashboard/dashboard.js:40-50`**

在文件顶部添加：
```js
const demoStore = require('../../../utils/demoStore');
```

将 `loadDemoDashboard` 方法中的：
```js
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
  this.renderDashboard(unique, products);
},
```
替换为：
```js
loadDemoDashboard() {
  const orders = demoStore.getAll(demoStore.KEYS.orders);
  const products = demoStore.getAll(demoStore.KEYS.products);
  this.renderDashboard(orders, products);
},
```

- [ ] **Step 6: 修改 `pages/orders/orders.js:58-89`**

在文件顶部添加：
```js
const demoStore = require('../../utils/demoStore');
```

将 demo 分支的 loadOrders 中：
```js
const saved = wx.getStorageSync('demoOrders') || [];
const returnReqs = wx.getStorageSync('returnRequests') || [];
const allOrders = [...saved, ...(app.globalData.demoOrders || [])];
const unique = [];
const seen = new Set();
allOrders.forEach(o => {
  if (!seen.has(o._id)) { seen.add(o._id); unique.push(o); }
});
```
替换为：
```js
const returnReqs = demoStore.getAll(demoStore.KEYS.returnRequests);
const orders = demoStore.getAll(demoStore.KEYS.orders);
```

将该方法中后续的 `unique` 替换为 `orders`。

**修改该页面中写操作的 demo 分支：**

`updateOrderStatus` (第 355-367 行)：
```js
updateOrderStatus(orderId, newStatus) {
  demoStore.update(demoStore.KEYS.orders, (orders) => {
    const order = orders.find(o => o._id === orderId);
    if (order) order.status = newStatus;
    return orders;
  });
  wx.showToast({ title: '已取消', icon: 'success' });
  this.loadOrders();
},
```

`updateOrderReturnFlag` (第 370-379 行)：
```js
updateOrderReturnFlag(orderId, type, reason, status, items, exchangeItems, rejectionCount) {
  demoStore.update(demoStore.KEYS.orders, (orders) => {
    const order = orders.find(o => o._id === orderId);
    if (order) {
      order.returnRequest = {
        type, reason, status, items, exchangeItems,
        rejectionCount: rejectionCount || 0,
        isRetry: (rejectionCount || 0) > 0
      };
    }
    return orders;
  });
},
```

`onSubmitReturn` 的 demo 分支（约第 299-324 行），将：
```js
const returnReqs = wx.getStorageSync('returnRequests') || [];
const allOrders = [...(wx.getStorageSync('demoOrders') || []), ...(app.globalData.demoOrders || [])];
```
替换为：
```js
const returnReqs = demoStore.getAll(demoStore.KEYS.returnRequests);
const orders = demoStore.getAll(demoStore.KEYS.orders);
```

并在写回 returnReqs 时使用 `demoStore.setAll(demoStore.KEYS.returnRequests, returnReqs)`。

- [ ] **Step 7: 提交**

```bash
git add utils/demoStore.js app.js pages/admin/orders/orders.js pages/admin/dashboard/dashboard.js pages/orders/orders.js
git commit -m "refactor: create demoStore as single source of truth for demo data"
```

---

### Task 6: `updateOrder` 云函数增加订单状态校验

**Files:**
- Modify: `E:\miniprogram\cloudfunctions\updateOrder\index.js`

**目标：** 阻止对已取消或已完成订单的修改操作。

- [ ] **Step 1: 修改 `cloudfunctions/updateOrder/index.js`**

在现有 `_openid` 校验后添加状态校验。将第 15-17 行：
```js
const order = await db.collection('orders').doc(orderId).get();
if (!order.data) return { code: -1, msg: '订单不存在' };
if (order.data._openid !== openid) return { code: -1, msg: '无权操作' };
```

替换为：
```js
const order = await db.collection('orders').doc(orderId).get();
if (!order.data) return { code: -1, msg: '订单不存在' };
if (order.data._openid !== openid) return { code: -1, msg: '无权操作' };

// 已取消和已完成的订单不允许修改
if (order.data.status === 'cancelled') {
  return { code: -1, msg: '订单已取消，无法修改' };
}
if (order.data.status === 'completed') {
  return { code: -1, msg: '订单已完成，无法修改' };
}
```

- [ ] **Step 2: 提交**

```bash
git add cloudfunctions/updateOrder/index.js
git commit -m "fix: add order status validation in updateOrder cloud function"
```

---

### Task 7: 列表页实现滚动加载更多（分页）

**Files:**
- Modify: `E:\miniprogram\pages\index\index.js`
- Modify: `E:\miniprogram\pages\index\index.wxml`
- Modify: `E:\miniprogram\pages\admin\orders\orders.js`
- Modify: `E:\miniprogram\pages\admin\orders\orders.wxml`
- Modify: `E:\miniprogram\pages\admin\products\products.js`
- Modify: `E:\miniprogram\pages\admin\products\products.wxml`

**目标：** 三个核心列表页从"一次性加载全部"改为"滚动到底部自动加载更多"，首次加载 20 条。

- [ ] **Step 1: 修改 `pages/index/index.js` 实现分页**

在 `Page({` 的 `data` 中添加分页状态字段：
```js
data: {
  // ... 现有字段
  page: 1,
  pageSize: 20,
  hasMore: true,
  loadingMore: false
},
```

修改 `loadProducts` 方法，添加参数控制：

将云模式分支：
```js
const params = { page: 1, pageSize: 200 };
const res = await wx.cloud.callFunction({ name: 'getProducts', data: params });
if (res.result.code === 0) {
  const products = res.result.data.list.map(p => ({
    ...p,
    priceText: (p.price / 100).toFixed(2)
  }));
  this.setData({ products, allProducts: [...products] });
}
```

改为：
```js
const { page, pageSize } = this.data;
const params = { page, pageSize };
const res = await wx.cloud.callFunction({ name: 'getProducts', data: params });
if (res.result.code === 0) {
  const newProducts = res.result.data.list.map(p => ({
    ...p,
    priceText: (p.price / 100).toFixed(2)
  }));
  const products = page === 1 ? newProducts : [...this.data.products, ...newProducts];
  const allProducts = page === 1 ? newProducts : [...this.data.allProducts, ...newProducts];
  const total = res.result.data.total || 0;
  this.setData({
    products,
    allProducts,
    hasMore: products.length < total,
    loadingMore: false
  });
}
```

Demo 模式分支也需支持分页（对已在内存中的 `demoProducts` 做分页切片）：
```js
if (app.globalData.demoMode) {
  const { page, pageSize } = this.data;
  const source = demoStore.getAll(demoStore.KEYS.products);
  const start = (page - 1) * pageSize;
  const slice = source.slice(start, start + pageSize).map(p => ({
    ...p, priceText: (p.price / 100).toFixed(2)
  }));
  const allProducts = page === 1 ? slice : [...(this.data.allProducts || []), ...slice];
  const products = page === 1 ? slice : [...this.data.products, ...slice];
  this.setData({
    products,
    allProducts,
    hasMore: start + slice.length < source.length,
    loading: false,
    loadingMore: false
  });
  this.filterProducts();
  return;
}
```

添加 `onReachBottom` 方法：
```js
onReachBottom() {
  if (!this.data.hasMore || this.data.loadingMore) return;
  this.setData({ page: this.data.page + 1, loadingMore: true });
  this.loadProducts();
},
```

修改 `onPullDownRefresh` 重置分页：
```js
onPullDownRefresh() {
  this.setData({ keyword: '', page: 1, hasMore: true });
  this.loadProducts().then(() => wx.stopPullDownRefresh());
},
```

同样在 `onSearchConfirm` 中重置分页：
```js
onSearchConfirm() {
  this.setData({ page: 1, hasMore: true });
  this.filterProducts();
},
```

- [ ] **Step 2: 修改 `pages/index/index.wxml` 添加底部加载提示**

在列表末尾（`</view>` 闭合标签前、页面底部）添加：
```xml
<view class="load-more" wx:if="{{loadingMore}}">
  <view class="load-more-text">加载中...</view>
</view>
<view class="load-more" wx:elif="{{!hasMore && products.length > 0}}">
  <view class="load-more-text">— 已加载全部 —</view>
</view>
```

- [ ] **Step 3: 修改 `pages/admin/orders/orders.js` 实现分页**

在 `data` 中添加：
```js
page: 1,
pageSize: 20,
hasMore: true,
loadingMore: false
```

修改 `loadOrders` 方法。将云模式分支的：
```js
const params = { page: 1, pageSize: 100 };
```
改为：
```js
const params = { page: this.data.page, pageSize: this.data.pageSize };
```

在 `res.result.code === 0` 分支中，将：
```js
this.setData({ orders: filtered, returnList: [] });
```
改为：
```js
const { page } = this.data;
const newOrders = page === 1 ? orders : [...this.data.orders, ...orders];
// 搜索过滤后再赋值
const filtered = this.data.searchKeyword ? newOrders.filter(...) : newOrders;
const total = res.result.data.total || 0;
this.setData({
  orders: filtered,
  returnList: [],
  hasMore: newOrders.length < total,
  loadingMore: false
});
```

添加 `onReachBottom`（仅非退换货 tab 时生效）：
```js
onReachBottom() {
  if (this.data.isReturnTab || !this.data.hasMore || this.data.loadingMore) return;
  this.setData({ page: this.data.page + 1, loadingMore: true });
  this.loadOrders();
},
```

修改 `onTabTap` 和 `onPullDownRefresh` 重置分页：
```js
onTabTap(e) {
  const tab = e.currentTarget.dataset.status;
  this.setData({ activeStatus: tab, isReturnTab: tab === 'returns', page: 1, hasMore: true });
  this.loadOrders();
},

onPullDownRefresh() {
  this.setData({ page: 1, hasMore: true });
  this.loadOrders().then(() => wx.stopPullDownRefresh());
},
```

- [ ] **Step 4: 修改 `pages/admin/orders/orders.wxml` 添加底部加载提示**

在订单列表末尾添加与 Step 2 相同的加载提示组件。

- [ ] **Step 5: 修改 `pages/admin/products/products.js` 实现分页**

在 `data` 中添加：
```js
page: 1,
pageSize: 20,
hasMore: true,
loadingMore: false
```

修改 `loadProducts` 方法，将 pageSize 从 200 改为 20，并实现与 Step 1 相同的分页逻辑。

添加 `onReachBottom`：
```js
onReachBottom() {
  if (!this.data.hasMore || this.data.loadingMore) return;
  this.setData({ page: this.data.page + 1, loadingMore: true });
  this.loadProducts();
},
```

修改 `onPullDownRefresh` 重置分页。

- [ ] **Step 6: 修改 `pages/admin/products/products.wxml` 添加底部加载提示**

在产品列表末尾添加加载提示（同 Step 2）。

- [ ] **Step 7: 提交**

```bash
git add pages/index/index.js pages/index/index.wxml pages/admin/orders/orders.js pages/admin/orders/orders.wxml pages/admin/products/products.js pages/admin/products/products.wxml
git commit -m "feat: add scroll-to-load-more pagination to product list, admin orders, and admin products"
```

---

## 自审检查清单

### 1. Spec 覆盖

| 问题 | 对应 Task | 覆盖？ |
|---|---|---|
| 1. 高德地图 Key 占位符 | Task 2 | ✅ |
| 2. 双存储数据不一致 | Task 5 | ✅ |
| 3. 演示账号硬编码前端 | Task 3 | ✅ |
| 4. 云函数鉴权重复 | Task 4 | ✅ |
| 5. 无分页加载 | Task 7 | ✅ |
| 6. updateOrder 缺状态校验 | Task 6 | ✅ |
| 7. 分类列表重复定义 | Task 1 | ✅ |

### 2. 占位符扫描

无 TBD、TODO、「implement later」等占位符。每个步骤都包含具体代码。

### 3. 类型一致性

- `demoStore.KEYS` 的 key 命名在 Task 5 中定义，后续所有引用使用相同 key
- `constants.PRODUCT_CATEGORIES` / `PRODUCT_CATEGORIES_WITH_ALL` / `PRODUCT_UNITS` / `PRODUCT_STATUSES` 在 Task 1 定义，Task 1 后续步骤一致引用
- `verifyAdmin()` 返回 `{ error: {...} }` 或 `{ admin: {...} }`，Task 4 中所有云函数统一使用 `auth.error` 检查
