# UI 重设计 v2 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 全站 UI 重设计，统一配色（珊瑚红 #E8594B）、间距、卡片样式，首页改为单列虚拟列表，后台增加两栏结构。

**Architecture:** 从底层 tokens 开始逐层向上。先改 app.wxss 的 CSS 变量，再改导航栏和 tab 栏，最后逐个改造页面。所有页面仅修改 WXSS + WXML 布局，不动 JS 业务逻辑。

**Tech Stack:** 微信小程序原生 WXSS/WXML，utils/virtual-scroll.js（已创建）

---

## 文件结构

| 文件 | 操作 | 职责 |
|---|---|---|
| `app.wxss` | 修改 | CSS 变量 + 全局样式 |
| `app.json` | 修改 | 导航栏样式 |
| `custom-tab-bar/index.wxss` | 修改 | Tab 栏颜色 |
| `custom-tab-bar/index.js` | 修改 | selectedColor |
| `pages/index/index.wxss` | 修改 | 单列卡片 + 虚拟列表 |
| `pages/index/index.wxml` | 修改 | 单列布局 |
| `pages/index/index.js` | 修改 | 虚拟列表接入 + 分页 |
| `pages/admin/login/login.wxss` | 修改 | 居中卡片登录页 |
| `pages/admin/login/login.wxml` | 修改 | 居中布局 |
| `pages/admin/orders/orders.wxml` | 修改 | 两栏 tab + 对账单单独行 |
| `pages/admin/orders/orders.wxss` | 修改 | 样式更新 |
| `pages/admin/orders/orders.js` | 修改 | tab 切换逻辑 |
| 其余 6 个页面 WXSS | 修改 | 配色间距替换 |

---

### Task 1: 更新 app.wxss CSS 变量和全局样式

**Files:**
- Modify: `E:\miniprogram\app.wxss`

- [ ] **Step 1: 替换 CSS 变量块**

将 `page {}` 内的 `--color-primary` 相关变量替换：

```css
/* === Design Tokens === */
page {
  --color-primary: #E8594B;
  --color-primary-dark: #D14438;
  --color-primary-light: #FDF0EF;
  --color-warning: #E67E22;
  --color-success: #27AE60;
  --color-text: #1A1A1A;
  --color-text-secondary: #666666;
  --color-bg: #F5F5F5;
  --color-card: #FFFFFF;
  --color-border: #EEEEEE;

  --space-xs: 8rpx;
  --space-sm: 16rpx;
  --space-md: 24rpx;
  --space-lg: 32rpx;

  --text-xs: 24rpx;
  --text-sm: 28rpx;
  --text-base: 32rpx;
  --text-lg: 36rpx;

  --shadow-card: 0 2rpx 8rpx rgba(0,0,0,0.04);
  --shadow-float: 0 -2rpx 16rpx rgba(0,0,0,0.06);
  --shadow-modal: 0 -4rpx 24rpx rgba(0,0,0,0.1);

  --radius-sm: 4rpx;
  --radius-md: 8rpx;
  --radius-lg: 12rpx;
  --radius-full: 40rpx;

  --touch-min: 88rpx;

  background-color: var(--color-bg);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: var(--text-sm);
  color: var(--color-text);
  line-height: 1.5;
}
```

- [ ] **Step 2: 更新全局按钮**

修改 `.btn-primary:active` 的 opacity 为 0.85，保持不动。

修改 `.badge-processing` 的颜色为 `#1976D2`（不变）。

- [ ] **Step 3: 更新导航栏相关 CSS**

在文件末尾添加（如果还没有）：

```css
/* Navigation bar - white style */
page {
  --nav-bar-bg: #FFFFFF;
  --nav-bar-text: #1A1A1A;
}
```

- [ ] **Step 4: 删除不再需要的样式**

删除 `.load-more`、`.load-more-tip`、`.vl-scroll`、`.vl-footer` 类（虚拟列表不再使用这些全局样式，改为页面内联）。

