# 页面加载性能 + 按钮响应速度优化 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 解决两个用户体验问题：(1) 切换 Tab 到选购页/订单页时数据显示空白，必须下拉刷新才出现；(2) 后台"已拿货"等操作按钮按下后长时间无反馈。

**Architecture:** 两个问题根因不同——问题1是页面 `onShow` 生命周期中有缓存守卫跳过了数据加载；问题2是按钮处理器没有做乐观更新，等服务器返回后才刷新整个列表。修复策略：移除缓存守卫保证每次切 Tab 都拉最新数据；为所有管理操作按钮增加乐观 UI 更新 + 失败回滚。

**Tech Stack:** 微信小程序原生框架 (WXML/WXSS/JS)，CloudBase 云函数，无新增依赖。

---

## 问题分析摘要

### 问题1：页面需要下拉刷新才能显示数据

| 页面 | 根因 | 位置 |
|------|------|------|
| `pages/index/index.js` (选购页) | `onShow` 中 `if (products.length === 0)` 守卫跳过已缓存页面的数据刷新 | 第 39 行 |
| `pages/index/index.js` (选购页) | `onLoad` + `onShow` 连续触发导致首次加载时双重请求 | 第 23 + 39 行 |

`pages/orders/orders.js` 和 `pages/admin/orders/orders.js` 的 `onShow` 无缓存守卫，每次都会加载，问题仅在于异步数据到达前短暂显示空状态，非本次修复重点。

### 问题2：按钮响应慢（以"已拿货"为例）

| 问题 | 位置 |
|------|------|
| 无乐观更新：按钮状态等服务器返回后才变 | `pages/admin/orders/orders.js:483-489` |
| 无 loading 提示：用户不知道操作在进行 | 同上 |
| 成功后全量重载订单列表 (`loadOrders`)：多 1+N 次云函数调用 | 同上第 489 行 |

**耗时分析**：点"已拿货"→ 云函数鉴权(30-100ms) + 读订单(30-100ms) + 写订单(30-100ms) + 重载全量列表(count + N页并行，200-500ms) + 冷启动(0-2000ms) = **最高 3.5 秒无反馈**。

---

### Task 1: 修复选购页 onShow 缓存守卫

**Files:**
- Modify: `pages/index/index.js:27-47`

**问题**：第 39 行 `if (this.data.products.length === 0)` 导致非首次切 Tab 时跳过加载，用户看到旧数据。

**修复**：移除守卫，每次 `onShow` 都刷新。同时移除 `onLoad` 中的 `loadProducts()` 以避免首次双请求。

- [ ] **Step 1: 修改 onLoad — 移除重复的 loadProducts 调用**

`pages/index/index.js` 第 23-25 行，将：

```javascript
onLoad() {
    this.loadProducts();
},
```

改为：

```javascript
onLoad() {
    // loadProducts 移到 onShow 统一触发，避免 onLoad + onShow 双重请求
},
```

- [ ] **Step 2: 修改 onShow — 移除缓存守卫，每次都加载**

`pages/index/index.js` 第 38-41 行，将：

```javascript
onShow() {
    this.updateCartBadge();
    if (this.data.products.length === 0) {
        this.loadProducts();
    }
},
```

改为：

```javascript
onShow() {
    this.updateCartBadge();
    this.loadProducts();  // 每次切到此 Tab 都刷新商品列表
},
```

- [ ] **Step 3: 提交**

```bash
git add pages/index/index.js
git commit -m "fix: 选购页每次 onShow 都刷新，移除缓存守卫，消除双重请求"
```

---

### Task 2: adminTogglePickedUp 乐观更新

**Files:**
- Modify: `pages/admin/orders/orders.js:469-496`

**问题**：点"已拿货"后等服务器返回才更新 UI + 成功后全量重载列表。

**修复**：先乐观切换本地数据中该订单的 `pickedUp` 状态 → 发云函数 → 成功则只更新当前订单，不重载全量 → 失败则回滚。

- [ ] **Step 1: 重写 onTogglePickedUp 方法**

`pages/admin/orders/orders.js` 第 469-496 行，将整个 `onTogglePickedUp` 方法替换为：

