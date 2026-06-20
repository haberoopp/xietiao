# 客户专属定价功能 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新建 `customerPrices` 集合和专属定价功能，移除旧的统一折扣机制

**Architecture:** 新增 `customerPriceCRUD` 云函数（6个操作）+ 新增 `pages/admin/pricing/` 管理页 + 改造 `checkout.js` 结算逻辑 + 移除 `customers` 页旧 `discount` 机制

**Tech Stack:** 微信小程序 + CloudBase 云函数 + 文档数据库

**Spec:** `docs/superpowers/specs/2026-06-20-customer-specific-pricing-design.md`

---

## 文件结构

```
新增:
  cloudfunctions/customerPriceCRUD/index.js      — 云函数：6个action（list/set/batchSet/delete/batchDelete/getByPhone）
  cloudfunctions/customerPriceCRUD/config.json    — timeout: 30s
  cloudfunctions/customerPriceCRUD/package.json   — 依赖声明
  pages/admin/pricing/pricing.js                  — 管理页逻辑
  pages/admin/pricing/pricing.wxml                — 管理页模板
  pages/admin/pricing/pricing.wxss                — 管理页样式
  pages/admin/pricing/pricing.json                — 页配置

修改:
  cloudfunctions/customerCRUD/index.js            — 移除 discount 字段处理
  pages/checkout/checkout.js                      — 移除 discount，接入 customerPriceCRUD.getByPhone
  pages/checkout/checkout.wxml                    — 移除折扣相关显示
  pages/admin/customers/customers.js              — 移除 discount 相关逻辑和UI数据
  pages/admin/customers/customers.wxml            — 移除折扣滑块和显示标签
  app.json                                        — 注册新路由

后续（手动操作）:
  docs/data-model.md                              — 新增 customerPrices 集合说明 / 更新 customers
  docs/api-reference.md                           — 新增 customerPriceCRUD 接口
```

---

### Task 1: Create `customerPriceCRUD` cloud function

**Files:**
- Create: `cloudfunctions/customerPriceCRUD/index.js`
- Create: `cloudfunctions/customerPriceCRUD/config.json`
- Create: `cloudfunctions/customerPriceCRUD/package.json`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "customerPriceCRUD",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "~2.6.3"
  }
}
```

- [ ] **Step 2: Create config.json**

```json
{
  "timeout": 30,
  "permissions": {
    "openapi": []
  }
}
```

- [ ] **Step 3: Create index.js**

Copy existing `cloudfunctions/customerCRUD/index.js` as the structural template. The `lib/` modules are symlinked/copied into each cloud function during deployment; reference them via relative path `../lib/response` etc. (same pattern as existing cloud functions).

```js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const res = require('../lib/response');
const logger = require('../lib/logger');
const auth = require('../lib/auth');

exports.main = async (event) => {
  const { action } = event;

  // getByPhone 是客户侧接口，不需要 admin 鉴权
  if (action === 'getByPhone') {
    return doGetByPhone(event);
  }

  // 其余操作为管理操作，需要 admin 鉴权
  const adminAuth = await auth.requireAdmin();
  if (!adminAuth.authorized) return adminAuth.response;

  try {
    switch (action) {
      case 'list':      return doList(event);
      case 'set':       return doSet(event);
      case 'batchSet':  return doBatchSet(event);
      case 'delete':    return doDelete(event);
      case 'batchDelete': return doBatchDelete(event);
      default:          return res.badRequest('未知操作');
    }
  } catch (err) {
    logger.error('customerPriceCRUD', err, { action: event.action });
    return res.internalError();
  }
};

// ---------- 业务层 ----------

/**
 * list: 分页列出专属价
 * 入参: page, pageSize, customerPhone?, keyword?（productName模糊搜索）
 */
async function doList(event) {
  const { page = 1, pageSize = 50, customerPhone, keyword } = event;
  const where = {};
  if (customerPhone) where.customerPhone = customerPhone;
  if (keyword) where.productName = db.RegExp({ regexp: keyword, options: 'i' });

  const safeSize = Math.min(parseInt(pageSize) || 50, 100);
  const skip = (parseInt(page) - 1) * safeSize;

  const [totalRes, listRes] = await Promise.all([
    db.collection('customerPrices').where(where).count(),
    db.collection('customerPrices')
      .where(where)
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(safeSize)
      .get()
  ]);

  logger.info('customerPriceCRUD list', { customerPhone, keyword, page, total: totalRes.total });
  return res.list(listRes.data, totalRes.total, page, safeSize);
}

/**
 * set: 单条新增或更新（upsert by customerPhone + productId）
 * 入参: customerPhone, productId, productName, customPrice(分)
 */