- [ ] **Step 5: 提交**

```bash
git add app.wxss
git commit -m "style: update CSS variables to coral red theme"
```

---

### Task 2: 更新导航栏和 Tab 栏

**Files:**
- Modify: `E:\miniprogram\app.json`
- Modify: `E:\miniprogram\custom-tab-bar/index.wxss`
- Modify: `E:\miniprogram\custom-tab-bar/index.js`

- [ ] **Step 1: 修改 app.json 导航栏**

将：
```json
"window": {
    "backgroundTextStyle": "light",
    "navigationBarBackgroundColor": "#d32f2f",
    "navigationBarTitleText": "温州斜条批发",
    "navigationBarTextStyle": "white"
},
```

改为：
```json
"window": {
    "backgroundTextStyle": "light",
    "navigationBarBackgroundColor": "#FFFFFF",
    "navigationBarTitleText": "温州斜条批发",
    "navigationBarTextStyle": "black"
},
```

- [ ] **Step 2: 修改 custom-tab-bar/index.js 的 selectedColor**

将：
```js
selectedColor: "#d32f2f",
```
改为：
```js
selectedColor: "#E8594B",
```

- [ ] **Step 3: 修改 custom-tab-bar/index.wxss**

将 `.tab-item.active .tab-text` 的 `color` 改为 `#E8594B`。

- [ ] **Step 4: 提交**

```bash
git add app.json custom-tab-bar/index.js custom-tab-bar/index.wxss
git commit -m "style: update nav bar to white and tab bar to coral red"
```

---

### Task 3: 首页改造 — 单列 + 虚拟列表

**Files:**
- Modify: `E:\miniprogram\pages\index\index.wxss`
- Modify: `E:\miniprogram\pages\index\index.wxml`
- Modify: `E:\miniprogram\pages\index\index.js`

这是整个重设计工作量最大的任务。

- [ ] **Step 1: 读取当前 index.js，确认现有结构**

读取 `E:\miniprogram\pages\index\index.js` 全文理解当前 loadProducts、onScroll、onLoadMore 等方法的现状。

- [ ] **Step 2: 修改 index.js — 接入虚拟列表**

添加 VirtualScroll 引入（文件顶部）：
```js
const { VirtualScroll } = require('../../utils/virtual-scroll');
```

在 data 中添加分页和虚拟列表字段：
```js
page: 1,
pageSize: 20,
hasMore: true,
loadingMore: false,
visibleItems: [],
topPad: 0,
bottomPad: 0,
```

在 onLoad 中初始化 VirtualScroll：
```js
onLoad() {
    this._vs = new VirtualScroll({ itemHeight: 208, buffer: 4 });
    this._vs.init();
    this.loadProducts();
},
```

添加 onScroll 方法：
```js
onScroll(e) {
    const items = this.data.products;
    if (!items || items.length === 0) return;
    const r = this._vs.calc(e.detail.scrollTop, items);
    this.setData({
        visibleItems: r.visibleItems,
        topPad: r.topPad,
        bottomPad: r.bottomPad
    });
},
```

添加 onLoadMore 方法：
```js
onLoadMore() {
    if (!this.data.hasMore || this.data.loadingMore) return;
    this.setData({ page: this.data.page + 1, loadingMore: true });
    this.loadProducts();
},
```

修改 loadProducts 为分页模式。Demo 分支从 demoStore 取数据后分页切片：

