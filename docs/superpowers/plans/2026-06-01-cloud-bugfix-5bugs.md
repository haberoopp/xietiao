# 云开发模式 5 个 Bug 修复计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复从演示模式切换到云开发模式后暴露的 5 个功能缺陷——重复地址、订单消失、仪表盘排行失效、付款切换失效、缺货标记不联动。

**Architecture:** 根因集中在云函数端——`submitOrder` 缺 `_openid`、`adminUpdateOrderStatus` 缺 `payment_status` 处理、`adminAddProduct`/`adminUpdateProduct`/`importProducts` 均缺 `status` 字段、客户端 `saveCurrentAddress` 云模式缺去重逻辑。修复云函数后需重新部署，客户端补一个地址去重调用即可。

**Tech Stack:** 微信云开发云函数 (Node.js + wx-server-sdk)

---

## 根因速查表

| # | 现象 | 根因 | 修复点 |
|---|------|------|--------|
| 1 | 地址重复 | `saveCurrentAddress` 云模式无去重 | `checkout.js` |
| 2 | 订单消失 | `submitOrder` 不写 `_openid`，`getMyOrders` 按 `_openid` 查不到 | `submitOrder/index.js` |
| 3 | 仪表盘排行摆设 | `adminAddProduct` 不设 `status` 默认值，`getProducts` 的排行依赖 order 中 `productId` 匹配 | `adminAddProduct/index.js`, `adminUpdateProduct/index.js`, `importProducts/index.js` |
| 4 | 付款切换失效 | `adminUpdateOrderStatus` 只处理 `status`，忽略 `payment_status`/`paid_amount` | `adminUpdateOrderStatus/index.js` |
| 5 | 缺货标记不联动 | `adminUpdateProduct` 不处理 `status` 字段 | 同 #3 |

---

### Task 1: 修复提交订单缺失 `_openid`

**Files:**
- Modify: `cloudfunctions/submitOrder/index.js`

**问题:** `submitOrder` 创建订单时未写入 `_openid`，导致 `getMyOrders`（按 `_openid` 查询）永远查不到该用户的订单。

- [ ] **Step 1: 在 create 对象中加入 `_openid`**

`cloudfunctions/submitOrder/index.js`：

```javascript
exports.main = async (event) => {
  const { customerName, phone, address, items, totalAmount, remark, deliveryMethod, location } = event;
  const wxContext = cloud.getWXContext();   // ← 新增

  if (!customerName || !phone || !address || !items || items.length === 0) {
    return { code: -1, msg: '请填写完整信息并选择商品' };
  }

  try {
    const order = {
      _openid: wxContext.OPENID,            // ← 新增
      customerName,
      phone,
      address,
      items,
      totalAmount,
      discount: event.discount || 1.0,      // ← 补齐漏掉的字段
      deliveryMethod: deliveryMethod || 'delivery',
      remark: remark || '',
      payment_status: 'unpaid',             // ← 补齐
      paid_amount: 0,                        // ← 补齐
      status: 'processing',
      pickedUp: false,
      createdAt: db.serverDate()
    };
    if (location) order.location = location;

    const result = await db.collection('orders').add({ data: order });
    return { code: 0, data: { orderId: result._id } };
  } catch (err) {
    return { code: -1, msg: err.message };
  }
};
```

- [ ] **Step 2: 重新部署 submitOrder**

右键 `cloudfunctions/submitOrder` →「上传并部署：云端安装依赖（不上传node-modules）」

---

### Task 2: 修复付款状态切换失效

**Files:**
- Modify: `cloudfunctions/adminUpdateOrderStatus/index.js`

**问题:** `onTogglePayment` 传 `payment_status` 到该云函数，但云函数只读取 `status`（订单状态），完全忽略 `payment_status` 和 `paid_amount`。且 `status` 有值校验（仅接受 processing/completed/cancelled），`payment_status` 值（paid/unpaid）传进来就报"无效的状态值"。

- [ ] **Step 1: 让云函数同时支持 `status` 和 `payment_status`**

`cloudfunctions/adminUpdateOrderStatus/index.js`：

```javascript
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const { verifyAdmin } = require('../lib/auth');

exports.main = async (event) => {
  const auth = await verifyAdmin();
  if (auth.error) return auth.error;

  const { orderId, status, payment_status, paid_amount } = event;

  if (!orderId) {
    return { code: -1, msg: '参数错误' };
  }

  try {
    const data = { updatedAt: db.serverDate() };

    if (status !== undefined) {
      const validStatus = ['processing', 'completed', 'cancelled'];
      if (!validStatus.includes(status)) {
        return { code: -1, msg: '无效的订单状态' };
      }
      data.status = status;
    }

    if (payment_status !== undefined) {
      const validPayment = ['paid', 'unpaid'];
      if (!validPayment.includes(payment_status)) {
        return { code: -1, msg: '无效的付款状态' };
      }
      data.payment_status = payment_status;
      // 切换为已付款时自动补全已付金额
      if (payment_status === 'paid') {
        const order = await db.collection('orders').doc(orderId).get();
        data.paid_amount = paid_amount !== undefined ? paid_amount : (order.data.totalAmount || 0);
      } else {
        data.paid_amount = 0;
      }
    }

    await db.collection('orders').doc(orderId).update({ data });
    return { code: 0 };
  } catch (err) {
    return { code: -1, msg: err.message };
  }
};
```