async function doSet(event) {
  const { customerPhone, productId, productName, customPrice } = event;

  if (!customerPhone || !productId || customPrice === undefined) {
    return res.badRequest('参数不完整');
  }

  const existing = await db.collection('customerPrices')
    .where({ customerPhone, productId })
    .limit(1)
    .get();

  if (existing.data.length > 0) {
    await db.collection('customerPrices').doc(existing.data[0]._id).update({
      data: {
        customPrice: Math.round(customPrice),
        productName: productName || existing.data[0].productName,
        updatedAt: db.serverDate()
      }
    });
  } else {
    await db.collection('customerPrices').add({
      data: {
        customerPhone,
        productId,
        productName: productName || '',
        customPrice: Math.round(customPrice),
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });
  }

  logger.info('customerPriceCRUD set', { customerPhone, productId, customPrice });
  return res.ok();
}

/**
 * batchSet: 批量设置专属价（用于管理页保存）
 * 入参: entries: [{ customerPhone, productId, productName, customPrice }]
 * 返回: { updated: N }
 */
async function doBatchSet(event) {
  const { entries } = event;

  if (!entries || !Array.isArray(entries) || entries.length === 0) {
    return res.badRequest('entries 不能为空');
  }

  let updated = 0;
  for (const entry of entries) {
    const { customerPhone, productId, productName, customPrice } = entry;
    if (!customerPhone || !productId || customPrice === undefined) continue;

    const existing = await db.collection('customerPrices')
      .where({ customerPhone, productId })
      .limit(1)
      .get();

    if (existing.data.length > 0) {
      await db.collection('customerPrices').doc(existing.data[0]._id).update({
        data: {
          customPrice: Math.round(customPrice),
          productName: productName || existing.data[0].productName,
          updatedAt: db.serverDate()
        }
      });
    } else {
      await db.collection('customerPrices').add({
        data: {
          customerPhone,
          productId,
          productName: productName || '',
          customPrice: Math.round(customPrice),
          createdAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
      });
    }
    updated++;
  }

  logger.info('customerPriceCRUD batchSet', { count: updated });
  return { code: 0, data: { updated } };
}

/**
 * delete: 删除单条专属价（清空专属价时调用）
 * 入参: customerPhone, productId
 */
async function doDelete(event) {
  const { customerPhone, productId } = event;

  if (!customerPhone || !productId) {
    return res.badRequest('参数不完整');
  }

  const existing = await db.collection('customerPrices')
    .where({ customerPhone, productId })
    .limit(1)
    .get();

  if (existing.data.length > 0) {
    await db.collection('customerPrices').doc(existing.data[0]._id).remove();
  }

  logger.info('customerPriceCRUD delete', { customerPhone, productId });
  return res.ok();
}

/**
 * batchDelete: 批量删除专属价
 * 入参: entries: [{ customerPhone, productId }]
 * 返回: { deleted: N }
 */
async function doBatchDelete(event) {
  const { entries } = event;

  if (!entries || !Array.isArray(entries) || entries.length === 0) {
    return res.badRequest('entries 不能为空');
  }

  let deleted = 0;
  for (const { customerPhone, productId } of entries) {
    if (!customerPhone || !productId) continue;

    const existing = await db.collection('customerPrices')
      .where({ customerPhone, productId })
      .limit(1)
      .get();

    if (existing.data.length > 0) {
      await db.collection('customerPrices').doc(existing.data[0]._id).remove();
      deleted++;
    }
  }

  logger.info('customerPriceCRUD batchDelete', { count: deleted });
  return { code: 0, data: { deleted } };
}

/**
 * getByPhone: 客户侧接口，取某客户所有专属价（无需admin鉴权）
 * 入参: phone
 * 返回: { code: 0, data: { list: [...], total: N } }
 */
async function doGetByPhone(event) {
  const { phone } = event;
  if (!phone) return res.badRequest('手机号不能为空');

  const result = await db.collection('customerPrices')
    .where({ customerPhone: phone })
    .get();

  logger.info('customerPriceCRUD getByPhone', { phone, count: result.data.length });
  return res.list(result.data, result.data.length);
}
```

- [ ] **Step 4: Verify cloud function file structure**

Run: `ls cloudfunctions/customerPriceCRUD/`
Expected: `index.js`, `config.json`, `package.json`

- [ ] **Step 5: Commit**

```bash
git add cloudfunctions/customerPriceCRUD/
git commit -m "feat: add customerPriceCRUD cloud function"
```

---

### Task 2: Modify `customerCRUD` cloud function — remove `discount` field

**Files:**
- Modify: `cloudfunctions/customerCRUD/index.js`

- [ ] **Step 1: Remove `discount` from `add` action**

In `doAdd` (the `add` case), change:

```js
// OLD (lines ~48-66):
case 'add': {
  const { name, phone, discount } = event;
  const existing = await db.collection('customers').where({ phone }).count();
  if (existing.total > 0) {
    return res.conflict('该手机号已存在');
  }
  const result = await db.collection('customers').add({
    data: {
      name: name.trim(),
      phone: phone.trim(),
      discount: parseFloat(discount) || 1.0,
      totalOrders: 0,
      totalAmount: 0,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
  });
  logger.info('Customer added', { customerId: result._id, phone });
  return res.record({ _id: result._id });
}
```

```js
// NEW:
case 'add': {
  const { name, phone } = event;
  const existing = await db.collection('customers').where({ phone }).count();
  if (existing.total > 0) {
    return res.conflict('该手机号已存在');
  }
  const result = await db.collection('customers').add({
    data: {
      name: name.trim(),
      phone: phone.trim(),
      totalOrders: 0,
      totalAmount: 0,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
  });
  logger.info('Customer added', { customerId: result._id, phone });
  return res.record({ _id: result._id });
}
```

- [ ] **Step 2: Remove `discount` from `update` action**

In the `update` case, change:

```js
// OLD (lines ~68-77):
case 'update': {
  const { customerId, name, phone, discount } = event;
  const data = { updatedAt: db.serverDate() };
  if (name !== undefined) data.name = name.trim();
  if (phone !== undefined) data.phone = phone.trim();
  if (discount !== undefined) data.discount = parseFloat(discount);
  await db.collection('customers').doc(customerId).update({ data });
  logger.info('Customer updated', { customerId });
  return res.ok();
}
```

```js
// NEW:
case 'update': {
  const { customerId, name, phone } = event;
  const data = { updatedAt: db.serverDate() };
  if (name !== undefined) data.name = name.trim();
  if (phone !== undefined) data.phone = phone.trim();
  await db.collection('customers').doc(customerId).update({ data });
  logger.info('Customer updated', { customerId });
  return res.ok();
}
```

- [ ] **Step 3: Remove `discount` from `upsert` action**

In the `upsert` case, change:

```js
// OLD (lines ~79-108):
// upsert — 下单后自动录入/更新客户统计
case 'upsert': {
  const { name: cName, phone: cPhone, orderAmount } = event;
  const existing = await db.collection('customers').where({ phone: cPhone }).limit(1).get();
  if (existing.data.length > 0) {
    const c = existing.data[0];
    await db.collection('customers').doc(c._id).update({
      data: {
        name: cName.trim() || c.name,
        totalOrders: _.inc(1),
        totalAmount: _.inc(Math.round(orderAmount)),
        updatedAt: db.serverDate()
      }
    });
  } else {
    await db.collection('customers').add({
      data: {
        name: cName.trim(),
        phone: cPhone.trim(),
        discount: 1.0,
        totalOrders: 1,
        totalAmount: Math.round(orderAmount),
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });
  }
  logger.info('Customer upserted', { phone: cPhone });
  return res.ok();
}
```

```js
// NEW:
case 'upsert': {
  const { name: cName, phone: cPhone, orderAmount } = event;
  const existing = await db.collection('customers').where({ phone: cPhone }).limit(1).get();
  if (existing.data.length > 0) {
    const c = existing.data[0];
    await db.collection('customers').doc(c._id).update({
      data: {
        name: cName.trim() || c.name,
        totalOrders: _.inc(1),
        totalAmount: _.inc(Math.round(orderAmount)),
        updatedAt: db.serverDate()
      }
    });
  } else {
    await db.collection('customers').add({
      data: {
        name: cName.trim(),
        phone: cPhone.trim(),
        totalOrders: 1,
        totalAmount: Math.round(orderAmount),
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });
  }
  logger.info('Customer upserted', { phone: cPhone });
  return res.ok();
}
```

- [ ] **Step 5: Commit**

```bash
git add cloudfunctions/customerCRUD/index.js
git commit -m "refactor: remove discount field from customerCRUD"
```

---

### Task 3: Modify checkout page — replace discount with custom price map

**Files:**
- Modify: `pages/checkout/checkout.js`
- Modify: `pages/checkout/checkout.wxml`

- [ ] **Step 1: Replace `customerDiscount` with `customerPriceMap` in data**

In `checkout.js` `Page({ data: { ... } })`, change:

```js
// OLD:
customerDiscount: 1.0,

// NEW:
customerPriceMap: {},
```

- [ ] **Step 2: Update formatItems()**

Replace the entire `formatItems` method:

```js
// OLD:
formatItems(items) {
  const discount = this.data.customerDiscount;
  return items.map(item => ({
    ...item,
    priceText: (item.price / 100).toFixed(2),
    discountedPrice: Math.round(item.price * discount),
    discountedPriceText: (Math.round(item.price * discount) / 100).toFixed(2),
    subtotal: (Math.round(item.price * discount) * item.quantity / 100).toFixed(2)
  }));
},
```

```js
// NEW:
formatItems(items) {
  const priceMap = this.data.customerPriceMap || {};
  return items.map(item => {
    const finalPrice = priceMap[item._id] !== undefined ? priceMap[item._id] : item.price;
    return {
      ...item,
      priceText: (item.price / 100).toFixed(2),
      finalPrice: finalPrice,
      finalPriceText: (finalPrice / 100).toFixed(2),
      hasCustomPrice: priceMap[item._id] !== undefined,
      subtotal: (finalPrice * item.quantity / 100).toFixed(2)
    };
  });
},
```

- [ ] **Step 3: Update calcTotal()**

Replace `calcTotal`:

```js
// OLD:
calcTotal() {
  const total = this.data.items.reduce((sum, item) => sum + (item.discountedPrice != null ? item.discountedPrice : item.price) * item.quantity, 0);
  this.setData({ totalAmount: (total / 100).toFixed(2) });
},
```

```js
// NEW:
calcTotal() {
  const total = this.data.items.reduce((sum, item) => {
    const p = item.finalPrice != null ? item.finalPrice : item.price;
    return sum + p * item.quantity;
  }, 0);
  this.setData({ totalAmount: (total / 100).toFixed(2) });
},
```

- [ ] **Step 4: Replace matchCustomer() — fetch custom prices instead of discount**

Replace the entire `matchCustomer` method:

```js
// OLD:
async matchCustomer(phone) {
  const app = getApp();

  if (app.globalData.demoMode) {
    const customers = wx.getStorageSync('customers') || [];
    const c = customers.find(c => c.phone === phone);
    if (c) {
      this.setData({ customerDiscount: c.discount, matchedCustomer: c });
      this.setData({ items: this.formatItems(this.data.items) });
      this.calcTotal();
    }
    return;
  }

  try {
    const res = await wx.cloud.callFunction({ name: 'customerCRUD', data: { action: 'getByPhone', phone } });
    if (res.result.code === 0 && res.result.data) {
      const c = res.result.data.record;
      this.setData({ customerDiscount: c.discount, matchedCustomer: c });
      this.setData({ items: this.formatItems(this.data.items) });
      this.calcTotal();
    }
  } catch (err) {
    // 静默失败
  }
},
```

```js
// NEW:
async matchCustomer(phone) {
  const app = getApp();

  // 并行查客户信息和专属价
  let custData = null;
  let priceList = [];

  if (app.globalData.demoMode) {
    const customers = wx.getStorageSync('customers') || [];
    custData = customers.find(c => c.phone === phone) || null;
    const prices = wx.getStorageSync('customerPrices') || [];
    priceList = prices.filter(p => p.customerPhone === phone);
  } else {
    try {
      const [custRes, priceRes] = await Promise.all([
        wx.cloud.callFunction({ name: 'customerCRUD', data: { action: 'getByPhone', phone } }),
        wx.cloud.callFunction({ name: 'customerPriceCRUD', data: { action: 'getByPhone', phone } })
      ]);
      if (custRes.result && custRes.result.code === 0 && custRes.result.data) {
        custData = custRes.result.data.record;
      }
      if (priceRes.result && priceRes.result.code === 0 && priceRes.result.data) {
        priceList = priceRes.result.data.list || [];
      }
    } catch (err) {
      // 静默失败
      return;
    }
  }

  if (custData) {
    const priceMap = {};
    priceList.forEach(p => { priceMap[p.productId] = p.customPrice; });
    this.setData({ matchedCustomer: custData, customerPriceMap: priceMap });
    this.setData({ items: this.formatItems(this.data.items) });
    this.calcTotal();
  }
},
```

- [ ] **Step 5: Update onInput() — reset priceMap when phone changes**

In the `onInput` method, update the phone-change handler (around line 296-305):

```js
// OLD:
if (field === 'phone') {
  if (value.length >= 11) {
    if (this._matchTimer) clearTimeout(this._matchTimer);
    this._matchTimer = setTimeout(() => this.matchCustomer(value), 500);
  } else if (this.data.matchedCustomer) {
    this.setData({ customerDiscount: 1.0, matchedCustomer: null });
    this.setData({ items: this.formatItems(this.data.items) });
    this.calcTotal();
  }
}
```

```js
// NEW:
if (field === 'phone') {
  if (value.length >= 11) {
    if (this._matchTimer) clearTimeout(this._matchTimer);
    this._matchTimer = setTimeout(() => this.matchCustomer(value), 500);
  } else if (this.data.matchedCustomer) {
    this.setData({ customerPriceMap: {}, matchedCustomer: null });
    this.setData({ items: this.formatItems(this.data.items) });
    this.calcTotal();
  }
}
```

- [ ] **Step 6: Update onSubmit() — use finalPrice in items, remove discount field**

In `onSubmit()`, change the orderData construction (around lines 415-436):

```js
// OLD:
items: this.data.items.map(item => ({
  productId: item._id,
  name: item.name,
  price: item.price,
  quantity: item.quantity,
  unit: item.unit
})),
totalAmount: Math.round(parseFloat(this.data.totalAmount) * 100),
discount: this.data.customerDiscount,
```

```js
// NEW:
items: this.data.items.map(item => ({
  productId: item._id,
  name: item.name,
  price: item.finalPrice != null ? item.finalPrice : item.price,
  quantity: item.quantity,
  unit: item.unit
})),
totalAmount: Math.round(parseFloat(this.data.totalAmount) * 100),
```

- [ ] **Step 7: Update onLoad — restore customerPriceMap from checkoutState**

In `onLoad`, the state restoration (around lines 53-68) restores `customerDiscount` and `matchedCustomer`. Replace the relevant fields:

```js
// OLD (in state restoration):
customerDiscount: state.customerDiscount || 1.0,
matchedCustomer: state.matchedCustomer || null

// NEW:
customerPriceMap: state.customerPriceMap || {},
matchedCustomer: state.matchedCustomer || null
```

Also update the `app.globalData.checkoutState` assignment in `onAddProduct()` and `goAddressSelect()` — replace `customerDiscount` with `customerPriceMap` and `matchedCustomer`.

In `onAddProduct()` (around line 153):

```js
// OLD:
customerDiscount: this.data.customerDiscount,
matchedCustomer: this.data.matchedCustomer
```

```js
// NEW:
customerPriceMap: this.data.customerPriceMap,
matchedCustomer: this.data.matchedCustomer
```

Same change in `goAddressSelect()` (around line 244).

- [ ] **Step 8: Update checkout.wxml — replace discount display with custom price indicator**

Replace lines in `checkout.wxml` that reference `customerDiscount`:

The item meta line (around line 10-12):

```xml
<!-- OLD: -->
<text wx:if="{{customerDiscount < 1}}" class="original-price">¥{{item.priceText}}</text>
<text>¥{{item.discountedPriceText}} / {{item.unit}}</text>

<!-- NEW: -->
<text wx:if="{{item.hasCustomPrice}}" class="original-price">¥{{item.priceText}}</text>
<text>¥{{item.finalPriceText}} / {{item.unit}}</text>
```

The subtotal line (around line 20):

```xml
<!-- OLD: -->
<view class="oi-subtotal">¥{{item.subtotal}}</view>

<!-- NEW (unchanged — still uses subtotal computed in formatItems): -->
<view class="oi-subtotal">¥{{item.subtotal}}</view>
```

The total line (around line 28-32):

```xml
<!-- OLD: -->
<view class="total-line">
  <text wx:if="{{customerDiscount < 1}}" class="discount-note">已享{{customerDiscount * 10}}折</text>
  <text>合计</text>
  <text class="price">¥{{totalAmount}}</text>
</view>

<!-- NEW: -->
<view class="total-line">
  <text wx:if="{{matchedCustomer}}" class="discount-note">已匹配客户: {{matchedCustomer.name}}</text>
  <text>合计</text>
  <text class="price">¥{{totalAmount}}</text>
</view>
```

The matched customer display in phone input (around lines 134-137):

```xml
<!-- OLD: -->
<view wx:if="{{matchedCustomer}}" class="matched-customer">
  <text>★ {{matchedCustomer.name}}</text>
  <text wx:if="{{matchedCustomer.discount < 1}}" class="matched-discount">享{{matchedCustomer.discount * 10}}折</text>
</view>

<!-- NEW: -->
<view wx:if="{{matchedCustomer}}" class="matched-customer">
  <text>★ {{matchedCustomer.name}}（已匹配专属价）</text>
</view>
```

- [ ] **Step 9: Commit**

```bash
git add pages/checkout/checkout.js pages/checkout/checkout.wxml
git commit -m "feat: replace customer discount with per-product custom pricing in checkout"
```

---

### Task 4: Modify customers admin page — remove discount UI

**Files:**
- Modify: `pages/admin/customers/customers.js`
- Modify: `pages/admin/customers/customers.wxml`

- [ ] **Step 1: Remove discount from form data in customers.js**

In `data.form`:

```js
// OLD:
form: {
  name: '',
  phone: '',
  discount: '1.0'
}

// NEW:
form: {
  name: '',
  phone: ''
}
```

- [ ] **Step 2: Remove discount from onAdd()**

```js
// OLD:
form: { name: '', phone: '', discount: '1.0' }

// NEW:
form: { name: '', phone: '' }
```

- [ ] **Step 3: Remove discount from onEdit()**

```js
// OLD:
form: { name: c.name, phone: c.phone, discount: String(c.discount) }

// NEW:
form: { name: c.name, phone: c.phone }
```

- [ ] **Step 4: Delete onDiscountSlider() method**

Remove the entire method:

```js
// DELETE:
onDiscountSlider(e) {
  this.setData({ 'form.discount': (e.detail.value / 100).toFixed(2) });
},
```

- [ ] **Step 5: Remove discount validation from onSave()**

```js
// OLD (lines ~132-146):
const { name, phone, discount } = this.data.form;
// ... validation ...
const d = parseFloat(discount);
if (isNaN(d) || d <= 0 || d > 1) {
  wx.showToast({ title: '折扣必须在0.01~1.0之间', icon: 'none' });
  return;
}
```

```js
// NEW:
const { name, phone } = this.data.form;
// ... (keep name and phone validation, remove discount validation entirely)
```

- [ ] **Step 6: Remove discount from onSave() data construction**

In both demo mode save (around lines 150-168) and cloud save (around lines 171-193):

```js
// OLD (demo):
customers.map(c => c._id === this.data.editingId ? { ...c, name: name.trim(), phone: phone.trim(), discount: d } : c);
// ...
customers.push({ _id: 'c' + Date.now(), name: name.trim(), phone: phone.trim(), discount: d, ... });

// NEW:
customers.map(c => c._id === this.data.editingId ? { ...c, name: name.trim(), phone: phone.trim() } : c);
// ...
customers.push({ _id: 'c' + Date.now(), name: name.trim(), phone: phone.trim(), ... });
```

```js
// OLD (cloud):
const data = { name: name.trim(), phone: phone.trim(), discount: d };

// NEW:
const data = { name: name.trim(), phone: phone.trim() };
```

- [ ] **Step 7: Remove discountLabel from formatCustomers()**

```js
// OLD:
formatCustomers(list) {
  return list.map(c => ({
    ...c,
    discountLabel: c.discount < 1 ? (c.discount * 10).toFixed(1).replace(/\.0$/, '') + '折' : '',
    amountText: (c.totalAmount / 100).toFixed(2),
    debtText: (c.debt && c.debt > 0) ? ((c.debt / 100).toFixed(2)) : ''
  }));
},

// NEW:
formatCustomers(list) {
  return list.map(c => ({
    ...c,
    amountText: (c.totalAmount / 100).toFixed(2),
    debtText: (c.debt && c.debt > 0) ? ((c.debt / 100).toFixed(2)) : ''
  }));
},
```

- [ ] **Step 8: Update customers.wxml — remove discount display**

Remove the discount badge from the customer list card (lines 26-31 in the wxml):

```xml
<!-- OLD: -->
<view class="cust-discount">
  <text wx:if="{{item.discount < 1}}" class="discount-badge">{{item.discountLabel}}</text>
  <text wx:if="{{item.totalOrders > 0}}" class="cust-stats">累计{{item.totalOrders}}单 ¥{{item.amountText}}</text>
  <text wx:if="{{item.debtText}}" class="cust-debt">欠款 ¥{{item.debtText}}</text>
</view>

<!-- NEW: -->
<view class="cust-discount">
  <text wx:if="{{item.totalOrders > 0}}" class="cust-stats">累计{{item.totalOrders}}单 ¥{{item.amountText}}</text>
  <text wx:if="{{item.debtText}}" class="cust-debt">欠款 ¥{{item.debtText}}</text>
</view>
```

Remove the discount slider from the form modal (lines 52-56):

```xml
<!-- DELETE these lines: -->
<view class="form-group">
  <view class="form-label">折扣：{{form.discount * 10}}折</view>
  <slider min="1" max="100" value="{{form.discount * 100}}" show-value block-size="20" bindchange="onDiscountSlider" />
  <view class="discount-hint">零售价 × {{form.discount}} = 实际售价</view>
</view>
```

- [ ] **Step 9: Commit**

```bash
git add pages/admin/customers/customers.js pages/admin/customers/customers.wxml
git commit -m "refactor: remove discount slider and display from customers admin page"
```

---

### Task 5: Create pricing admin page — page config and template

**Files:**
- Create: `pages/admin/pricing/pricing.json`
- Create: `pages/admin/pricing/pricing.wxml`

- [ ] **Step 1: Create pricing.json**

```json
{
  "navigationBarTitleText": "客户定价管理",
  "enablePullDownRefresh": true
}
```

- [ ] **Step 2: Create pricing.wxml**

```xml
<view class="container">
  <!-- ===== 固定头部 ===== -->
  <view class="header-fixed">
    <view class="admin-top-bar">
      <view class="back-btn" bindtap="onBack">← 返回订单</view>
      <view class="add-btn" bindtap="onSave">保存</view>
    </view>

    <!-- 客户选择区 -->
    <view class="section-label">选择客户 <text wx:if="{{selectedCustomerCount > 0}}">（已选 {{selectedCustomerCount}} 人）</text></view>
    <view class="search-bar">
      <view class="search-input-wrap">
        <text class="search-icon">⌕</text>
        <input class="search-input" placeholder="搜索客户名称或手机号..." value="{{customerSearchKeyword}}" bindinput="onCustomerSearch" />
        <text wx:if="{{customerSearchKeyword}}" class="search-clear" bindtap="onClearCustomerSearch">✕</text>
      </view>
    </view>
    <scroll-view scroll-x class="customer-select-scroll">
      <view wx:if="{{filteredCustomers.length === 0}}" class="empty-hint">暂无客户</view>
      <view wx:else class="customer-tags">
        <view
          class="customer-tag {{selectedCustomerPhones[item.phone] ? 'tag-active' : ''}}"
          wx:for="{{filteredCustomers}}"
          wx:key="phone"
          data-phone="{{item.phone}}"
          bindtap="onToggleCustomer"
        >{{item.name}}</view>
      </view>
    </scroll-view>
  </view>
  <!-- ===== /固定头部 ===== -->

  <!-- ===== 产品定价区 ===== -->
  <view class="section-label">产品定价</view>
  <view class="search-bar">
    <view class="search-input-wrap">
      <text class="search-icon">⌕</text>
      <input class="search-input" placeholder="搜索产品名称或分类..." value="{{productSearchKeyword}}" bindinput="onProductSearch" />
      <text wx:if="{{productSearchKeyword}}" class="search-clear" bindtap="onClearProductSearch">✕</text>
    </view>
  </view>

  <!-- 批量操作栏 -->
  <view class="batch-bar">
    <view class="batch-bar-left">
      <view class="select-all-btn" bindtap="onToggleSelectAll">
        <view class="select-checkbox {{allSelected ? 'checked' : ''}}">{{allSelected ? '✓' : ''}}</view>
        <text>{{allSelected ? '取消全选' : '全选'}}</text>
      </view>
      <text class="select-count">已选 {{selectedProductCount}} 项</text>
    </view>
    <view class="batch-bar-right">
      <view class="batch-edit-btn" bindtap="onBatchSetPrice">批量改价</view>
    </view>
  </view>

  <!-- 可滚动产品列表 -->
  <scroll-view class="scroll-list" scroll-y scroll-top="{{listScrollTop}}" bindscroll="onListScroll">
    <view wx:if="{{filteredProducts.length === 0}}" class="empty-state">
      <text>暂无产品</text>
    </view>

    <view wx:else class="pricing-list">
      <view
        class="pricing-item card {{selectedProductIds[item._id] ? 'pricing-selected' : ''}}"
        wx:for="{{filteredProducts}}"
        wx:key="_id"
      >
        <view class="pricing-select" data-id="{{item._id}}" catchtap="onToggleProduct">
          <view class="select-checkbox {{selectedProductIds[item._id] ? 'checked' : ''}}">{{selectedProductIds[item._id] ? '✓' : ''}}</view>
        </view>
        <view class="pricing-info">
          <view class="pricing-name">{{item.name}}</view>
          <view class="pricing-meta">零售价 ¥{{item.priceText}} / {{item.unit}}</view>
        </view>
        <view class="pricing-input-wrap">
          <text class="pricing-unit">¥</text>
          <input
            class="pricing-input {{priceInputs[item._id] !== undefined && priceInputs[item._id] !== '' ? 'input-has-price' : ''}}"
            type="digit"
            placeholder="{{pricePlaceholders[item._id] || '零售价'}}"
            value="{{priceInputs[item._id] !== undefined ? priceInputs[item._id] : ''}}"
            data-id="{{item._id}}"
            bindinput="onPriceInput"
          />
        </view>
      </view>
    </view>
  </scroll-view>

  <!-- 批量改价弹窗 -->
  <view wx:if="{{showBatchModal}}" class="modal-mask">
    <view class="modal-content" catchtap="">
      <view class="modal-title">批量设置专属价</view>
      <view class="form-group">
        <view class="form-label">专属价（元）</view>
        <input
          class="form-input"
          type="digit"
          placeholder="请输入单价"
          value="{{batchPriceValue}}"
          focus="{{true}}"
          bindinput="onBatchPriceInput"
        />
      </view>
      <view class="batch-form-hint">将应用于 {{selectedProductCount}} 个产品</view>
      <view class="modal-btns">
        <view class="btn-outline modal-cancel" bindtap="onCancelBatch">取消</view>
        <view class="btn-primary modal-save" bindtap="onConfirmBatch">确认</view>
      </view>
    </view>
  </view>
</view>
```

- [ ] **Step 3: Commit**

```bash
git add pages/admin/pricing/pricing.json pages/admin/pricing/pricing.wxml
git commit -m "feat: add pricing admin page config and template"
```

---

### Task 6: Create pricing admin page — styles

**Files:**
- Create: `pages/admin/pricing/pricing.wxss`

- [ ] **Step 1: Create pricing.wxss**

Reuse the existing admin page style patterns from `pages/admin/products/products.wxss` and `pages/admin/customers/customers.wxss`. The following styles match the project's existing conventions.

```css
/* 继承 container / card / search-bar 等全局样式 */

.header-fixed {
  position: sticky;
  top: 0;
  z-index: 10;
  background: #f5f5f5;
}

.section-label {
  font-size: 28rpx;
  color: #666;
  padding: 20rpx 24rpx 8rpx;
}

/* 客户标签横滑 */
.customer-select-scroll {
  white-space: nowrap;
  padding: 0 24rpx 16rpx;
}

.customer-tags {
  display: flex;
  gap: 16rpx;
}

.customer-tag {
  display: inline-block;
  padding: 12rpx 24rpx;
  border-radius: 32rpx;
  font-size: 26rpx;
  background: #fff;
  color: #333;
  border: 2rpx solid #ddd;
  flex-shrink: 0;
}

.customer-tag.tag-active {
  background: #E8594B;
  color: #fff;
  border-color: #E8594B;
}

.empty-hint {
  font-size: 26rpx;
  color: #999;
  padding: 16rpx 24rpx;
}

/* 批量操作栏（复用 products 页样式） */
.batch-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 24rpx;
  background: #fff8e1;
  margin: 0 24rpx 8rpx;
  border-radius: 12rpx;
}

.batch-bar-left, .batch-bar-right {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.select-all-btn {
  display: flex;
  align-items: center;
  gap: 8rpx;
  font-size: 26rpx;
  color: #333;
}

.select-checkbox {
  width: 36rpx;
  height: 36rpx;
  border-radius: 6rpx;
  border: 2rpx solid #ccc;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  color: #fff;
  background: #fff;
}

.select-checkbox.checked {
  background: #E8594B;
  border-color: #E8594B;
}

.select-count {
  font-size: 24rpx;
  color: #999;
}

.batch-edit-btn {
  padding: 10rpx 20rpx;
  background: #E8594B;
  color: #fff;
  border-radius: 8rpx;
  font-size: 24rpx;
}

/* 产品定价列表 */
.scroll-list {
  height: calc(100vh - 360rpx);
  padding: 0 16rpx;
}

.pricing-list {
  padding-bottom: 40rpx;
}

.pricing-item {
  display: flex;
  align-items: center;
  padding: 20rpx 16rpx;
  margin-bottom: 8rpx;
  background: #fff;
  border-radius: 12rpx;
}

.pricing-item.pricing-selected {
  background: #fff5f5;
}

.pricing-select {
  margin-right: 16rpx;
}

.pricing-info {
  flex: 1;
  min-width: 0;
}

.pricing-name {
  font-size: 28rpx;
  font-weight: 500;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pricing-meta {
  font-size: 24rpx;
  color: #999;
  margin-top: 4rpx;
}

.pricing-input-wrap {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  margin-left: 16rpx;
}

.pricing-unit {
  font-size: 28rpx;
  color: #E8594B;
  margin-right: 4rpx;
}

.pricing-input {
  width: 130rpx;
  height: 60rpx;
  border: 2rpx solid #ddd;
  border-radius: 8rpx;
  text-align: center;
  font-size: 28rpx;
  color: #333;
  background: #fafafa;
}

.pricing-input.input-has-price {
  border-color: #4CAF50;
  background: #f1f8e9;
}

/* 批量改价弹窗 */
.batch-form-hint {
  font-size: 26rpx;
  color: #999;
  text-align: center;
  padding: 16rpx 0;
}

/* 空提示 */
.empty-hint {
  font-size: 26rpx;
  color: #999;
  padding: 16rpx 24rpx;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 0;
  color: #999;
  font-size: 28rpx;
}
```

- [ ] **Step 2: Commit**

```bash
git add pages/admin/pricing/pricing.wxss
git commit -m "feat: add pricing admin page styles"
```

---

### Task 7: Create pricing admin page — logic

**Files:**
- Create: `pages/admin/pricing/pricing.js`

- [ ] **Step 1: Create pricing.js with full page logic**

```js
Page({
  data: {
    // 客户
    customers: [],
    filteredCustomers: [],
    selectedCustomerPhones: {},
    selectedCustomerCount: 0,
    customerSearchKeyword: '',

    // 产品
    products: [],
    filteredProducts: [],
    selectedProductIds: {},
    selectedProductCount: 0,
    allSelected: false,
    productSearchKeyword: '',

    // 价格
    priceInputs: {},       // key: productId, value: input string (元)
    pricePlaceholders: {}, // key: productId, value: placeholder text
    initialPrices: {},     // key: "phone::productId", value: customPrice (分), for diff

    // 弹窗
    showBatchModal: false,
    batchPriceValue: '',

    listScrollTop: 0
  },

  onShow() {
    const app = getApp();
    if (!app.globalData.adminLoggedIn && !wx.getStorageSync('adminLoggedIn')) {
      wx.redirectTo({ url: '/pages/admin/login/login' });
      return;
    }
    const role = wx.getStorageSync('adminRole') || app.globalData.adminRole || '';
    if (role !== 'manager') {
      wx.showToast({ title: '仅厂长可管理定价', icon: 'none' });
      wx.redirectTo({ url: '/pages/admin/orders/orders' });
      return;
    }
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData().then(() => wx.stopPullDownRefresh());
  },

  async loadData() {
    const app = getApp();

    if (app.globalData.demoMode) {
      const customers = wx.getStorageSync('customers') || [];
      const products = (wx.getStorageSync('cache_admin_products') || []).map(p => ({
        ...p, priceText: (p.price / 100).toFixed(2)
      }));
      this.setData({ customers, products });
      this.filterCustomers();
      this.filterProducts();
      // 加载已有专属价
      const prices = wx.getStorageSync('customerPrices') || [];
      this._allPrices = prices;
      return;
    }

    // 并行加载客户和产品
    try {
      const [custRes, prodRes] = await Promise.all([
        wx.cloud.callFunction({ name: 'customerCRUD', data: { action: 'list', pageSize: 500 } }),
        wx.cloud.callFunction({ name: 'getProducts', data: { page: 1, pageSize: 500 } })
      ]);

      const customers = (custRes.result && custRes.result.code === 0)
        ? (custRes.result.data.list || []) : [];
      const products = (prodRes.result && prodRes.result.code === 0)
        ? (prodRes.result.data.list || []).map(p => ({ ...p, priceText: (p.price / 100).toFixed(2) }))
        : [];

      this.setData({ customers, products });
      this.filterCustomers();
      this.filterProducts();
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  // ===== 客户选择 =====
  onCustomerSearch(e) {
    this.setData({ customerSearchKeyword: e.detail.value });
    this.filterCustomers();
  },

  onClearCustomerSearch() {
    this.setData({ customerSearchKeyword: '' });
    this.filterCustomers();
  },

  filterCustomers() {
    const { customers, customerSearchKeyword } = this.data;
    if (!customerSearchKeyword) {
      this.setData({ filteredCustomers: customers });
      return;
    }
    const kw = customerSearchKeyword.toLowerCase();
    this.setData({
      filteredCustomers: customers.filter(c =>
        (c.name || '').toLowerCase().includes(kw) ||
        (c.phone || '').toLowerCase().includes(kw)
      )
    });
  },

  onToggleCustomer(e) {
    const phone = e.currentTarget.dataset.phone;
    const selected = { ...this.data.selectedCustomerPhones };
    if (selected[phone]) {
      delete selected[phone];
    } else {
      selected[phone] = true;
    }
    const count = Object.keys(selected).length;
    this.setData({
      selectedCustomerPhones: selected,
      selectedCustomerCount: count
    });
    this.loadPricesForSelected();
  },

  // ===== 产品选择 =====
  onProductSearch(e) {
    this.setData({ productSearchKeyword: e.detail.value, listScrollTop: 0 });
    this.filterProducts();
  },

  onClearProductSearch() {
    this.setData({ productSearchKeyword: '', listScrollTop: 0 });
    this.filterProducts();
  },

  filterProducts() {
    const { products, productSearchKeyword } = this.data;
    let list = products;
    if (productSearchKeyword) {
      const kw = productSearchKeyword.toLowerCase();
      list = list.filter(p =>
        (p.name || '').toLowerCase().includes(kw) ||
        (p.category || '').toLowerCase().includes(kw)
      );
    }
    // 重置全选状态
    const allSelected = list.length > 0 && list.every(p => this.data.selectedProductIds[p._id]);
    this.setData({ filteredProducts: list, allSelected });
  },

  onToggleProduct(e) {
    const id = e.currentTarget.dataset.id;
    const selected = { ...this.data.selectedProductIds };
    if (selected[id]) {
      delete selected[id];
    } else {
      selected[id] = true;
    }
    const count = Object.keys(selected).length;
    const allSelected = this.data.filteredProducts.every(p => selected[p._id]);
    this.setData({
      selectedProductIds: selected,
      selectedProductCount: count,
      allSelected
    });
  },

  onToggleSelectAll() {
    if (this.data.allSelected) {
      this.setData({ selectedProductIds: {}, selectedProductCount: 0, allSelected: false });
    } else {
      const selected = {};
      this.data.filteredProducts.forEach(p => { selected[p._id] = true; });
      this.setData({
        selectedProductIds: selected,
        selectedProductCount: this.data.filteredProducts.length,
        allSelected: true
      });
    }
  },

  // ===== 加载专属价 =====
  async loadPricesForSelected() {
    const phones = Object.keys(this.data.selectedCustomerPhones);
    if (phones.length === 0) {
      this.setData({ priceInputs: {}, pricePlaceholders: {}, initialPrices: {} });
      return;
    }

    const app = getApp();
    let allEntries = [];

    if (app.globalData.demoMode) {
      const prices = this._allPrices || [];
      allEntries = prices.filter(p => phones.includes(p.customerPhone));
    } else {
      // 并行查所有选中客户的专属价
      try {
        const results = await Promise.all(
          phones.map(phone =>
            wx.cloud.callFunction({
              name: 'customerPriceCRUD',
              data: { action: 'getByPhone', phone }
            })
          )
        );
        allEntries = results
          .filter(r => r.result && r.result.code === 0 && r.result.data)
          .flatMap(r => r.result.data.list || []);
      } catch (err) {
        console.error('加载专属价失败', err);
        return;
      }
    }

    // 合并多客户价格
    const priceByProduct = {}; // productId → Set of prices
    const initialPrices = {};
    allEntries.forEach(entry => {
      const key = entry.customerPhone + '::' + entry.productId;
      initialPrices[key] = entry.customPrice;
      if (!priceByProduct[entry.productId]) {
        priceByProduct[entry.productId] = new Set();
      }
      priceByProduct[entry.productId].add(entry.customPrice);
    });

    // 构建 inputs 和 placeholders
    const priceInputs = {};
    const pricePlaceholders = {};
    Object.keys(priceByProduct).forEach(pid => {
      const priceSet = priceByProduct[pid];
      if (priceSet.size === 1) {
        // 所有选中客户价格一致 → 显示
        const priceInYuan = (Array.from(priceSet)[0] / 100).toFixed(2);
        priceInputs[pid] = priceInYuan;
        pricePlaceholders[pid] = '';
      } else {
        // 价格不一致 → 空白 + 提示
        priceInputs[pid] = '';
        pricePlaceholders[pid] = '多个价格';
      }
    });

    this.setData({ priceInputs, pricePlaceholders, initialPrices });
  },

  // ===== 价格输入 =====
  onPriceInput(e) {
    const id = e.currentTarget.dataset.id;
    const value = e.detail.value;
    this.setData({ ['priceInputs.' + id]: value });
  },

  // ===== 批量改价弹窗 =====
  onBatchSetPrice() {
    if (this.data.selectedProductCount === 0) {
      wx.showToast({ title: '请先选择产品', icon: 'none' });
      return;
    }
    this.setData({ showBatchModal: true, batchPriceValue: '' });
  },

  onBatchPriceInput(e) {
    this.setData({ batchPriceValue: e.detail.value });
  },

  onCancelBatch() {
    this.setData({ showBatchModal: false });
  },

  onConfirmBatch() {
    const price = parseFloat(this.data.batchPriceValue);
    if (isNaN(price) || price <= 0) {
      wx.showToast({ title: '请输入有效的价格', icon: 'none' });
      return;
    }
    const priceStr = price.toFixed(2);
    const selectedIds = this.data.selectedProductIds;
    const priceInputs = { ...this.data.priceInputs };
    const pricePlaceholders = { ...this.data.pricePlaceholders };
    Object.keys(selectedIds).forEach(id => {
      priceInputs[id] = priceStr;
      pricePlaceholders[id] = '';
    });
    this.setData({ showBatchModal: false, priceInputs, pricePlaceholders });
  },

  // ===== 保存 =====
  async onSave() {
    const phones = Object.keys(this.data.selectedCustomerPhones);
    if (phones.length === 0) {
      wx.showToast({ title: '请先选择客户', icon: 'none' });
      return;
    }

    const { priceInputs, initialPrices, products } = this.data;
    const sets = [];   // 需要新增/更新的
    const deletes = []; // 需要删除的

    // 构建产品名称映射
    const productNameMap = {};
    products.forEach(p => { productNameMap[p._id] = p.name; });

    // 遍历所有选中客户 × 所有有输入/有初始值的商品
    const allProductIds = new Set([
      ...Object.keys(priceInputs),
      ...Object.keys(initialPrices).map(k => k.split('::')[1])
    ]);

    allProductIds.forEach(pid => {
      phones.forEach(phone => {
        const key = phone + '::' + pid;
        const inputVal = priceInputs[pid];
        const initialVal = initialPrices[key];

        if (inputVal !== undefined && inputVal !== '') {
          // 有输入 → 设置/更新
          const newPrice = Math.round(parseFloat(inputVal) * 100);
          if (isNaN(newPrice) || newPrice <= 0) return;
          if (initialVal !== newPrice) {
            sets.push({
              customerPhone: phone,
              productId: pid,
              productName: productNameMap[pid] || '',
              customPrice: newPrice
            });
          }
        } else if (inputVal === '' && initialVal !== undefined) {
          // 清空了之前有值的 → 删除
          deletes.push({ customerPhone: phone, productId: pid });
        }
        // inputVal undefined 且 无初始值 → 跳过（没碰过这个格子）
      });
    });

    if (sets.length === 0 && deletes.length === 0) {
      wx.showToast({ title: '没有需要保存的更改', icon: 'none' });
      return;
    }

    const app = getApp();

    if (app.globalData.demoMode) {
      // 演示模式：操作本地存储
      let prices = wx.getStorageSync('customerPrices') || [];
      // 处理删除
      deletes.forEach(d => {
        prices = prices.filter(p => !(p.customerPhone === d.customerPhone && p.productId === d.productId));
      });
      // 处理新增/更新
      sets.forEach(s => {
        const existIdx = prices.findIndex(p => p.customerPhone === s.customerPhone && p.productId === s.productId);
        if (existIdx > -1) {
          prices[existIdx] = { ...prices[existIdx], customPrice: s.customPrice, productName: s.productName, updatedAt: Date.now() };
        } else {
          prices.push({
            _id: 'cp' + Date.now() + Math.random().toString(36).slice(2),
            customerPhone: s.customerPhone,
            productId: s.productId,
            productName: s.productName,
            customPrice: s.customPrice,
            createdAt: Date.now(),
            updatedAt: Date.now()
          });
        }
      });
      wx.setStorageSync('customerPrices', prices);
      this._allPrices = prices;

      wx.showToast({ title: `已保存${sets.length}条，删除${deletes.length}条`, icon: 'success' });
      // 刷新价格显示
      this.setData({ initialPrices: {} });
      this.loadPricesForSelected();
      return;
    }

    wx.showLoading({ title: '保存中...' });
    try {
      const tasks = [];
      if (sets.length > 0) {
        tasks.push(
          wx.cloud.callFunction({ name: 'customerPriceCRUD', data: { action: 'batchSet', entries: sets } })
        );
      }
      if (deletes.length > 0) {
        tasks.push(
          wx.cloud.callFunction({ name: 'customerPriceCRUD', data: { action: 'batchDelete', entries: deletes } })
        );
      }
      await Promise.all(tasks);

      wx.hideLoading();
      wx.showToast({ title: `已保存${sets.length}条，删除${deletes.length}条`, icon: 'success' });
      // 刷新
      this.setData({ initialPrices: {} });
      this.loadPricesForSelected();
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '网络错误', icon: 'none' });
    }
  },

  // ===== 导航 =====
  onBack() {
    wx.redirectTo({ url: '/pages/admin/orders/orders' });
  },

  onListScroll(e) {
    this._lastScrollTop = e.detail.scrollTop;
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add pages/admin/pricing/pricing.js
git commit -m "feat: add pricing admin page logic"
```

---

### Task 8: Register route in app.json

**Files:**
- Modify: `app.json`

- [ ] **Step 1: Add pricing page to pages array in app.json**

```json
// OLD pages array:
"pages/admin/customers/customers"

// Add after customers:
"pages/admin/customers/customers",
"pages/admin/pricing/pricing"
```

Full context in `app.json`:

```json
{
  "pages": [
    "pages/index/index",
    "pages/cart/cart",
    "pages/checkout/checkout",
    "pages/orders/orders",
    "pages/address/address",
    "pages/address/select",
    "pages/my/my",
    "pages/admin/login/login",
    "pages/admin/dashboard/dashboard",
    "pages/admin/orders/orders",
    "pages/admin/products/products",
    "pages/admin/customers/customers",
    "pages/admin/pricing/pricing"
  ],
  ...
}
```

- [ ] **Step 2: Commit**

```bash
git add app.json
git commit -m "feat: register pricing admin page route"
```

---

### Task 9: Deploy cloud functions and verify

**Files:**
- Deploy: `customerPriceCRUD`, `customerCRUD`

- [ ] **Step 1: Deploy all modified cloud functions**

```bash
bash deploy.sh
```

- [ ] **Step 2: Verify customerPriceCRUD is deployed**

Run: `tcb fn invoke customerPriceCRUD --env-id cloudbase-d6g98vaoyb7ec331a --data '{"action":"getByPhone","phone":"13800138001"}'`
Expected: `{ "code": 0, "data": { "list": [...], "total": 0 } }` (empty initially)

- [ ] **Step 3: Verify customerCRUD no longer uses discount**

Run: `tcb fn invoke customerCRUD --env-id cloudbase-d6g98vaoyb7ec331a --data '{"action":"list"}'`
Expected: customer records without `discount` field in response

- [ ] **Step 4: Commit**

```bash
git commit --allow-empty -m "deploy: customerPriceCRUD and updated customerCRUD"
```

---

### Task 10: Update documentation

**Files:**
- Modify: `docs/data-model.md`
- Modify: `docs/api-reference.md`

- [ ] **Step 1: Update data-model.md — add customerPrices collection, update customers**

After the `customers` section in `docs/data-model.md`, add:

```markdown
## customerPrices — 客户专属定价

```
权限: 所有用户可读, 仅管理员可写（通过云函数控制）
索引: customerPhone(升序) + productId(升序) 联合唯一（应用层保证）
```

| 字段 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| `_id` | string | 自动 | 文档 ID | `'cp001'` |
| `customerPhone` | string | 是 | 客户手机号，与 `customers.phone` 对应 | `'13800138001'` |
| `productId` | string | 是 | 产品 ID | `'p001'` |
| `productName` | string | 是 | 产品名称（冗余快照） | `'色丁布 2cm'` |
| `customPrice` | integer | 是 | 专属单价（分） | `120` = ¥1.20 |
| `createdAt` | Date | 自动 | 创建时间 | `db.serverDate()` |
| `updatedAt` | Date | 自动 | 更新时间 | `db.serverDate()` |

**唯一性约束**：同一 customerPhone + productId 只能有一条记录，云函数内通过先查询后 upsert 保证。

**删除语义**：管理员清空专属价输入框 → 删除该记录，该客户该产品恢复走零售价。
```

Update the `customers` section to remove `discount`:

```markdown
// Remove this row from the customers table:
| `discount` | number | 是 | 折扣率 | `1.0`(原价) / `0.85`(8.5折) |
```

Update the data relationship diagram — add `customerPrices`:

```
customerPrices
  customerPhone ◄── 结算页匹配专属价
  productId ◄── products._id
```

- [ ] **Step 2: Update api-reference.md — add customerPriceCRUD section**

Add between `customerCRUD` and `adminLogin` sections:

```markdown
### customerPriceCRUD — 客户专属定价

```
调用方: 结算页（匹配专属价）、管理后台定价页
鉴权: getByPhone 无需鉴权; 其余操作需 admin 鉴权
```

**入参**（按 action）：
| action | 参数 | 鉴权 | 说明 |
|--------|------|------|------|
| `getByPhone` | `phone` | 无 | 查某客户所有专属价 |
| `list` | `page, pageSize, customerPhone?, keyword?` | admin | 分页列表，支持按客户/产品名筛选 |
| `set` | `customerPhone, productId, productName, customPrice` | admin | 单条新增/更新 |
| `batchSet` | `entries: [{customerPhone, productId, productName, customPrice}]` | admin | 批量设置 |
| `delete` | `customerPhone, productId` | admin | 单条删除 |
| `batchDelete` | `entries: [{customerPhone, productId}]` | admin | 批量删除 |

**出参**：
- `getByPhone`: `{ code: 0, data: { list: [{ customerPhone, productId, productName, customPrice }], total: N } }`
- `list`: `{ code: 0, data: { list: [...], total, page, pageSize } }`
- `set/delete`: `{ code: 0 }`
- `batchSet`: `{ code: 0, data: { updated: N } }`
- `batchDelete`: `{ code: 0, data: { deleted: N } }`
```

Also update `customerCRUD` section — remove `discount` from `add`/`update` parameters.

- [ ] **Step 3: Commit**

```bash
git add docs/data-model.md docs/api-reference.md
git commit -m "docs: add customerPrices collection and customerPriceCRUD API docs"
```

---

### Task 11: Final verification checklist

- [ ] **Step 1: Verify all files exist**

Run: `ls cloudfunctions/customerPriceCRUD/index.js cloudfunctions/customerPriceCRUD/config.json cloudfunctions/customerPriceCRUD/package.json pages/admin/pricing/pricing.js pages/admin/pricing/pricing.wxml pages/admin/pricing/pricing.wxss pages/admin/pricing/pricing.json`

- [ ] **Step 2: Verify checkout.js no longer references `customerDiscount` or `discountedPrice`**

Run: `grep -n "customerDiscount\|discountedPrice" pages/checkout/checkout.js`
Expected: no matches

- [ ] **Step 3: Verify customers admin no longer references `discount`**

Run: `grep -n "discount" pages/admin/customers/customers.js pages/admin/customers/customers.wxml`
Expected: no matches (or only in comments / demo data comments)

- [ ] **Step 4: Verify app.json has pricing route**

Run: `grep "pricing" app.json`
Expected: `"pages/admin/pricing/pricing"`

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: final verification after customer-specific pricing implementation"
```
