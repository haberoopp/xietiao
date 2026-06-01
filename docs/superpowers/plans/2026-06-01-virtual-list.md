# 虚拟列表组件实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 创建可复用的虚拟列表组件 `virtual-list`，只渲染可视区附近的列表项，支持加载更多，彻底解决滚动跳顶问题。

**Architecture:** 自定义组件 + WXML 模板注入。组件用 `scroll-view` + `bindscroll` 追踪位置，计算可视区间，只 setData 30 条左右的可见项。通过 `<template>` 定义让每个页面注入自己的 item 模板。组件负责数学计算，页面负责数据获取和 item 样式。

**Tech Stack:** 微信小程序自定义组件、`scroll-view`、WXML template

---

## 文件结构

| 文件 | 操作 | 职责 |
|---|---|---|
| `components/virtual-list/virtual-list.js` | **新建** | 滚动计算、区间切片、加载更多 |
| `components/virtual-list/virtual-list.json` | **新建** | 组件声明 |
| `components/virtual-list/virtual-list.wxml` | **新建** | scroll-view + padding + template 渲染 |
| `components/virtual-list/virtual-list.wxss` | **新建** | 组件样式 |
| `pages/index/index.js` | 修改 | 接入 virtual-list，pageSize 改回 20 |
| `pages/index/index.wxml` | 修改 | 替换 wx:for 为 virtual-list |
| `pages/index/index.json` | 修改 | 注册组件 |
| `pages/admin/orders/orders.js` | 修改 | 同上 |
| `pages/admin/orders/orders.wxml` | 修改 | 同上 |
| `pages/admin/orders/orders.json` | 修改 | 注册组件 |
| `pages/admin/products/products.js` | 修改 | 同上 |
| `pages/admin/products/products.wxml` | 修改 | 同上 |
| `pages/admin/products/products.json` | 修改 | 注册组件 |

---

### Task 1: 创建 virtual-list 自定义组件

**Files:**
- Create: `E:\miniprogram\components\virtual-list/virtual-list.js`
- Create: `E:\miniprogram\components\virtual-list/virtual-list.json`
- Create: `E:\miniprogram\components\virtual-list/virtual-list.wxml`
- Create: `E:\miniprogram\components\virtual-list/virtual-list.wxss`

**原理：**

```
┌─────────────────────────┐
│  scroll-view (整屏高)    │
│                         │
│  spacer (padding-top)   │  ← 不可见区域用空白撑开
│                         │
│  item 10 (可见)          │
│  item 11 (可见)          │  ← 只渲染 startIndex~endIndex
│  item 12 (可见)          │
│  ...                    │
│                         │
│  spacer (padding-bottom)│  ← 剩余不可见区域
│                         │
│  加载中... / 已全部       │
└─────────────────────────┘
```

核心计算（组件 JS 中）：
```
startIndex = floor(scrollTop / itemHeight) - buffer
endIndex   = ceil((scrollTop + viewportHeight) / itemHeight) + buffer
visibleItems = allItems.slice(startIndex, endIndex)
topPadding = startIndex * itemHeight
```

- [ ] **Step 1: 创建 `components/virtual-list/virtual-list.json`**

```json
{
  "component": true,
  "usingComponents": {}
}
```

- [ ] **Step 2: 创建 `components/virtual-list/virtual-list.js`**