```js
async loadProducts() {
    this.setData({ loading: true });
    const app = getApp();

    if (app.globalData.demoMode) {
      const { page, pageSize } = this.data;
      const source = demoStore.getAll(demoStore.KEYS.products).map(p => ({
        ...p, priceText: (p.price / 100).toFixed(2)
      }));
      const start = (page - 1) * pageSize;
      const slice = source.slice(start, start + pageSize);
      if (page === 1) {
        this.setData({ products: slice, allProducts: source, hasMore: start + pageSize < source.length });
      } else {
        const products = this.data.products.concat(slice);
        this.setData({ products, allProducts: source, hasMore: products.length < source.length });
      }
      const r = this._vs.calc(0, this.data.products);
      this.setData({ visibleItems: r.visibleItems, topPad: r.topPad, bottomPad: r.bottomPad, loading: false, loadingMore: false });
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
          this.setData({ products: newList, hasMore: newList.length < total });
        } else {
          const products = this.data.products.concat(newList);
          this.setData({ products, hasMore: products.length < total });
        }
        const r = this._vs.calc(0, this.data.products);
        this.setData({ visibleItems: r.visibleItems, topPad: r.topPad, bottomPad: r.bottomPad });
      }
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
    this.setData({ loading: false, loadingMore: false });
},
```

修改 onPullDownRefresh 重置分页：
```js
onPullDownRefresh() {
    this.setData({ keyword: '', page: 1, hasMore: true });
    this.loadProducts().then(() => wx.stopPullDownRefresh());
},
```

删除不再需要的 filterProducts 增量追加逻辑（简化回纯过滤模式）：
```js
filterProducts() {
    const { keyword, activeCategory, allProducts } = this.data;
    let products = allProducts;

    if (keyword && keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      products = products.filter(p => p.name.toLowerCase().includes(kw));
    }
    if (activeCategory !== '全部') {
      products = products.filter(p => p.category === activeCategory);
    }

    this.setData({ products: products.map(p => ({ ...p, priceText: (p.price / 100).toFixed(2) })) });
    if (this._vs) {
      const r = this._vs.calc(0, products);
      this.setData({ visibleItems: r.visibleItems, topPad: r.topPad, bottomPad: r.bottomPad });
    }
},
```

- [ ] **Step 3: 修改 index.wxml — 单列布局**

将双列 product-list 替换为 scroll-view 虚拟列表。原本的 `<view class="product-list">` 处换成：

```xml
<scroll-view
  wx:else
  scroll-y
  style="height: calc(100vh - 200rpx)"
  bindscroll="onScroll"
  bindscrolltolower="onLoadMore"
  lower-threshold="200"
>
  <view style="height: {{topPad}}px;"></view>
  <view class="product-card card" wx:for="{{visibleItems}}" wx:key="_id">
    <image class="product-image {{item.status === 'out' ? 'img-out' : ''}}" src="{{item.image || '/images/placeholder.png'}}" mode="aspectFill" />
    <view class="product-info">
      <view class="product-name">{{item.name}}</view>
      <view class="product-meta">{{item.category}} / {{item.unit}}</view>
      <view class="product-bottom">
        <view class="price"><text class="price-symbol">¥</text>{{item.priceText}}</view>
        <view wx:if="{{item.status === 'out'}}" class="add-cart-btn add-cart-out">缺货</view>
        <view wx:else class="add-cart-btn" data-product="{{item}}" catchtap="showQtyInput">加入</view>
      </view>
    </view>
  </view>
  <view style="height: {{bottomPad}}px;"></view>
  <view wx:if="{{loadingMore}}" style="text-align:center;padding:24rpx;color:#999;font-size:24rpx">加载中...</view>
  <view wx:elif="{{!hasMore && products.length > 0}}" style="text-align:center;padding:24rpx;color:#999;font-size:24rpx">— 已加载全部 —</view>
</scroll-view>
```

- [ ] **Step 4: 重写 index.wxss — 单列卡片样式**

替换整个文件：