- [ ] **Step 2: 重新部署 adminUpdateOrderStatus**

右键 `cloudfunctions/adminUpdateOrderStatus` →「上传并部署」

---

### Task 3: 修复产品 `status` 字段缺失（影响仪表盘缺货预警 + 排行）

**Files:**
- Modify: `cloudfunctions/adminAddProduct/index.js`
- Modify: `cloudfunctions/adminUpdateProduct/index.js`
- Modify: `cloudfunctions/importProducts/index.js`

**问题:** 三个涉及产品写入的云函数都没有处理 `status` 字段。`adminAddProduct` 和 `importProducts` 新建产品时完全不写 `status`；`adminUpdateProduct` 更新时也不处理 `status`。这导致：
- 仪表盘缺货预警永远为空（过滤 `status === 'out' || status === 'low'` 永远 false）
- `onMarkLowStock` 标记紧张无效（传了 `status: 'low'` 但 `adminUpdateProduct` 丢弃了它）

- [ ] **Step 1: `adminAddProduct` 新增时写入默认 `status`**

`cloudfunctions/adminAddProduct/index.js`：在 `data` 对象中加入 `status: 'sufficient'`：

```javascript
const data = {
  name: name.trim(),
  category,
  price: Math.round(parseFloat(price) * 100),
  unit,
  status: event.status || 'sufficient',   // ← 新增
  stock: parseInt(stock) || 0,
  description: description || '',
  image: image || '',
  createdAt: db.serverDate(),
  updatedAt: db.serverDate()
};
```

- [ ] **Step 2: `adminUpdateProduct` 支持更新 `status`**

`cloudfunctions/adminUpdateProduct/index.js`：在条件判断链中加入 `status`：

```javascript
if (status !== undefined) data.status = status;   // ← 新增（放在 stock 处理之后）
```

- [ ] **Step 3: `importProducts` Excel 导入时写入默认 `status`**

`cloudfunctions/importProducts/index.js`：在 `db.collection('products').add({ data: { ... } })` 的 `data` 对象中加入 `status: 'sufficient'`：

```javascript
await db.collection('products').add({
  data: {
    name,
    category,
    price: Math.round(price * 100),
    unit,
    status: 'sufficient',     // ← 新增
    stock,
    description,
    image: '',
    createdAt: db.serverDate(),
    updatedAt: db.serverDate()
  }
});
```

- [ ] **Step 4: 重新部署三个云函数**

依次右键 → 上传并部署：
1. `cloudfunctions/adminAddProduct`
2. `cloudfunctions/adminUpdateProduct`
3. `cloudfunctions/importProducts`

---

### Task 4: 修复地址重复保存

**Files:**
- Modify: `pages/checkout/checkout.js`

**问题:** `saveCurrentAddress` 在云模式下直接调 `addressCRUD` add，无去重检查。demo 模式有去重逻辑但云模式缺失。

- [ ] **Step 1: 在云模式 `saveCurrentAddress` 中增加去重逻辑**

`pages/checkout/checkout.js`，`saveCurrentAddress` 方法（约第 314 行），云模式分支：

```javascript
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
      // ... demo 模式保持不变 ...
      return;
    }

    try {
      // 先查询是否已存在相同地址
      const listRes = await wx.cloud.callFunction({
        name: 'addressCRUD',
        data: { action: 'list' }
      });
      if (listRes.result && listRes.result.code === 0) {
        const exists = (listRes.result.data || []).find(a =>
          a.name === newAddr.name && a.phone === newAddr.phone && a.address === newAddr.address
        );
        if (exists) return;  // ← 去重：已存在则跳过
      }

      await wx.cloud.callFunction({
        name: 'addressCRUD',
        data: { action: 'add', ...newAddr, location: this.data.pickedLocation || undefined }
      });
    } catch (err) {
      // 静默失败
    }
},
```

- [ ] **Step 2: 无需部署（客户端代码，编译即生效）**

---

### Task 5: 验证所有修复

- [ ] **Step 1: 全量编译 + 检查 Console**

微信开发者工具 → 编译 → 确认 `云开发已连接`

- [ ] **Step 2: 端到端测试下单流程**

1. 首页 → 加购产品 → 去结算 → 填写客户信息 → 提交 → 检查「我的订单」是否立即显示
2. 查看地址管理页 → 确认同一地址不会重复出现

- [ ] **Step 3: 测试后台功能**

1. 后台登录(厂长) → 订单管理 → 点击付款状态按钮 → 确认可以切换已付/未付
2. 找到一条订单 → 点击产品旁的「标记紧张」→ 切换到仪表盘 → 确认缺货预警中显示该产品
3. 仪表盘 → 确认指标卡 + 趋势 + 产品排行 + 客户排行均为真实数据

---

### 涉及云函数重新部署清单

| 云函数 | 修复内容 | 需重新部署 |
|--------|---------|-----------|
| `submitOrder` | +`_openid` +`discount` +`payment_status` +`paid_amount` | ✅ |
| `adminUpdateOrderStatus` | +`payment_status`/`paid_amount` 处理 | ✅ |
| `adminAddProduct` | +`status: 'sufficient'` 默认值 | ✅ |
| `adminUpdateProduct` | +`status` 更新支持 | ✅ |
| `importProducts` | +`status: 'sufficient'` 默认值 | ✅ |