```javascript
async onTogglePickedUp(e) {
    const { orderId } = e.currentTarget.dataset;
    if (!orderId) return;

    // 1. 乐观更新：立即翻转本地 pickedUp 状态
    const orderIndex = this.data.orders.findIndex(o => o._id === orderId);
    if (orderIndex === -1) return;
    const currentVal = this.data.orders[orderIndex].pickedUp;
    const newVal = !currentVal;

    this.setData({
        [`orders[${orderIndex}].pickedUp`]: newVal
    });

    // 2. 发云函数（带 loading 提示）
    wx.showLoading({ title: '处理中' });
    try {
        const res = await wx.cloud.callFunction({
            name: 'adminTogglePickedUp',
            data: { orderId }
        });
        wx.hideLoading();
        if (res.result.code !== 0) {
            // 失败：回滚
            this.setData({
                [`orders[${orderIndex}].pickedUp`]: currentVal
            });
            wx.showToast({ title: res.result.msg || '操作失败', icon: 'none' });
        }
        // 成功：不需要任何操作，乐观更新已生效
    } catch (err) {
        wx.hideLoading();
        // 网络异常：回滚
        this.setData({
            [`orders[${orderIndex}].pickedUp`]: currentVal
        });
        wx.showToast({ title: '网络错误', icon: 'none' });
    }
},
```

- [ ] **Step 2: 提交**

```bash
git add pages/admin/orders/orders.js
git commit -m "perf: adminTogglePickedUp 乐观更新，消除按钮延迟"
```

---

### Task 3: 其他管理按钮同样做乐观更新

**Files:**
- Modify: `pages/admin/orders/orders.js` — `onUpdateStatus` 方法 (约 400-440 行)
- Modify: `pages/admin/orders/orders.js` — `onDeleteOrder` 方法（如有）
- Modify: `pages/admin/orders/orders.js` — `onDeleteImage` 方法（如有）

先排查所有管理操作按钮，对可乐观更新的逐一改造。从已有的 `onTogglePickedUp` 模式复制。

- [ ] **Step 1: 读取 admin/orders/orders.js 找出所有操作按钮**

```bash
grep -n "async on" pages/admin/orders/orders.js
```

- [ ] **Step 2: 对 status 变更按钮做乐观更新**

查找 `onUpdateStatus` 方法，应用与 Task 2 相同的模式：先 `setData` 改本地 → 发云函数 → 失败回滚。代码模式与 Task 2 一致，将 `onUpdateStatus` 中的 `this.loadOrders()` 替换为本地 `setData` 更新对应订单的 status 字段。

- [ ] **Step 3: 对其他操作按钮做同样处理**

遍历 Step 1 找到的所有操作按钮方法，凡是用 `this.loadOrders()` 做刷新的，全部替换为本地 setData 乐观更新 + 失败回滚。

- [ ] **Step 4: 提交**

```bash
git add pages/admin/orders/orders.js
git commit -m "perf: 所有管理操作按钮改为乐观更新"
```

---

### Task 4: 验证

- [ ] **Step 1: 选购页验证**

小程序中：
1. 切换到选购 Tab → 应该立即看到商品列表（不需要下拉）
2. 切换到其他 Tab 再切回来 → 数据自动刷新
3. 下拉刷新仍正常工作

- [ ] **Step 2: 按钮响应验证**

小程序中：
1. 管理后台 → 订单列表 → 点"已拿货" → 按钮状态**立即**翻转（不等服务器）
2. 点状态修改按钮 → 立即看到变化
3. 如果网络断开 → 操作回滚，显示错误提示

- [ ] **Step 3: 提交最终验证结果**

记录验证通过，提交。

---

## 涉及文件清单

| 文件 | 改动类型 | 改动量 |
|------|---------|--------|
| `pages/index/index.js` | 修改 onLoad + onShow | 删 3 行，改 1 行 |
| `pages/admin/orders/orders.js` | 重写 onTogglePickedUp + 排查其他按钮 | ~30 行改写 |

**不涉及云函数** — 本次全部是前端修改，不需要部署。