```css
/* Exchange banner - keep compact */
.exchange-banner {
  display: flex; align-items: center; justify-content: space-between;
  background: #FFF8E1; border-radius: 8rpx; padding: 16rpx; margin-bottom: 16rpx;
}
.exb-info { display: flex; align-items: center; flex: 1; overflow: hidden; }
.exb-icon { font-size: 28rpx; flex-shrink: 0; margin-right: 8rpx; }
.exb-text { font-size: 24rpx; color: #E65100; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.exb-cancel {
  font-size: 24rpx; color: var(--color-text-secondary); padding: 8rpx 16rpx;
  border: 1rpx solid #ccc; border-radius: 6rpx; flex-shrink: 0; margin-left: 8rpx;
}

/* Search bar */
.search-bar { padding: 16rpx 0; }
.search-input-wrap {
  display: flex; align-items: center; background: #fff;
  border-radius: 40rpx; padding: 12rpx 20rpx; box-shadow: var(--shadow-card);
}
.search-icon { font-size: 28rpx; margin-right: 8rpx; color: var(--color-text-secondary); }
.search-input { flex: 1; height: 56rpx; font-size: 28rpx; }
.search-clear { font-size: 24rpx; color: #ccc; padding: 8rpx; margin-left: 8rpx; }

/* Category bar */
.category-bar { white-space: nowrap; padding: 12rpx 0 8rpx; }
.category-item {
  display: inline-block; padding: 10rpx 28rpx; margin-right: 12rpx;
  background: #fff; border-radius: 30rpx; font-size: 26rpx; color: var(--color-text-secondary);
}
.category-item.active { background: var(--color-primary); color: #fff; }

/* Single-column product card */
.product-card {
  display: flex; flex-direction: row;
  padding: 0; margin: 0 16rpx 12rpx; overflow: hidden;
  background: #fff; border-radius: var(--radius-lg); box-shadow: var(--shadow-card);
  height: 200rpx;
}
.product-image {
  width: 180rpx; height: 180rpx; margin: 10rpx; border-radius: var(--radius-md);
  background: #F5F5F5; flex-shrink: 0;
}
.product-info {
  flex: 1; padding: 16rpx 16rpx 16rpx 0;
  display: flex; flex-direction: column; justify-content: space-between;
  overflow: hidden;
}
.product-name {
  font-size: 30rpx; font-weight: 500; color: var(--color-text);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.product-meta {
  font-size: 24rpx; color: var(--color-text-secondary); margin-top: 4rpx;
}
.product-bottom {
  display: flex; align-items: center; justify-content: space-between; margin-top: 8rpx;
}
.add-cart-btn {
  background: #fff; color: var(--color-primary); border: 2rpx solid var(--color-primary);
  font-size: 24rpx; padding: 8rpx 24rpx; border-radius: var(--radius-sm);
  min-width: 100rpx; min-height: 56rpx; text-align: center; line-height: 56rpx;
}
.add-cart-btn:active { background: var(--color-primary-light); }
.add-cart-out { background: #BDBDBD !important; color: #fff; border-color: #BDBDBD; }
.product-out { opacity: 0.45; }
.img-out { filter: grayscale(60%); }

/* Quantity modal - keep mostly as-is, update colors */
.modal-mask {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5); z-index: 1100;
  display: flex; align-items: center; justify-content: center;
}
.qty-modal {
  background: #fff; border-radius: var(--radius-lg); width: 560rpx; padding: 40rpx; text-align: center;
}
.qty-modal-title { font-size: 34rpx; font-weight: bold; margin-bottom: 8rpx; }
.qty-modal-product { font-size: 28rpx; color: var(--color-text); margin-bottom: 4rpx; }
.qty-modal-price { font-size: 26rpx; color: var(--color-primary); margin-bottom: 30rpx; }
.qty-input-row { display: flex; align-items: center; justify-content: center; gap: 16rpx; margin-bottom: 36rpx; }
.qty-minus, .qty-plus {
  width: 88rpx; height: 88rpx; line-height: 88rpx;
  background: #F5F5F5; border-radius: 6rpx; font-size: 36rpx; color: var(--color-text);
}
.qty-minus:active, .qty-plus:active { background: #E8E8E8; }
.qty-input {
  width: 160rpx; height: 80rpx; border: 2rpx solid var(--color-primary); border-radius: 8rpx;
  text-align: center; font-size: 36rpx; font-weight: bold;
}
.qty-modal-btns { display: flex; gap: 16rpx; }
.qty-cancel { flex: 1; }
.qty-confirm { flex: 2; }

/* Floating cart - keep structure, update colors */
.cart-float {
  position: fixed; bottom: calc(120rpx + env(safe-area-inset-bottom)); left: 0; right: 0;
  z-index: 1000; display: flex; flex-direction: column;
  box-shadow: var(--shadow-float);
}
.cart-float--open { max-height: 55vh; }
.cart-float-list { overflow-y: auto; flex: 1; padding: 0 24rpx; background: #fff; border-radius: 20rpx 20rpx 0 0; }
.cart-float-item { display: flex; align-items: center; padding: 18rpx 0; border-bottom: 1rpx solid var(--color-border); position: relative; }
.cfi-image { width: 88rpx; height: 88rpx; border-radius: 8rpx; background: #F5F5F5; flex-shrink: 0; }
.cfi-info { flex: 1; margin-left: 16rpx; overflow: hidden; }
.cfi-name { font-size: 26rpx; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cfi-price { font-size: 24rpx; color: var(--color-primary); margin-top: 4rpx; }
.cfi-qty-ctrl { display: flex; align-items: center; gap: 4rpx; margin-right: 24rpx; }
.cfi-qty-btn {
  width: 88rpx; height: 88rpx; line-height: 88rpx; text-align: center;
  background: #F5F5F5; border-radius: 8rpx; font-size: 28rpx; color: var(--color-text);
}
.cfi-qty-input { width: 72rpx; height: 44rpx; border: 1rpx solid #E8E8E8; border-radius: 8rpx; text-align: center; font-size: 24rpx; }
.cfi-del {
  position: absolute; top: 16rpx; right: 4rpx;
  width: 56rpx; height: 56rpx; line-height: 56rpx; text-align: center;
  font-size: 28rpx; color: #ccc; border-radius: 50%;
}
.cfi-del:active { background: var(--color-primary-light); color: var(--color-primary); }
.cart-float-bar {
  flex-shrink: 0; display: flex; align-items: center; justify-content: space-between;
  padding: 16rpx 24rpx; background: #fff; border-top: 1rpx solid var(--color-border);
}
.cfb-left { display: flex; align-items: center; gap: 16rpx; }
.cfb-icon-wrap { position: relative; width: 80rpx; height: 80rpx; display: flex; align-items: center; justify-content: center; }
.cfb-icon-bg {
  position: absolute; inset: 0; background: var(--color-primary); border-radius: 50%;
  box-shadow: 0 4rpx 12rpx rgba(232,89,75,0.25);
}
.cfb-icon-text { position: relative; z-index: 1; font-size: 40rpx; }
.cfb-count {
  position: absolute; top: -2rpx; right: -4rpx; z-index: 2;
  min-width: 34rpx; height: 34rpx; line-height: 34rpx; text-align: center;
  font-size: 20rpx; font-weight: bold; color: #fff;
  background: #FF3D00; border: 3rpx solid #fff; border-radius: 17rpx;
  padding: 0 8rpx; box-sizing: border-box;
}
.cfb-total { font-size: 32rpx; font-weight: bold; color: var(--color-primary-dark); }
.cfb-right { display: flex; align-items: center; }
.cfb-checkout-btn {
  background: var(--color-primary); color: #fff; font-size: 26rpx; font-weight: 500;
  padding: 14rpx 40rpx; border-radius: 36rpx; border: none;
}
.cfb-checkout-btn:active { opacity: 0.85; }
.cfb-exchange-btn {
  background: var(--color-warning); color: #fff; font-size: 26rpx; font-weight: 500;
  padding: 14rpx 32rpx; border-radius: 36rpx;
}
.cfb-exchange-btn:active { opacity: 0.85; }
```

