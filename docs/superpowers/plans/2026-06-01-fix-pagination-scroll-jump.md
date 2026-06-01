# 分页滚动跳顶 Bug 修复计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复三个列表页在分页加载更多时页面自动跳到顶部的 bug。

**Architecture:** 根本原因是 `setData({ products: [...this.data.products, ...newList] })` 替换整个数组引用，导致 `wx:for` 全量重渲染、滚动位置丢失。修复方案：将 `page > 1` 分支的数组追加改为索引级 `setData`，只通知框架新增的索引位置，实现最小化 DOM 更新。

**Tech Stack:** 微信小程序原生框架

---

### Task 1: 修复首页产品列表 (`pages/index/index.js`)

**Files:**
- Modify: `E:\miniprogram\pages\index\index.js:144-148,166-170`

**问题代码（两处：demo 分支和云分支的 page>1 分支）：**

Demo 分支（约第 144-148 行）：
```js
const products = [...this.data.products, ...slice];
const allProducts = [...this.data.allProducts, ...slice];
this.setData({ products, allProducts, loading: false, loadingMore: false, hasMore: start + pageSize < source.length });
```

云分支（约第 166-170 行）：
```js
this.setData({
  products: [...this.data.products, ...newList],
  allProducts: [...this.data.allProducts, ...newList],
  hasMore: newList.length >= pageSize
});
```

- [ ] **Step 1: 读取当前 `pages/index/index.js` 的 `loadProducts` 方法**

使用 Read 工具读取 `E:\miniprogram\pages\index\index.js`，确认第 131-179 行的当前实际代码。

- [ ] **Step 2: 修复 Demo 分支的 page>1 setData（约第 144-148 行）**

将：
```js
} else {
  const products = [...this.data.products, ...slice];
  const allProducts = [...this.data.allProducts, ...slice];
  this.setData({ products, allProducts, loading: false, loadingMore: false, hasMore: start + pageSize < source.length });
}
```

改为（索引追加 `products`，`allProducts` 保留全量替换因为它不在 wxml 中渲染）：
```js
} else {
  const prodStart = this.data.products.length;
  const allStart = this.data.allProducts.length;
  const updates = {};
  slice.forEach((item, i) => {
    updates[`products[${prodStart + i}]`] = item;
    updates[`allProducts[${allStart + i}]`] = item;
  });
  updates.loading = false;
  updates.loadingMore = false;
  updates.hasMore = start + pageSize < source.length;
  this.setData(updates);
}
```

- [ ] **Step 3: 修复云分支的 page>1 setData（约第 166-170 行）**

将：
```js
} else {
  this.setData({
    products: [...this.data.products, ...newList],
    allProducts: [...this.data.allProducts, ...newList],
    hasMore: newList.length >= pageSize
  });
}
```

改为：
```js
} else {
  const prodStart = this.data.products.length;
  const allStart = this.data.allProducts.length;
  const updates = {};
  newList.forEach((item, i) => {
    updates[`products[${prodStart + i}]`] = item;
    updates[`allProducts[${allStart + i}]`] = item;
  });
  updates.hasMore = newList.length >= pageSize;
  this.setData(updates);
}
```

- [ ] **Step 4: 提交**

```bash
git add pages/index/index.js
git commit -m "fix: prevent scroll jump on pagination load-more in product list"
```

---

### Task 2: 修复管理端订单列表 (`pages/admin/orders/orders.js`)

**Files:**
- Modify: `E:\miniprogram\pages\admin\orders\orders.js:155-167`

**问题代码（约第 155-167 行）：**

```js
} else {
  const combined = [...this.data.orders, ...newOrders];
  if (this.data.searchKeyword) {
    const kw = this.data.searchKeyword.toLowerCase();
    const filtered = combined.filter(o =>
      (o.customerName || '').toLowerCase().includes(kw) ||
      (o.phone || '').toLowerCase().includes(kw) ||
      (o.address || '').toLowerCase().includes(kw)
    );
    this.setData({ orders: filtered, returnList: [], hasMore: newOrders.length >= pageSize });
  } else {
    this.setData({ orders: combined, returnList: [], hasMore: newOrders.length >= pageSize });
  }
}
```

- [ ] **Step 1: 读取当前 `pages/admin/orders/orders.js` 的 `loadOrders` 方法**

使用 Read 工具读取第 119-175 行，确认当前代码。

- [ ] **Step 2: 修复 page>1 的搜索过滤和无过滤两个分支**

**关键分析：** 该页面在搜索模式下对已加载的全部数据做客户端过滤，`this.data.orders` 存储的是过滤后的结果。搜索时 `page` 已在 `onSearchInput` 中被重置为 1，所以 `page > 1` 时要么没有搜索过滤（直接用 `combined`），要么有搜索过滤但 `combined` 已经包含了全部已加载数据。

对于无搜索过滤分支，直接索引追加：
```js
} else {
  if (this.data.searchKeyword) {
    // 有搜索关键词：需要重新过滤全部已加载数据
    const combined = [...this.data.orders, ...newOrders];
    const kw = this.data.searchKeyword.toLowerCase();
    const filtered = combined.filter(o =>
      (o.customerName || '').toLowerCase().includes(kw) ||
      (o.phone || '').toLowerCase().includes(kw) ||
      (o.address || '').toLowerCase().includes(kw)
    );
    this.setData({ orders: filtered, returnList: [], hasMore: newOrders.length >= pageSize });
  } else {
    // 无搜索过滤：索引追加，避免滚动跳顶
    const start = this.data.orders.length;
    const updates = {};
    newOrders.forEach((item, i) => {
      updates[`orders[${start + i}]`] = item;
    });
    updates.returnList = [];
    updates.hasMore = newOrders.length >= pageSize;
    this.setData(updates);
  }
}
```