```js
Component({
  options: {
    multipleSlots: true
  },

  properties: {
    // 全量数据
    items: {
      type: Array,
      value: [],
      observer: '_onItemsChange'
    },
    // 每项高度（rpx → px 转换在组件内处理）
    itemHeight: {
      type: Number,
      value: 200
    },
    // 可视区上下各多渲染几个（缓冲区）
    buffer: {
      type: Number,
      value: 5
    },
    // 是否正在加载
    loadingMore: {
      type: Boolean,
      value: false
    },
    // 是否已全部加载
    hasMore: {
      type: Boolean,
      value: true
    },
    // 容器高度（使用 px，默认铺满屏幕）
    height: {
      type: Number,
      value: 0
    }
  },

  data: {
    visibleItems: [],
    topPadding: 0,
    bottomPadding: 0,
    _itemHeightPx: 0,
    _viewportHeight: 0,
    _totalHeight: 0
  },

  lifetimes: {
    attached() {
      const sysInfo = wx.getSystemInfoSync();
      const rpxRate = sysInfo.windowWidth / 750;
      const itemHeightPx = Math.round(this.properties.itemHeight * rpxRate);
      const viewportHeight = this.properties.height || sysInfo.windowHeight;
      this.setData({
        _itemHeightPx: itemHeightPx,
        _viewportHeight: viewportHeight
      });
    }
  },

  methods: {
    _onItemsChange(newItems) {
      if (!newItems) return;
      const totalHeight = newItems.length * this.data._itemHeightPx;
      this.setData({ _totalHeight: totalHeight });
      this._calcVisible(0);
    },

    onScroll(e) {
      const scrollTop = e.detail.scrollTop;
      this._calcVisible(scrollTop);
    },

    _calcVisible(scrollTop) {
      const { items, buffer } = this.properties;
      const { _itemHeightPx, _viewportHeight } = this.data;
      if (!items || items.length === 0 || !_itemHeightPx) return;

      const startIndex = Math.max(0, Math.floor(scrollTop / _itemHeightPx) - buffer);
      const endIndex = Math.min(
        items.length,
        Math.ceil((scrollTop + _viewportHeight) / _itemHeightPx) + buffer
      );

      const visibleItems = items.slice(startIndex, endIndex);
      const topPadding = startIndex * _itemHeightPx;
      const bottomPadding = Math.max(0,
        (items.length - endIndex) * _itemHeightPx
      );

      this.setData({ visibleItems, topPadding, bottomPadding });
    },

    onScrollToLower() {
      if (!this.properties.hasMore || this.properties.loadingMore) return;
      this.triggerEvent('loadmore');
    },

    onItemTap(e) {
      const index = e.currentTarget.dataset.index;
      const item = this.properties.items[index];
      this.triggerEvent('itemtap', { item, index });
    }
  }
});
```

- [ ] **Step 3: 创建 `components/virtual-list/virtual-list.wxml`**

```xml
<scroll-view
  scroll-y
  class="vl-scroll"
  style="height: {{height > 0 ? height + 'px' : '100vh'}}"
  bindscroll="onScroll"
  bindscrolltolower="onScrollToLower"
  lower-threshold="200"
>
  <!-- 上方空白，撑开不可见区域 -->
  <view style="height: {{topPadding}}px;"></view>

  <!-- 可见项渲染 -->
  <view
    wx:for="{{visibleItems}}"
    wx:key="_id"
    wx:for-item="item"
    wx:for-index="idx"
    data-index="{{idx}}"
    bindtap="onItemTap"
  >
    <slot name="item" item="{{item}}" index="{{idx}}"></slot>
  </view>

  <!-- 下方空白 -->
  <view style="height: {{bottomPadding}}px;"></view>

  <!-- 加载状态 -->
  <view wx:if="{{loadingMore}}" class="vl-footer">
    <text>加载中...</text>
  </view>
  <view wx:elif="{{!hasMore && items.length > 0}}" class="vl-footer">
    <text>— 已加载全部 —</text>
  </view>
</scroll-view>
```

- [ ] **Step 4: 创建 `components/virtual-list/virtual-list.wxss`**

```css
.vl-scroll {
  width: 100%;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.vl-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 30rpx 0;
  color: #999;
  font-size: 24rpx;
}
```

- [ ] **Step 5: 提交**

```bash
git add components/virtual-list/
git commit -m "feat: add virtual-list custom component"
```

---

### Task 2: 首页产品列表接入 virtual-list

**Files:**
- Modify: `E:\miniprogram\pages\index\index.json`
- Modify: `E:\miniprogram\pages\index\index.wxml`
- Modify: `E:\miniprogram\pages\index\index.js`

- [ ] **Step 1: 注册组件 `pages/index/index.json`**

读取当前 `index.json`，添加 usingComponents：

```json
{
  "usingComponents": {
    "virtual-list": "/components/virtual-list/virtual-list"
  }
}
```

（如果有其他已有字段则保留）

- [ ] **Step 2: 修改 `pages/index/index.js` — 恢复分页逻辑**

当前 `loadProducts` 是一次性加载 500 条。改为分页 + 追加：

在 `data` 中重新添加：
```js
page: 1,
pageSize: 20,
hasMore: true,
loadingMore: false,
```