- [ ] **Step 5: 提交**

```bash
git add pages/index/index.js pages/index/index.wxml pages/index/index.wxss
git commit -m "feat: redesign home page with single-column virtual list"
```

---

### Task 4: C 端页面配色间距更新

**Files:**
- Modify: `E:\miniprogram\pages\cart\cart.wxss`
- Modify: `E:\miniprogram\pages\checkout\checkout.wxss`
- Modify: `E:\miniprogram\pages\orders\orders.wxss`
- Modify: `E:\miniprogram\pages\address\address.wxss`

这些页面只改 WXSS，不动 WXML 和 JS。

- [ ] **Step 1: 统一替换所有页面的硬编码颜色**

在每个 WXSS 文件中，全局替换：
- `#C0392B` → `var(--color-primary)`
- `#A93226` → `var(--color-primary-dark)`
- `#FDF2F2` → `var(--color-primary-light)`
- `#7F8C8D` → `var(--color-text-secondary)`
- `#d32f2f` → `var(--color-primary)`

用 sed 批量操作：
```bash
for f in pages/cart/cart.wxss pages/checkout/checkout.wxss pages/orders/orders.wxss pages/address/address.wxss; do
  sed -i 's/#C0392B/var(--color-primary)/g' "$f"
  sed -i 's/#A93226/var(--color-primary-dark)/g' "$f"
  sed -i 's/#FDF2F2/var(--color-primary-light)/g' "$f"
  sed -i 's/#7F8C8D/var(--color-text-secondary)/g' "$f"
  sed -i 's/#d32f2f/var(--color-primary)/g' "$f"
  echo "Updated $f"
done
```