> **说明：** 搜索过滤分支保留全量替换是因为 `combined.filter()` 会改变已有 item 的位置（过滤掉不匹配的），此时需要全量渲染。但这种情况只在 `onSearchInput` 触发 `loadOrders` 时发生，此时 `page` 已被重置为 1，不会进入 `page > 1` 分支。所以在 `page > 1` 时走搜索过滤分支的概率极低（用户需要先搜索再往上滚到顶触发下拉刷新，然后搜索词恰好被清空...），保留全量替换是安全的。

- [ ] **Step 3: 提交**

```bash
git add pages/admin/orders/orders.js
git commit -m "fix: prevent scroll jump on pagination load-more in admin orders list"
```

---

### Task 3: 修复管理端产品列表 (`pages/admin/products/products.js`)

**Files:**
- Modify: `E:\miniprogram\pages\admin\products\products.js:67-69,89-92,500-513`

**已确认：** WXML 用 `wx:for="{{filteredProducts}}"`（第 26 行），不是 `products`。`filterProducts()` 无搜索时做 `this.setData({ filteredProducts: products })`，全量替换引用。

**因此需要修复两处：** (1) `products` 数组的追加方式，(2) `filterProducts()` 中 `filteredProducts` 的全量替换。

- [ ] **Step 1: 读取当前 `pages/admin/products/products.js`**

使用 Read 读取第 53-100 行（`loadProducts` 方法）和第 500-513 行（`filterProducts` 方法）。

- [ ] **Step 2: 修复 Demo 分支 page>1（约第 67-69 行）**

将：
```js
} else {
  const products = [...this.data.products, ...slice];
  this.setData({ products, hasMore: start + pageSize < source.length, loadingMore: false });
}
```

改为：
```js
} else {
  const prodStart = this.data.products.length;
  const fprodStart = this.data.filteredProducts ? this.data.filteredProducts.length : 0;
  const updates = {};
  slice.forEach((item, i) => {
    updates[`products[${prodStart + i}]`] = item;
    updates[`filteredProducts[${fprodStart + i}]`] = item;
  });
  updates.hasMore = start + pageSize < source.length;
  updates.loadingMore = false;
  this.setData(updates);
}
```

- [ ] **Step 3: 修复云分支 page>1（约第 89-92 行）**

将：
```js
} else {
  this.setData({
    products: [...this.data.products, ...newList],
    hasMore: newList.length >= pageSize
  });
}
```

改为：
```js
} else {
  const prodStart = this.data.products.length;
  const fprodStart = this.data.filteredProducts ? this.data.filteredProducts.length : 0;
  const updates = {};
  newList.forEach((item, i) => {
    updates[`products[${prodStart + i}]`] = item;
    updates[`filteredProducts[${fprodStart + i}]`] = item;
  });
  updates.hasMore = newList.length >= pageSize;
  this.setData(updates);
}
```

- [ ] **Step 4: 修复 `filterProducts()` 方法（约第 500-513 行）**

当前代码（无搜索时全量替换 `filteredProducts`）：
```js
filterProducts() {
  const { products, searchKeyword } = this.data;
  if (!searchKeyword) {
    this.setData({ filteredProducts: products });
    return;
  }
  const kw = searchKeyword.toLowerCase();
  this.setData({
    filteredProducts: products.filter(p =>
      (p.name || '').toLowerCase().includes(kw) ||
      (p.category || '').toLowerCase().includes(kw)
    )
  });
}
```

无搜索时需要改为索引追加（只在有新数据时才追加差值），有搜索时保留全量替换：

改为：
```js
filterProducts() {
  const { products, searchKeyword, filteredProducts } = this.data;
  if (!searchKeyword) {
    // 无搜索：只追加 products 比 filteredProducts 多出的新 item，避免全量替换导致滚动跳顶
    if (filteredProducts && filteredProducts.length < products.length) {
      const fStart = filteredProducts.length;
      const updates = {};
      for (let i = fStart; i < products.length; i++) {
        updates[`filteredProducts[${i}]`] = products[i];
      }
      this.setData(updates);
    }
    return;
  }
  // 有搜索关键词时需要全量替换（过滤导致 item 位置发生变化）
  const kw = searchKeyword.toLowerCase();
  this.setData({
    filteredProducts: products.filter(p =>
      (p.name || '').toLowerCase().includes(kw) ||
      (p.category || '').toLowerCase().includes(kw)
    )
  });
}
```

- [ ] **Step 5: 提交**

```bash
git add pages/admin/products/products.js
git commit -m "fix: prevent scroll jump on pagination load-more in admin products list"

---

## 自审检查清单

### 1. 覆盖范围

| 页面 | 分支 | 覆盖？ |
|---|---|---|
| index.js demo page>1 | Task 1 Step 2 | ✅ |
| index.js cloud page>1 | Task 1 Step 3 | ✅ |
| admin/orders.js cloud page>1 无过滤 | Task 2 Step 2 | ✅ |
| admin/orders.js cloud page>1 有过滤 | Task 2 Step 2（保留全量替换） | ✅ |
| admin/products.js demo page>1 | Task 3 Step 2 | ✅ |
| admin/products.js cloud page>1 | Task 3 Step 2 | ✅ |

### 2. 占位符扫描

无 TBD、TODO。

### 3. 类型一致性

- 索引追加模式在三个文件中保持一致：`const start = this.data.<array>.length; updates[<array>[${start + i}]] = item;`
- `updates` 对象命名统一