重写 `loadProducts`：page=1 时全量替换 `products`；page>1 时追加到 `products` 数组末尾。

```js
async loadProducts() {
    this.setData({ loading: true });
    const app = getApp();

    if (app.globalData.demoMode) {
      const { page, pageSize } = this.data;
      const source = demoStore.getAll(demoStore.KEYS.products);
      const start = (page - 1) * pageSize;
      const slice = source.slice(start, start + pageSize).map(p => ({
        ...p, priceText: (p.price / 100).toFixed(2)
      }));
      if (page === 1) {
        this.setData({ products: slice, allProducts: slice, loading: false, hasMore: start + pageSize < source.length });
      } else {
        const products = this.data.products.concat(slice);
        const allProducts = this.data.allProducts.concat(slice);
        this.setData({ products, allProducts, loading: false, hasMore: start + pageSize < source.length });
      }
      this.setData({ loadingMore: false });
      this.filterProducts();
      return;
    }

    try {
      const { page, pageSize } = this.data;
      const res = await wx.cloud.callFunction({ name: 'getProducts', data: { page, pageSize } });
      if (res.result.code === 0) {
        const newList = res.result.data.list.map(p => ({
          ...p, priceText: (p.price / 100).toFixed(2)
        }));
        const total = res.result.data.total || 0;
        if (page === 1) {
          this.setData({ products: newList, allProducts: newList, hasMore: newList.length < total });
        } else {
          const products = this.data.products.concat(newList);
          const allProducts = this.data.allProducts.concat(newList);
          this.setData({ products, allProducts, hasMore: products.length < total });
        }
      }
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
    this.setData({ loadingMore: false, loading: false });
  },
```

添加 `onLoadMore` 方法：
```js
onLoadMore() {
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

**注意：** 由于 `virtual-list` 组件会触发 `bindloadmore`，数据追加到 `this.data.products` 后，组件通过 `observer` 自动感知 `items` 变化并重新计算可视区间。这里使用的是 concat（创建新数组），因为 virtual-list 的 `_onItemsChange` observer 只在小数据量（visibleItems）上做 setData，页面级的 `products` 数组引用变了不影响滚动——**滚动在 scroll-view 内部，由组件管理，不会跳顶。**

- [ ] **Step 3: 修改 `pages/index/index.wxml` — 替换列表**

将现有的 `product-list` 块（含 `wx:for="{{products}}"`）替换为 virtual-list 组件。由于 WeChat 组件的 slot 不支持传递 item 数据到父级模板，采用 template 方案：

先在 WXML 顶部定义 item 模板：
```xml
<template name="product-item">
  <view class="product-card card {{item.status === 'out' ? 'product-out' : ''}} {{item.status === 'low' ? 'product-low' : ''}}">
    <image class="product-image {{item.status === 'out' ? 'img-out' : ''}}" src="{{item.image || '/images/placeholder.png'}}" mode="aspectFill" />
    <view class="product-info">
      <view class="product-name">{{item.name}}</view>
      <view class="product-meta">
        <text class="product-category">{{item.category}}</text>
        <text class="product-unit">/{{item.unit}}</text>
      </view>
      <view class="product-bottom">
        <view class="price"><text class="price-symbol">¥</text>{{item.priceText}}</view>
        <view wx:if="{{item.status === 'out'}}" class="add-cart-btn add-cart-out">缺货</view>
        <view wx:else class="add-cart-btn" data-product="{{item}}" catchtap="showQtyInput">+ 加入</view>
      </view>
    </view>
  </view>
</template>
```

然后替换列表部分为：
```xml
<virtual-list
  wx:else
  items="{{products}}"
  item-height="240"
  loading-more="{{loadingMore}}"
  has-more="{{hasMore}}"
  bindloadmore="onLoadMore"
  binditemtap="onProductTap"
  height="{{0}}"
>
  <view slot="item" slot-scope="item, index">
    <template is="product-item" data="{{item, index}}"></template>
  </view>