- [ ] **Step 2: 提交**

```bash
git add pages/cart/cart.wxss pages/checkout/checkout.wxss pages/orders/orders.wxss pages/address/address.wxss
git commit -m "style: update customer-facing pages to use CSS variables"
```

---

### Task 5: 后台登录页改造

**Files:**
- Modify: `E:\miniprogram\pages\admin\login\login.wxss`
- Modify: `E:\miniprogram\pages\admin\login\login.wxml`

- [ ] **Step 1: 读取 login.wxml 当前内容**

- [ ] **Step 2: 重写 login.wxml 为居中卡片布局**

```xml
<view class="login-page">
  <view class="login-card">
    <view class="login-logo">🧵</view>
    <view class="login-title">温州斜条批发</view>
    <view class="login-form">
      <input class="login-input" placeholder="账号" value="{{username}}" data-field="username" bindinput="onInput" />
      <input class="login-input" placeholder="密码" password value="{{password}}" data-field="password" bindinput="onInput" />
      <button class="login-btn" bindtap="onLogin" loading="{{loading}}">登 录</button>
    </view>
  </view>
</view>
```

- [ ] **Step 3: 重写 login.wxss**

```css
.login-page {
  display: flex; align-items: center; justify-content: center;
  min-height: 100vh; background: var(--color-bg); padding: 32rpx;
}
.login-card {
  width: 100%; max-width: 600rpx; background: #fff;
  border-radius: var(--radius-lg); box-shadow: var(--shadow-card);
  padding: 64rpx 48rpx; text-align: center;
}
.login-logo { font-size: 80rpx; margin-bottom: 16rpx; }
.login-title { font-size: var(--text-lg); font-weight: 600; color: var(--color-text); margin-bottom: 48rpx; }
.login-input {
  width: 100%; height: 96rpx; background: var(--color-bg);
  border-radius: var(--radius-md); padding: 0 24rpx;
  font-size: var(--text-base); margin-bottom: 24rpx; box-sizing: border-box;
}
.login-btn {
  width: 100%; height: 96rpx; background: var(--color-primary); color: #fff;
  border-radius: var(--radius-md); font-size: var(--text-base); font-weight: 500;
  border: none; margin-top: 8rpx;
}
.login-btn:active { background: var(--color-primary-dark); }
```

- [ ] **Step 4: 提交**