</virtual-list>
```

**⚠️ 此处有平台限制：** WeChat 小程序 `slot` 不支持 `slot-scope`。实际实现中，virtual-list 组件的 WXML 改为直接使用 `<template is="{{itemTemplate}}" data="{{...}}">` 模式，让页面通过 property 传入模板名，或直接把 item 内容写在组件内部。

**更实用的方案：** 由于 WeChat slot 无法传数据，改用 `include` 模式——每个页面在自己 WXML 中定义 item 模板，virtual-list 接收 `itemTemplateName` property，内部用 `<template is="{{itemTemplateName}}">` 渲染。但不同页面的模板名不同，需要在组件内统一。

**最终落地方案（最实用）：** 不用 WXML template，改用 **抽象节点（abstract node）** 或直接用 **组件属性传 WXS 渲染函数**。但这两者都太复杂。

**真正可行的最简单方案：** virtual-list 不负责 item 渲染。它只负责计算 `visibleItems` 并通过 `bindvisiblechange` 事件把切片数据传回页面。页面用自己的 WXML 渲染这些内容。

不对，那样页面还是要 setData 来更新 visibleItems，回到原问题。

**实际上最靠谱的方案：** virtual-list 用 `<slot>` 渲染每一个 item。由于 WeChat slot 限制，我们在组件内不传 `item` 数据，而是把 `item._id` 传给 slot，页面通过 `_id` 反查数据。但这也有问题...

**—— 重新评估 ——**

WeChat 自定义组件的 slot 在基础库 2.18.1+ 支持传递数据。但 `slot-scope` 语法不是标准 WeChat 支持的特性。

最简单可行的虚拟列表方案：**把 item 模板内联到组件属性中**。通过 property 传入一个 `item-class` 和一组 `fields` 配置，组件内部根据配置渲染。但这样就失去了灵活性。

**退一步 —— 最实际的方案：**

不使用自定义组件。改为在三个页面中各自使用 `<scroll-view>` + 手动虚拟滚动计算。用一个共享的 JS 模块 `utils/virtual-scroll.js` 提供核心计算逻辑，每个页面调用。

这样：
1. 避免 WeChat slot 的局限性
2. 每个页面保留自己的 item WXML 模板
3. 共享代码在 utils 中

---

**修正后的方案：**

- `utils/virtual-scroll.js` — 纯 JS 工具模块，提供 `VirtualScroll` 类
- 三个页面各自接入，在自己的 WXML 中用 `scroll-view` + 自己的 item 模板
- 页面调用 `vs.calcVisible(scrollTop)` 得到 `{ visibleItems, topPadding, bottomPadding }`
- 页面 setData 只传这 3 个值（visibleItems 只有 ~30 条，setData 轻量）

撤回 Task 1 的组件方案，改为虚拟滚动工具模块。

- [ ] **Step 1（修订）: 创建 `utils/virtual-scroll.js`**

```js
/**
 * 虚拟滚动工具模块
 * 在 scroll-view 中使用，只渲染可视区附近的列表项
 *
 * 用法：
 *   const vs = new VirtualScroll({ itemHeight: 240, buffer: 5 });
 *   page.onScroll(e) {
 *     const r = vs.calc(e.detail.scrollTop, page.data.allData);
 *     page.setData({ visibleItems: r.visibleItems, topPad: r.topPad, bottomPad: r.bottomPad });
 *   }
 */

class VirtualScroll {
  constructor(options = {}) {
    this.itemHeight = options.itemHeight || 200;  // rpx
    this.buffer = options.buffer || 5;
    this.viewportHeight = 0;
    this._itemHeightPx = 0;
  }

  /** 初始化时调用一次，计算 px 值 */
  init() {
    const sysInfo = wx.getSystemInfoSync();
    const rpxRate = sysInfo.windowWidth / 750;
    this._itemHeightPx = Math.round(this.itemHeight * rpxRate);
    this.viewportHeight = sysInfo.windowHeight;
  }

  /** 每次滚动时调用 */
  calc(scrollTop, allItems) {
    if (!allItems || allItems.length === 0) {
      return { visibleItems: [], topPad: 0, bottomPad: 0 };
    }
    const startIndex = Math.max(0,
      Math.floor(scrollTop / this._itemHeightPx) - this.buffer
    );
    const endIndex = Math.min(allItems.length,
      Math.ceil((scrollTop + this.viewportHeight) / this._itemHeightPx) + this.buffer
    );
    const visibleItems = [];
    for (let i = startIndex; i < endIndex; i++) {
      visibleItems.push(allItems[i]);
    }
    return {
      visibleItems,
      topPad: startIndex * this._itemHeightPx,
      bottomPad: Math.max(0, (allItems.length - endIndex) * this._itemHeightPx)
    };
  }
}

module.exports = { VirtualScroll };
```

- [ ] **Step 2（修订）: 删除 `components/virtual-list/`（如果已创建则跳过）**

- [ ] **Step 3（修订）: 提交**

```bash
git add utils/virtual-scroll.js
git commit -m "feat: add VirtualScroll utility for virtual list rendering"
```

---

### Task 2（修订）: 首页产品列表接入虚拟滚动

**Files:**
- Modify: `E:\miniprogram\pages\index\index.js`
- Modify: `E:\miniprogram\pages\index\index.wxml`

核心改动：
1. JS：添加 `vs` 实例，`onScroll` 更新 visibleItems，`onLoadMore` 加载下一页
2. WXML：外层包 `<scroll-view>`，替换 `wx:for="{{products}}"` 为 `wx:for="{{visibleItems}}"`

- [ ] **Step 1: 修改 `pages/index/index.js`**

在顶部添加：
```js
const { VirtualScroll } = require('../../utils/virtual-scroll');
```

在 Page data 中添加：
```js
visibleItems: [],
topPad: 0,
bottomPad: 0,
```

在 `onLoad` 中初始化：
```js
onLoad() {
    this._vs = new VirtualScroll({ itemHeight: 240, buffer: 3 });
    this._vs.init();
    this.loadProducts();
},
```

添加 `onScroll` 方法：
```js
onScroll(e) {
    if (!this.data.products || this.data.products.length === 0) return;
    const r = this._vs.calc(e.detail.scrollTop, this.data.products);
    this.setData({
      visibleItems: r.visibleItems,
      topPad: r.topPad,
      bottomPad: r.bottomPad
    });
},
```

修改 `loadProducts`：page=1 时加载完数据后，初始化 visibleItems：
```js
if (page === 1) {
  this.setData({ products: slice, allProducts: slice, ... });
  // 初始化虚拟列表
  const r = this._vs.calc(0, slice);
  this.setData({ visibleItems: r.visibleItems, topPad: r.topPad, bottomPad: r.bottomPad });
}
```

page>1 时只更新 `products`，不主动更新 `visibleItems`（下一次 `onScroll` 会触发更新）。

恢复分页相关 data 字段：`page: 1, pageSize: 20, hasMore: true, loadingMore: false`

- [ ] **Step 2: 修改 `pages/index/index.wxml`**

将 product-list 区域改为 scroll-view：

```xml
<scroll-view
  wx:else
  scroll-y
  class="vl-scroll"
  style="height: 100vh"
  bindscroll="onScroll"
  bindscrolltolower="onLoadMore"
  lower-threshold="200"
>
  <view style="height: {{topPad}}px;"></view>
  <view class="product-card card {{item.status === 'out' ? 'product-out' : ''}} {{item.status === 'low' ? 'product-low' : ''}}"
    wx:for="{{visibleItems}}" wx:key="_id">
    <image class="product-image" src="{{item.image || '/images/placeholder.png'}}" mode="aspectFill" />
    <view class="product-info">
      <view class="product-name">{{item.name}}</view>
      <view class="product-meta">
        <text class="product-category">{{item.category}}</text>
        <text class="product-unit">/{{item.unit}}</text>
      </view>
      <view class="product-bottom">
        <view class="price"><text class="price-symbol">¥</text>{{item.priceText}}</view>
        <view wx:if="{{item.status === 'out'}}" class="add-cart-btn add-cart-out">缺货</view>
        <view wx:else class="add-cart-btn" data-product="{{item}}" catchtap="showQtyInput">+ 加入</view>
      </view>
    </view>
  </view>
  <view style="height: {{bottomPad}}px;"></view>
  <view wx:if="{{loadingMore}}" class="vl-footer"><text>加载中...</text></view>
  <view wx:elif="{{!hasMore && products.length > 0}}" class="vl-footer"><text>— 已加载全部 —</text></view>