```bash
git add pages/admin/login/login.wxml pages/admin/login/login.wxss
git commit -m "style: redesign admin login page with centered card layout"
```

---

### Task 6: 后台订单管理 — 两栏 tab + 样式更新

**Files:**
- Modify: `E:\miniprogram\pages\admin\orders\orders.js`
- Modify: `E:\miniprogram\pages\admin\orders\orders.wxml`
- Modify: `E:\miniprogram\pages\admin\orders\orders.wxss`

- [ ] **Step 1: 读取 orders.js 当前内容**

- [ ] **Step 2: 修改 orders.js 的 statusTabs**

在 `data` 中修改 `statusTabs` 数组，把「功能」tab 加入：

```js
statusTabs: [
    { key: '', label: '全部订单' },
    { key: 'processing', label: '处理中' },
    { key: 'completed', label: '已完成' },
    { key: 'cancelled', label: '已取消' },
    { key: 'returns', label: '退换货' },
    { key: 'tools', label: '功能' }
],
```

修改 `onTabTap` 方法，添加「功能」tab 的处理：

```js
onTabTap(e) {
    const tab = e.currentTarget.dataset.status;
    if (tab === 'tools') {
      this.setData({ activeStatus: tab, isReturnTab: false, isToolsTab: true });
      return;
    }
    this.setData({ activeStatus: tab, isReturnTab: tab === 'returns', isToolsTab: false, page: 1, hasMore: true });
    this.loadOrders();
},
```

在 `data` 中添加：
```js
isToolsTab: false,
```

- [ ] **Step 3: 修改 orders.wxml — 添加功能面板**

在订单列表的 `<view wx:else>`（非退换货 tab）之前，插入功能 tab 的内容。找到 `<!-- ===== 订单列表 ===== -->` 之前的位置。

在退换货列表 `</view>`（第 81 行 closes `wx:if="{{isReturnTab}}"` 那个）之后、订单列表 `<view wx:else>` 之前，插入：

```xml
<!-- ===== 功能面板 ===== -->
<view wx:if="{{isToolsTab}}" class="tools-panel">
    <view class="tool-item" bindtap="onGoDashboard">
      <text class="tool-icon">📊</text>
      <text class="tool-label">仪表盘</text>
      <text class="tool-arrow">›</text>
    </view>
    <view class="tool-item" bindtap="onExportOrders">
      <text class="tool-icon">📥</text>
      <text class="tool-label">导出订单</text>
      <text class="tool-arrow">›</text>
    </view>
    <view class="tool-item" bindtap="onGoCustomers">
      <text class="tool-icon">👥</text>
      <text class="tool-label">客户管理</text>
      <text class="tool-arrow">›</text>
    </view>
    <view class="tool-item" bindtap="onGoProducts">
      <text class="tool-icon">📦</text>
      <text class="tool-label">产品管理</text>
      <text class="tool-arrow">›</text>
    </view>
    <view class="tool-item" bindtap="onSubscribeAdmin">
      <text class="tool-icon">🔔</text>
      <text class="tool-label">订阅通知</text>
      <text class="tool-arrow">›</text>
    </view>
</view>
```

同时把顶部栏里的按钮（仪表盘、导出、客户管理、产品管理、订阅通知）移到功能面板中，从 `admin-top-bar` 中删除。

将 `admin-top-bar` 简化为只保留角色标识和退出按钮：

```xml
<view class="admin-top-bar">
    <view class="top-left">
      <text class="role-badge role-{{role}}">{{isManager ? '厂长' : isDelivery ? '送货员' : '调货员'}}</text>
      <text class="logout-link" bindtap="onLogout">退出</text>
    </view>
</view>
```

对账单按钮改为单独一行：找到每个订单卡片底部 `share-bill-btn` 的位置，将其从 `footer-actions` 中移出，放在 `order-footer` 之后独立一行。

```xml
<!-- 对账单按钮 — 独立一行 -->
<view class="bill-row">
    <view class="share-bill-btn" data-order="{{item}}" catchtap="onShareBill">📋 对账单</view>
</view>
```