</scroll-view>
```

**⚠️ 关键：** `catchtap="showQtyInput"` — 这个事件处理函数需要 `data-product="{{item}}"` 来获取完整商品数据。由于 `visibleItems` 中的 item 就是 `products` 中的同一个对象引用，所以 data 绑定正常工作。

**⚠️ 注意：** 滚动在 `scroll-view` 内，`onPullDownRefresh` 仍然可以被页面级的下拉手势触发。但 `onReachBottom` 不再有效，改用 `bindscrolltolower`。

- [ ] **Step 3: 提交**

```bash
git add pages/index/index.js pages/index/index.wxml
git commit -m "feat: integrate VirtualScroll into product list page"
```

---

### Task 3: 管理端订单列表接入虚拟滚动

**Files:**
- Modify: `E:\miniprogram\pages\admin\orders\orders.js`
- Modify: `E:\miniprogram\pages\admin\orders\orders.wxml`

与 Task 2 相同的模式，适配订单列表：

- [ ] **Step 1: 修改 `pages/admin/orders/orders.js`**

添加：
```js
const { VirtualScroll } = require('../../../utils/virtual-scroll');
```

data 添加：`visibleItems: [], topPad: 0, bottomPad: 0`

onLoad/onShow 中初始化：`this._vs = new VirtualScroll({ itemHeight: 350, buffer: 4 }); this._vs.init();`

添加 `onScroll` 方法（同 Task 2 模式）。

恢复分页：`page: 1, pageSize: 20, hasMore: true, loadingMore: false`

恢复分页版 `loadOrders`：page=1 替换，page>1 concat 追加。loadOrders 中 page=1 时计算初始 visibleItems。

添加 `onLoadMore` 方法。

- [ ] **Step 2: 修改 `pages/admin/orders/orders.wxml`**

将订单列表包在 `<scroll-view>` 中，用 `wx:for="{{visibleItems}}"` 替换 `wx:for="{{orders}}"`，添加 padding spacer 和 load-more 状态。

订单 item 模板保持原样（所有已有的 badges、按钮、图片等都保留）。

`bindscrolltolower` 对接到 `onLoadMore`。

- [ ] **Step 3: 提交**

```bash
git add pages/admin/orders/orders.js pages/admin/orders/orders.wxml
git commit -m "feat: integrate VirtualScroll into admin orders page"
```

---

### Task 4: 管理端产品列表接入虚拟滚动

**Files:**
- Modify: `E:\miniprogram\pages\admin\products\products.js`
- Modify: `E:\miniprogram\pages\admin\products\products.wxml`

- [ ] **Step 1: 修改 `pages/admin/products/products.js`**

添加 VirtualScroll 导入，data 添加 visibleItems/topPad/bottomPad，恢复分页。
`itemHeight: 160, buffer: 4`

- [ ] **Step 2: 修改 `pages/admin/products/products.wxml`**

替换 `wx:for="{{filteredProducts}}"` 为 `wx:for="{{visibleItems}}"`，包在 scroll-view 中。

- [ ] **Step 3: 提交**

```bash
git add pages/admin/products/products.js pages/admin/products/products.wxml
git commit -m "feat: integrate VirtualScroll into admin products page"
```

---

### Task 5: 全局 CSS

- [ ] **Step 1: 在 `app.wxss` 添加**

```css
.vl-scroll {
  width: 100%;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.vl-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 30rpx 0;
  color: #999;
  font-size: 24rpx;
}
```

- [ ] **Step 2: 提交**

```bash
git add app.wxss
git commit -m "style: add virtual-list global styles"
```

---

## 自审检查清单

### 1. Spec 覆盖

| 需求 | Task | 覆盖？ |
|---|---|---|
| 只渲染可视区域 | Task 1 (VirtualScroll calc) | ✅ |
| 支持加载更多 | Task 2/3/4 (onLoadMore + bindscrolltolower) | ✅ |
| 不会跳顶 | 架构保证（scroll-view 内滚动，setData 只传 ~30 条） | ✅ |
| 产品列表复用 | Task 2 | ✅ |
| 订单列表复用 | Task 3 | ✅ |
| 产品管理复用 | Task 4 | ✅ |

### 2. 占位符扫描

无 TBD、TODO。

### 3. 类型一致性

- `VirtualScroll` 类接口：`init()`, `calc(scrollTop, allItems)` → `{ visibleItems, topPad, bottomPad }`
- 三个页面统一使用 `topPad`/`bottomPad` 字段名
- 分页参数统一：`page: 1, pageSize: 20, hasMore: true, loadingMore: false`