- [ ] **Step 4: 更新 orders.wxss**

批量替换颜色（同 Task 4 的 sed 命令）：
```bash
sed -i 's/#C0392B/var(--color-primary)/g' pages/admin/orders/orders.wxss
sed -i 's/#d32f2f/var(--color-primary)/g' pages/admin/orders/orders.wxss
sed -i 's/#A93226/var(--color-primary-dark)/g' pages/admin/orders/orders.wxss
```

添加工具面板样式：
```css
.tools-panel { padding: 16rpx 0; }
.tool-item {
  display: flex; align-items: center; padding: 24rpx 16rpx;
  background: #fff; border-radius: var(--radius-md); margin-bottom: 8rpx;
  box-shadow: var(--shadow-card);
}
.tool-icon { font-size: 40rpx; margin-right: 16rpx; }
.tool-label { flex: 1; font-size: var(--text-base); color: var(--color-text); }
.tool-arrow { font-size: 36rpx; color: var(--color-text-secondary); }

.bill-row {
  padding: 0 32rpx 24rpx;
  display: flex; justify-content: flex-end;
}
```

- [ ] **Step 5: 提交**

```bash
git add pages/admin/orders/orders.js pages/admin/orders/orders.wxml pages/admin/orders/orders.wxss
git commit -m "feat: add tools tab to admin orders, move bill button to separate row"
```

---

### Task 7: 后台产品管理 — 单列 + 配色

**Files:**
- Modify: `E:\miniprogram\pages\admin\products\products.wxss`
- Modify: `E:\miniprogram\pages\admin\dashboard\dashboard.wxss`
- Modify: `E:\miniprogram\pages\admin\customers\customers.wxss`

- [ ] **Step 1: 批量颜色替换**

```bash
for f in pages/admin/products/products.wxss pages/admin/dashboard/dashboard.wxss pages/admin/customers/customers.wxss; do
  sed -i 's/#C0392B/var(--color-primary)/g' "$f"
  sed -i 's/#d32f2f/var(--color-primary)/g' "$f"
  sed -i 's/#A93226/var(--color-primary-dark)/g' "$f"
  sed -i 's/#7F8C8D/var(--color-text-secondary)/g' "$f"
  echo "Updated $f"
done
```

- [ ] **Step 2: 产品管理页 WXML — 改为单列**

将 `E:\miniprogram\pages\admin\products\products.wxml` 中的产品列表改为单列布局。当前使用 `pa-item card` 的卡片样式。如果原本是双列 flex，改为单列 100% 宽度的卡片。

- [ ] **Step 3: 提交**

```bash
git add pages/admin/products/products.wxss pages/admin/products/products.wxml pages/admin/dashboard/dashboard.wxss pages/admin/customers/customers.wxss
git commit -m "style: restyle admin product/dashboard/customer pages"
```

---

## 自审检查清单

### 1. Spec 覆盖

| Spec 要求 | Task |
|---|---|
| 配色改为珊瑚红 #E8594B | Task 1 |
| 白底导航栏 | Task 2 |
| Tab 选中色 | Task 2 |
| 首页单列 + 虚拟列表 | Task 3 |
| 购物车/结算/订单/地址换配色 | Task 4 |
| 后台登录居中卡片 | Task 5 |
| 后台两栏 tab（订单 + 功能） | Task 6 |
| 对账单单独一行 | Task 6 |
| 产品管理单列 | Task 7 |
| 仪表盘/客户管理换配色 | Task 7 |
| 虚线/独立线条分隔样式 | Task 6（bill-row）|

### 2. 占位符扫描

无 TBD 或 TODO。

### 3. 类型一致性

- VirtualScroll 的 `itemHeight: 208` 对应单列卡片固定高度 200rpx + 8rpx margin
- 所有页面 CSS 变量名一致（`--color-primary`, `--shadow-card` 等）
