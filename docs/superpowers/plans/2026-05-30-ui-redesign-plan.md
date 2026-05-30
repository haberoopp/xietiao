# UI 重设计实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将温州斜条批发小程序的 UI 从传统红色升级为简洁商务风，所有功能逻辑保持不变。

**Architecture:** 全局设计 Token 定义在 `app.wxss`，页面 WXSS 引用全局变量并覆写局部颜色。WXML 中用文本符号替换 emoji 图标。11 个文件修改，分 10 个任务。

**Tech Stack:** 微信小程序原生框架（WXML + WXSS + JS）

---

### Task 1: 全局样式 Token 体系

**Files:**
- Modify: `miniprogram/app.wxss`（全文替换）

- [ ] **Step 1: 重写 app.wxss，定义 CSS 变量和全局基础样式**

```css
/* === 设计 Token === */
page {
  --color-primary: #C0392B;
  --color-primary-dark: #A93226;
  --color-primary-light: #FDF2F2;
  --color-warning: #E67E22;
  --color-success: #27AE60;
  --color-text: #1A1A1A;
  --color-text-secondary: #7F8C8D;
  --color-bg: #F5F6FA;
  --color-card: #FFFFFF;
  --color-border: #EEEEEE;

  --space-xs: 4rpx;
  --space-sm: 8rpx;
  --space-md: 16rpx;
  --space-lg: 24rpx;
  --space-xl: 32rpx;
  --space-2xl: 48rpx;

  --text-xs: 24rpx;
  --text-sm: 28rpx;
  --text-base: 32rpx;
  --text-lg: 36rpx;

  --shadow-card: 0 2rpx 12rpx rgba(0,0,0,0.06);
  --shadow-float: 0 4rpx 20rpx rgba(0,0,0,0.1);
  --shadow-modal: 0 -4rpx 24rpx rgba(0,0,0,0.12);

  --radius-sm: 6rpx;
  --radius-md: 8rpx;
  --radius-lg: 12rpx;
  --radius-full: 40rpx;

  --touch-min: 88rpx;

  background-color: var(--color-bg);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: var(--text-sm);
  color: var(--color-text);
}

/* 容器 */
.container {
  padding: var(--space-md);
  padding-bottom: 140rpx;
  min-height: 100vh;
  box-sizing: border-box;
}

/* 主按钮 */
.btn-primary {
  background-color: var(--color-primary);
  color: #fff;
  border-radius: var(--radius-md);
  font-size: 30rpx;
  padding: 20rpx 0;
  text-align: center;
  border: none;
  min-height: var(--touch-min);
  line-height: var(--touch-min);
}
.btn-primary:active {
  background-color: var(--color-primary-dark);
  opacity: 0.85;
}

/* 描边按钮 */
.btn-outline {
  background-color: #fff;
  color: var(--color-primary);
  border: 2rpx solid var(--color-primary);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  padding: 16rpx 30rpx;
  text-align: center;
  min-height: var(--touch-min);
  line-height: var(--touch-min);
  box-sizing: border-box;
}
.btn-outline:active {
  background-color: var(--color-primary-light);
}

/* 卡片 */
.card {
  background: var(--color-card);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  margin-bottom: var(--space-md);
  box-shadow: var(--shadow-card);
}

/* 表单 */
.form-group {
  margin-bottom: var(--space-md);
}

.form-label {
  display: block;
  font-size: var(--text-sm);
  color: var(--color-text);
  margin-bottom: var(--space-sm);
  font-weight: 500;
}

.form-input {
  width: 100%;
  height: var(--touch-min);
  background: var(--color-bg);
  border-radius: var(--radius-md);
  padding: 0 var(--space-md);
  font-size: var(--text-sm);
  box-sizing: border-box;
  border: 2rpx solid transparent;
}
.form-input:focus {
  border-color: var(--color-primary);
  background: #fff;
}

.form-textarea {
  width: 100%;
  min-height: 150rpx;
  background: var(--color-bg);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  font-size: var(--text-sm);
  box-sizing: border-box;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100rpx 0;
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
}
.empty-state image {
  width: 200rpx;
  height: 200rpx;
  margin-bottom: var(--space-md);
  opacity: 0.4;
}

/* 价格 */
.price {
  color: var(--color-primary);
  font-weight: bold;
  font-size: var(--text-base);
}
.price-symbol {
  font-size: 24rpx;
}

/* Badge */
.badge {
  display: inline-block;
  padding: 4rpx 12rpx;
  border-radius: var(--radius-sm);
  font-size: 22rpx;
  line-height: 1.5;
  color: #fff;
  flex-shrink: 0;
  white-space: nowrap;
}
.badge-pending { background-color: var(--color-warning); }
.badge-processing { background-color: #1976D2; }
.badge-completed { background-color: var(--color-success); }
.badge-cancelled { background-color: var(--color-text-secondary); }
```

- [ ] **Step 2: 提交**

```bash
git add miniprogram/app.wxss
git commit -m "feat: 全局设计 Token 体系——配色、间距、字体、阴影变量化"
```

---

### Task 2: 自定义 Tab 栏样式升级

**Files:**
- Modify: `miniprogram/custom-tab-bar/index.wxss`
- Modify: `miniprogram/custom-tab-bar/index.wxml`（emoji → 文本符号）

- [ ] **Step 1: 更新 tab 栏样式**

`miniprogram/custom-tab-bar/index.wxss`：

```css
.tab-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 100rpx;
  background: #fff;
  border-top: 1rpx solid var(--color-border);
  display: flex;
  align-items: center;
  padding-bottom: env(safe-area-inset-bottom);
  z-index: 999;
}

.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100rpx;
  position: relative;
}

.tab-icon {
  width: 44rpx;
  height: 44rpx;
  margin-bottom: 2rpx;
}

.tab-text {
  font-size: 20rpx;
  color: var(--color-text-secondary);
}

.tab-item.active .tab-text {
  color: var(--color-primary);
  font-weight: 500;
}
```

- [ ] **Step 2: WXML 中用 image 替换 emoji**

`miniprogram/custom-tab-bar/index.wxml`：将 `.tab-icon` 的 text 节点改为 `<image>` 引用 `/images/` 下的图标文件，并确保 images 目录有对应 png。

```
<!-- tab-icon 部分改为: -->
<image class="tab-icon" src="/images/{{item.iconPath}}" mode="aspectFit"/>
```

- [ ] **Step 3: 提交**

```bash
git add miniprogram/custom-tab-bar/
git commit -m "feat: 自定义 Tab 栏样式统一，emoji 替换为图标"
```

---

### Task 3: 首页——产品双列网格 + 悬浮购物车

**Files:**
- Modify: `miniprogram/pages/index/index.wxss`
- Modify: `miniprogram/pages/index/index.wxml`（emoji 替换 4 处）

- [ ] **Step 1: 重写 index.wxss**

```css
/* 换购模式提示栏 */
.exchange-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #FFF8E1;
  border: 1rpx solid #FFCC80;
  border-radius: var(--radius-md);
  padding: var(--space-md) var(--space-md);
  margin-bottom: var(--space-md);
}
.exb-info { display: flex; align-items: center; flex: 1; overflow: hidden; }
.exb-icon { font-size: 32rpx; flex-shrink: 0; margin-right: var(--space-sm); }
.exb-text { font-size: 24rpx; color: #E65100; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.exb-cancel {
  font-size: 24rpx; color: var(--color-text-secondary);
  padding: var(--space-sm) var(--space-md);
  border: 1rpx solid #ccc; border-radius: var(--radius-sm);
  flex-shrink: 0; margin-left: var(--space-sm);
}

/* 搜索栏 */
.search-bar { padding: var(--space-sm) 0 var(--space-md); }
.search-input-wrap {
  display: flex; align-items: center; background: #fff;
  border-radius: var(--radius-full); padding: var(--space-sm) var(--space-md);
  box-shadow: var(--shadow-card);
}
.search-icon { font-size: 28rpx; margin-right: var(--space-sm); color: var(--color-text-secondary); }
.search-input { flex: 1; height: 60rpx; font-size: 26rpx; }
.search-clear { font-size: 24rpx; color: #ccc; padding: var(--space-sm); margin-left: var(--space-sm); }
.search-info { font-size: 24rpx; color: var(--color-text-secondary); padding: 0 0 var(--space-sm); }

/* 分类 */
.category-bar { white-space: nowrap; padding: var(--space-md) 0; margin-bottom: var(--space-sm); }
.category-item {
  display: inline-block; padding: var(--space-sm) 28rpx; margin-right: var(--space-md);
  background: #fff; border-radius: 30rpx; font-size: 26rpx; color: var(--color-text-secondary);
}
.category-item.active { background: var(--color-primary); color: #fff; }

/* 产品双列网格 */
.product-list { display: flex; flex-wrap: wrap; justify-content: space-between; padding-bottom: 120rpx; }
.product-card {
  width: 48%; padding: 0; overflow: hidden;
  margin-bottom: var(--space-md);
  background: #fff; border-radius: var(--radius-md); box-shadow: var(--shadow-card);
}
.product-image { width: 100%; height: 340rpx; background: #E8E8E8; }
.product-info { padding: var(--space-md); }
.product-name {
  font-size: var(--text-sm); font-weight: 500;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.product-meta { font-size: 22rpx; color: var(--color-text-secondary); margin-top: var(--space-xs); }
.product-bottom {
  display: flex; align-items: center; justify-content: space-between;
  margin-top: var(--space-sm);
}
.product-bottom .price { font-size: var(--text-sm); }
.add-cart-btn {
  background: #fff; color: var(--color-primary);
  border: 2rpx solid var(--color-primary);
  font-size: 24rpx; padding: 6rpx 18rpx; border-radius: var(--radius-sm);
  min-width: 100rpx; min-height: 56rpx; text-align: center; line-height: 56rpx;
}
.add-cart-btn:active { background: var(--color-primary-light); }
.add-cart-out { background: #BDBDBD !important; color: #fff; border-color: #BDBDBD; }

.loading-hint { text-align: center; padding: 100rpx 0; color: var(--color-text-secondary); }

/* 数量弹窗 */
.modal-mask {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5); z-index: 1100;
  display: flex; align-items: center; justify-content: center;
}
.qty-modal {
  background: #fff; border-radius: var(--radius-lg); width: 560rpx; padding: 40rpx; text-align: center;
}
.qty-modal-title { font-size: 34rpx; font-weight: bold; margin-bottom: var(--space-sm); }
.qty-modal-product { font-size: var(--text-sm); color: var(--color-text); margin-bottom: var(--space-xs); }
.qty-modal-price { font-size: 26rpx; color: var(--color-primary); margin-bottom: 30rpx; }
.qty-input-row { display: flex; align-items: center; justify-content: center; gap: var(--space-md); margin-bottom: 36rpx; }
.qty-minus, .qty-plus {
  width: var(--touch-min); height: var(--touch-min); line-height: var(--touch-min);
  background: #F0F0F0; border-radius: var(--radius-sm); font-size: 36rpx; color: var(--color-text);
}
.qty-minus:active, .qty-plus:active { background: #E0E0E0; }
.qty-input {
  width: 160rpx; height: 80rpx;
  border: 2rpx solid var(--color-primary); border-radius: var(--radius-md);
  text-align: center; font-size: 36rpx; font-weight: bold;
}
.qty-modal-btns { display: flex; gap: var(--space-md); }
.qty-cancel { flex: 1; }
.qty-confirm { flex: 2; }

/* 悬浮购物车 */
.cart-float {
  position: fixed; bottom: calc(120rpx + env(safe-area-inset-bottom)); left: 0; right: 0;
  z-index: 1000; display: flex; flex-direction: column;
  box-shadow: var(--shadow-modal);
}
.cart-float--open { max-height: 55vh; }
.cart-float-list {
  overflow-y: auto; flex: 1; padding: 0 var(--space-lg);
  background: #fff; border-radius: 20rpx 20rpx 0 0;
}
.cart-float-item {
  display: flex; align-items: center; padding: 18rpx 0;
  border-bottom: 1rpx solid #F5F5F5; position: relative;
}
.cfi-image { width: var(--touch-min); height: var(--touch-min); border-radius: var(--radius-md); background: #F5F5F5; flex-shrink: 0; }
.cfi-info { flex: 1; margin-left: var(--space-md); overflow: hidden; }
.cfi-name { font-size: 26rpx; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cfi-price { font-size: 24rpx; color: var(--color-primary); margin-top: var(--space-xs); }
.cfi-qty-ctrl { display: flex; align-items: center; gap: 4rpx; margin-right: 24rpx; }
.cfi-qty-btn {
  width: var(--touch-min); height: var(--touch-min); line-height: var(--touch-min);
  text-align: center; background: #F5F5F5; border-radius: var(--radius-md); font-size: 28rpx; color: var(--color-text);
}
.cfi-qty-input { width: 72rpx; height: 44rpx; border: 1rpx solid #E8E8E8; border-radius: var(--radius-md); text-align: center; font-size: 24rpx; }
.cfi-del {
  position: absolute; top: 16rpx; right: 4rpx;
  width: 56rpx; height: 56rpx; line-height: 56rpx; text-align: center;
  font-size: 28rpx; color: #ccc; border-radius: 50%;
}
.cfi-del:active { background: #FFF2F2; color: var(--color-primary); }

/* 底部栏 */
.cart-float-bar {
  flex-shrink: 0; display: flex; align-items: center; justify-content: space-between;
  padding: var(--space-md) var(--space-lg); background: #fff; border-top: 1rpx solid #F0F0F0;
}
.cfb-left { display: flex; align-items: center; gap: var(--space-md); }
.cfb-icon-wrap { position: relative; width: 80rpx; height: 80rpx; display: flex; align-items: center; justify-content: center; }
.cfb-icon-bg {
  position: absolute; inset: 0;
  background: var(--color-primary); border-radius: 50%;
  box-shadow: 0 4rpx 12rpx rgba(192,57,43,0.25);
}
.cfb-icon-text { position: relative; z-index: 1; font-size: 40rpx; }
.cfb-count {
  position: absolute; top: -2rpx; right: -4rpx; z-index: 2;
  min-width: 34rpx; height: 34rpx; line-height: 34rpx; text-align: center;
  font-size: 20rpx; font-weight: bold; color: #fff;
  background: #FF3D00; border: 3rpx solid #fff; border-radius: 17rpx;
  padding: 0 8rpx; box-sizing: border-box;
}
.cfb-total { font-size: var(--text-base); font-weight: bold; color: var(--color-primary-dark); }
.cfb-right { display: flex; align-items: center; }
.cfb-checkout-btn {
  background: var(--color-primary); color: #fff;
  font-size: 26rpx; font-weight: 500; padding: 14rpx 40rpx;
  border-radius: 36rpx; border: none;
}
.cfb-checkout-btn:active { opacity: 0.85; }
.cfb-exchange-btn {
  background: var(--color-warning); color: #fff;
  font-size: 26rpx; font-weight: 500; padding: 14rpx 32rpx;
  border-radius: 36rpx;
}
.cfb-exchange-btn:active { opacity: 0.85; }

/* 缺货 */
.product-out { opacity: 0.45; }
.img-out { filter: grayscale(60%); }
```

- [ ] **Step 2: WXML 替换 emoji**

替换 4 处：
1. `🔄` → `↻`（换购图标）
2. `🔍` → `⌕`（搜索图标）
3. `✕` → `×`（清除按钮，保持）
4. `🛒` → `●`（购物车图标，配合圆底）

- [ ] **Step 3: 提交**

```bash
git add miniprogram/pages/index/
git commit -m "feat: 首页双列网格+悬浮购物车样式升级，emoji替换"
```

---

### Task 4: 购物车页样式升级

**Files:**
- Modify: `miniprogram/pages/cart/cart.wxss`

- [ ] **Step 1: 重写 cart.wxss**

```css
.select-all-bar { display: flex; padding: var(--space-md) 0; }
.check-all { display: flex; align-items: center; gap: var(--space-sm); font-size: var(--text-sm); color: var(--color-text); }

.checkbox {
  width: 40rpx; height: 40rpx;
  border: 3rpx solid #ccc; border-radius: 50%;
  box-sizing: border-box;
}
.checkbox.checked { background: var(--color-primary); border-color: var(--color-primary); }

.cart-item {
  display: flex; align-items: center;
  background: #fff; border-radius: var(--radius-md);
  padding: var(--space-md); margin-bottom: var(--space-md);
  box-shadow: var(--shadow-card);
}
.check-btn { margin-right: var(--space-md); }
.item-image { width: 120rpx; height: 120rpx; border-radius: var(--radius-md); background: #E8E8E8; flex-shrink: 0; }
.item-right { flex: 1; margin-left: var(--space-md); overflow: hidden; }
.item-name { font-size: var(--text-sm); font-weight: 500; margin-bottom: var(--space-xs); }
.item-unit { font-size: 22rpx; color: var(--color-text-secondary); margin-bottom: var(--space-sm); }
.item-bottom { display: flex; align-items: center; justify-content: space-between; }
.item-bottom .price { font-size: var(--text-sm); }

.qty-control { display: flex; align-items: center; gap: var(--space-sm); }
.qty-btn {
  width: var(--touch-min); height: var(--touch-min); line-height: var(--touch-min);
  text-align: center; background: #F0F0F0; border-radius: var(--radius-sm);
  font-size: var(--text-sm); color: var(--color-text);
}
.qty-input {
  width: 80rpx; height: 48rpx;
  border: 1rpx solid #E0E0E0; border-radius: var(--radius-sm);
  text-align: center; font-size: 26rpx;
}

.delete-btn {
  width: 56rpx; height: 56rpx; line-height: 56rpx;
  text-align: center; font-size: 32rpx; color: #ccc;
  flex-shrink: 0; margin-left: var(--space-sm);
}

.checkout-bar {
  position: fixed; bottom: calc(100rpx + env(safe-area-inset-bottom)); left: 0; right: 0;
  display: flex; align-items: center; justify-content: space-between;
  padding: var(--space-md) var(--space-lg);
  background: #fff; border-top: 1rpx solid var(--color-border);
  box-shadow: var(--shadow-modal);
}
.total-text { font-size: var(--text-base); }
.total-text .price { font-size: var(--text-lg); }
.checkout-btn {
  padding: 14rpx 48rpx; border-radius: 36rpx; font-size: 28rpx;
}

.go-shopping { margin-top: var(--space-md); color: var(--color-primary); font-size: var(--text-sm); }
```

- [ ] **Step 2: 提交**

```bash
git add miniprogram/pages/cart/
git commit -m "feat: 购物车页样式统一，大触摸目标"
```

---

### Task 5: 结算页样式升级

**Files:**
- Modify: `miniprogram/pages/checkout/checkout.wxss`
- Modify: `miniprogram/pages/checkout/checkout.wxml`（emoji 替换）

- [ ] **Step 1: 重写 checkout.wxss**

```css
.section-title { font-size: 30rpx; font-weight: bold; padding: var(--space-md) 0 var(--space-sm); }

.addr-section-card { padding: var(--space-sm) var(--space-md); }
.add-addr-row { display: flex; align-items: center; padding: var(--space-lg) 0; border-bottom: 1rpx solid #F0F0F0; margin-bottom: var(--space-md); }
.add-addr-icon {
  width: 48rpx; height: 48rpx; line-height: 44rpx; text-align: center;
  font-size: 36rpx; color: var(--color-text-secondary);
  border: 2rpx solid #ccc; border-radius: 50%; margin-right: var(--space-md); flex-shrink: 0;
}
.add-addr-text { flex: 1; font-size: var(--text-sm); color: var(--color-text-secondary); }
.add-addr-arrow { font-size: 40rpx; color: #ccc; flex-shrink: 0; }

.addr-compact { padding: var(--space-md) 0 var(--space-md); border-bottom: 1rpx solid #F0F0F0; margin-bottom: var(--space-md); }
.addr-compact-line { font-size: var(--text-sm); color: var(--color-text); font-weight: 500; }
.addr-compact-addr { font-size: 24rpx; color: var(--color-text-secondary); margin-top: var(--space-xs); }

.address-picker {
  display: flex; align-items: center; justify-content: space-between;
  padding: var(--space-md) var(--space-lg); margin-bottom: var(--space-md);
  background: #FDF8E1; border: 2rpx dashed #E67E22;
  border-radius: var(--radius-md);
}
.picker-left { flex: 1; overflow: hidden; }
.picker-label { font-size: 26rpx; color: #E67E22; margin-bottom: var(--space-xs); }
.picker-preview { font-size: var(--text-sm); }
.preview-name { font-weight: 500; }
.preview-phone { color: var(--color-text-secondary); }
.picker-hint { font-size: 26rpx; color: var(--color-text-secondary); }
.picker-arrow { font-size: 40rpx; color: #ccc; flex-shrink: 0; margin-left: var(--space-md); }

.save-addr-row { display: flex; align-items: center; padding: var(--space-md) 0 0; font-size: 26rpx; color: var(--color-text-secondary); }
.checkbox {
  width: 40rpx; height: 40rpx; border: 3rpx solid #ccc; border-radius: 50%;
  margin-right: var(--space-sm); box-sizing: border-box;
}
.checkbox.checked { background: var(--color-primary); border-color: var(--color-primary); }

.order-item {
  display: flex; align-items: center; padding: var(--space-md) 0;
  border-bottom: 1rpx solid #F0F0F0; position: relative;
}
.oi-del {
  position: absolute; top: 8rpx; right: 0;
  width: 56rpx; height: 56rpx; line-height: 54rpx; text-align: center;
  font-size: 24rpx; color: var(--color-text-secondary);
  border: 1rpx solid #DDD; border-radius: 50%; z-index: 1;
}
.order-item:last-child { border-bottom: none; }
.oi-image { width: 100rpx; height: 100rpx; border-radius: var(--radius-md); background: #E8E8E8; flex-shrink: 0; }
.oi-info { flex: 1; margin-left: var(--space-md); overflow: hidden; }
.oi-name { font-size: var(--text-sm); }
.oi-meta { font-size: 24rpx; color: var(--color-text-secondary); margin-top: var(--space-xs); }
.oi-qty-ctrl { display: flex; align-items: center; gap: var(--space-sm); margin-top: var(--space-sm); }
.qty-btn {
  width: var(--touch-min); height: var(--touch-min); line-height: var(--touch-min);
  text-align: center; font-size: var(--text-sm); color: var(--color-text);
  background: #F0F0F0; border-radius: var(--radius-sm);
}
.qty-input { width: 80rpx; height: 48rpx; border: 1rpx solid #E0E0E0; border-radius: var(--radius-sm); text-align: center; font-size: 26rpx; }
.oi-subtotal { font-size: var(--text-sm); color: var(--color-text); flex-shrink: 0; }

.add-product-row {
  display: flex; align-items: center; justify-content: center;
  padding: var(--space-md) 0; margin-top: var(--space-sm);
  border: 2rpx dashed var(--color-primary); border-radius: var(--radius-md);
  font-size: 26rpx; color: var(--color-primary);
}
.add-product-row:active { background: var(--color-primary-light); }
.add-product-icon { font-size: var(--text-base); margin-right: var(--space-sm); font-weight: bold; }

.total-line {
  display: flex; justify-content: flex-end; align-items: center;
  padding-top: var(--space-md); font-size: var(--text-base);
  border-top: 1rpx solid #F0F0F0; gap: var(--space-md);
}

.delivery-card { padding: var(--space-sm) var(--space-md); }
.delivery-options { display: flex; gap: var(--space-md); }
.delivery-option {
  flex: 1; display: flex; flex-direction: column; align-items: center;
  padding: var(--space-lg) 0;
  border: 2rpx solid var(--color-border); border-radius: var(--radius-md);
}
.delivery-option.active { border-color: var(--color-primary); background: var(--color-primary-light); }
.do-icon { font-size: 44rpx; margin-bottom: var(--space-sm); color: var(--color-text-secondary); }
.do-label { font-size: 26rpx; color: var(--color-text); }
.delivery-option.active .do-icon { color: var(--color-primary); }
.delivery-option.active .do-label { color: var(--color-primary); font-weight: 600; }

.logistics-warn {
  margin-top: var(--space-md); padding: var(--space-sm) var(--space-md);
  background: #FFF3E0; border-radius: var(--radius-md);
  font-size: 24rpx; color: #E65100;
}
.pickup-hint {
  margin-top: var(--space-md); padding: var(--space-sm) var(--space-md);
  background: #F0F7FF; border-radius: var(--radius-md);
  font-size: 24rpx; color: #1976D2;
}

.submit-btn { margin: var(--space-xl) 0; width: 100%; }

.addr-search-box {
  padding: var(--space-md) var(--space-lg);
  background: var(--color-bg); border-radius: var(--radius-md);
  min-height: 50rpx; display: flex; align-items: center;
}
.addr-search-placeholder { display: flex; align-items: center; gap: var(--space-sm); font-size: 26rpx; color: var(--color-text-secondary); }
.addr-search-icon { font-size: 30rpx; }

.matched-customer { margin-top: var(--space-sm); display: flex; align-items: center; gap: var(--space-sm); font-size: 24rpx; color: var(--color-primary); }
.matched-discount { background: var(--color-primary); color: #fff; padding: 2rpx 10rpx; border-radius: var(--radius-sm); font-size: 22rpx; }

.original-price { text-decoration: line-through; color: var(--color-text-secondary); margin-right: var(--space-sm); }
.discount-note { font-size: 24rpx; color: var(--color-primary); background: var(--color-primary-light); padding: 4rpx 12rpx; border-radius: var(--radius-sm); }
```

- [ ] **Step 2: WXML 替换 emoji**

替换：`🏪`→`📍`、`🛵`→`🚲`、`🚚`→`📦`、`⚠️`→`!`、`📍`保持、`🎗`→`★`

- [ ] **Step 3: 提交**

```bash
git add miniprogram/pages/checkout/
git commit -m "feat: 结算页样式升级，配送方式图标替换"
```

---

### Task 6: 订单页样式升级

**Files:**
- Modify: `miniprogram/pages/orders/orders.wxss`
- Modify: `miniprogram/pages/orders/orders.wxml`（退换弹窗 emoji 替换）

- [ ] **Step 1: 更新 orders.wxss 中所有颜色值为 Token**

所有 `#d32f2f` → 引用 var(--color-primary)，但从 app.wxss 继承不到 CSS 变量（小程序限制），用十六进制直接替换：
- `#d32f2f` → `#C0392B`
- `#b71c1c` → `#A93226`
- `#ff9800` → `#E67E22`
- `#4caf50` → `#27AE60`

同时更新样式（关键调整）：

```css
.go-shopping { margin-top: var(--space-md); color: #C0392B; font-size: var(--text-sm); }

.order-card { padding: var(--space-md); background: #fff; border-radius: var(--radius-md); box-shadow: var(--shadow-card); }

.order-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-md); }
.header-badges { display: flex; align-items: center; gap: var(--space-sm); }
.header-right { display: flex; align-items: center; gap: var(--space-sm); }
.order-time { font-size: 24rpx; color: var(--color-text-secondary); }

.badge-return-pending { background: #E67E22; }
.badge-return-approved { background: #1976D2; }
.badge-return-rejected { background: #9E9E9E; }
.badge-return-completed { background: #27AE60; }

.return-reason { font-size: 24rpx; color: #E65100; background: #FFF3E0; padding: var(--space-sm) var(--space-md); border-radius: var(--radius-sm); margin-bottom: var(--space-sm); }

.order-products { background: #FAFAFA; border-radius: var(--radius-sm); padding: var(--space-sm) var(--space-md); margin-bottom: var(--space-md); }
.op-item { display: flex; justify-content: space-between; padding: 4rpx 0; font-size: 26rpx; }
.op-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.op-qty { color: var(--color-text-secondary); flex-shrink: 0; margin-left: var(--space-md); }

.order-customer { font-size: 26rpx; color: var(--color-text-secondary); margin-bottom: 4rpx; }
.order-address { font-size: 24rpx; color: var(--color-text-secondary); margin-bottom: 4rpx; }
.order-delivery { font-size: 24rpx; color: #C0392B; margin-bottom: var(--space-sm); }

.order-images { display: flex; flex-wrap: wrap; gap: var(--space-sm); margin-bottom: var(--space-md); }
.oi-thumb { width: 140rpx; height: 140rpx; border-radius: var(--radius-md); background: #E8E8E8; flex-shrink: 0; }

.order-footer { display: flex; justify-content: space-between; align-items: center; border-top: 1rpx solid #F0F0F0; padding-top: var(--space-md); }
.order-total { font-size: 30rpx; }

.footer-actions { display: flex; align-items: center; gap: var(--space-sm); flex-wrap: wrap; justify-content: flex-end; }

.copy-btn { font-size: 24rpx; color: #C0392B; border: 1rpx solid #C0392B; padding: 8rpx 16rpx; border-radius: var(--radius-sm); min-height: 56rpx; line-height: 40rpx; }
.cancel-btn { font-size: 24rpx; color: var(--color-text-secondary); border: 1rpx solid #CCC; padding: 8rpx 16rpx; border-radius: var(--radius-sm); min-height: 56rpx; line-height: 40rpx; }
.return-btn { font-size: 24rpx; color: #E67E22; border: 1rpx solid #E67E22; padding: 8rpx 16rpx; border-radius: var(--radius-sm); min-height: 56rpx; line-height: 40rpx; }
.rebuy-btn { font-size: 24rpx; color: #fff; background: #C0392B; padding: 8rpx 16rpx; border-radius: var(--radius-sm); min-height: 56rpx; line-height: 40rpx; }
.edit-order-btn { font-size: 24rpx; color: #C0392B; border: 1rpx solid #C0392B; padding: 8rpx 16rpx; border-radius: var(--radius-sm); min-height: 56rpx; line-height: 40rpx; }

.bottom-links { display: flex; justify-content: center; gap: 40rpx; padding: var(--space-xl) 0; }
.bottom-link { font-size: 24rpx; color: #CCC; padding: var(--space-sm); }
.admin-link { color: #DDD; }

/* 退换货弹窗 */
.modal-mask { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: flex-end; }
.modal-content { background: #fff; border-radius: 20rpx 20rpx 0 0; width: 100%; max-height: 85vh; overflow-y: auto; padding: var(--space-xl); padding-bottom: env(safe-area-inset-bottom); box-sizing: border-box; }
.modal-title { font-size: 34rpx; font-weight: bold; text-align: center; margin-bottom: var(--space-xl); }
.modal-btns { display: flex; gap: var(--space-md); margin-top: var(--space-xl); }
.modal-cancel { flex: 1; }
.modal-save { flex: 1; }

.return-type-select { display: flex; gap: var(--space-md); margin-bottom: var(--space-lg); }
.type-option { flex: 1; display: flex; flex-direction: column; align-items: center; padding: var(--space-xl) 0; border: 2rpx solid var(--color-border); border-radius: var(--radius-md); }
.type-option.active { border-color: #C0392B; background: var(--color-primary-light); }
.type-icon { font-size: 48rpx; margin-bottom: var(--space-sm); }
.type-label { font-size: 26rpx; color: var(--color-text); }
.type-option.active .type-label { color: #C0392B; font-weight: 600; }

.return-items-section { max-height: 400rpx; overflow-y: auto; margin-bottom: var(--space-md); }
.return-item { display: flex; align-items: center; padding: var(--space-md) 0; border-bottom: 1rpx solid #F5F5F5; }
.ri-check { width: 40rpx; height: 40rpx; border: 3rpx solid #CCC; border-radius: 50%; flex-shrink: 0; margin-right: var(--space-md); box-sizing: border-box; }
.ri-check.checked { background: #C0392B; border-color: #C0392B; }
.ri-info { flex: 1; overflow: hidden; }
.ri-name { font-size: 26rpx; }
.ri-meta { font-size: 22rpx; color: var(--color-text-secondary); margin-top: 2rpx; }
.ri-qty-ctrl { display: flex; align-items: center; gap: var(--space-xs); margin-left: var(--space-sm); flex-shrink: 0; }
.qty-btn-sm { width: 56rpx; height: 56rpx; line-height: 56rpx; text-align: center; font-size: 24rpx; color: var(--color-text); background: #F0F0F0; border-radius: var(--radius-sm); }
.qty-input-sm { width: 60rpx; height: 40rpx; border: 1rpx solid #E0E0E0; border-radius: var(--radius-sm); text-align: center; font-size: 24rpx; }
.ri-empty { font-size: 24rpx; color: var(--color-text-secondary); text-align: center; padding: var(--space-md) 0; }

.ex-shop-btn { width: 100%; margin-top: var(--space-sm); border: 2rpx dashed #C0392B; color: #C0392B; font-size: var(--text-sm); padding: var(--space-md) 0; text-align: center; border-radius: var(--radius-md); background: var(--color-primary-light); }

.exchange-items { background: #FAFAFA; border-radius: var(--radius-md); padding: var(--space-md); margin-bottom: var(--space-sm); }
.ex-item { display: flex; align-items: center; padding: var(--space-sm) 0; border-bottom: 1rpx solid #F0F0F0; }
.ex-item:last-child { border-bottom: none; }
.ex-item-img { width: 64rpx; height: 64rpx; border-radius: var(--radius-sm); background: #E8E8E8; flex-shrink: 0; }
.ex-item-info { flex: 1; margin-left: var(--space-sm); overflow: hidden; }
.ex-item-name { font-size: 26rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ex-item-price { font-size: 22rpx; color: var(--color-text-secondary); margin-top: 2rpx; }
.ex-item-subtotal { font-size: 26rpx; font-weight: 500; color: #C0392B; flex-shrink: 0; margin-left: var(--space-sm); }

.ex-summary { margin-top: var(--space-md); padding-top: var(--space-md); border-top: 2rpx solid #E0E0E0; }
.ex-summary-row { display: flex; justify-content: space-between; font-size: 24rpx; color: var(--color-text-secondary); padding: 4rpx 0; }
.ex-amount.minus { color: #27AE60; }
.ex-amount.plus { color: #C0392B; }
.ex-diff { font-size: var(--text-sm); font-weight: bold; color: var(--color-text); margin-top: var(--space-sm); padding-top: var(--space-sm); border-top: 1rpx solid #E0E0E0; }
.ex-diff-amount { color: #E67E22; }
```

- [ ] **Step 2: WXML 替换 emoji**

`📦`→`□`、`🔄`→`↻`

- [ ] **Step 3: 提交**

```bash
git add miniprogram/pages/orders/
git commit -m "feat: 订单页样式统一，颜色全部替换为柔和红"
```

---

### Task 7: 地址管理页 + 后台登录页样式升级

**Files:**
- Modify: `miniprogram/pages/address/address.wxss`
- Modify: `miniprogram/pages/admin/login/login.wxss`
- Modify: `miniprogram/pages/admin/login/login.wxml`（如有 emoji）

- [ ] **Step 1: 更新 address.wxss**

该页使用 `.card`、`.form-*`、`.btn-*` 等全局类，主要替换专属颜色：

```css
/* 地址卡片 */
.addr-item { padding: var(--space-md); background: #fff; border-radius: var(--radius-md); box-shadow: var(--shadow-card); margin-bottom: var(--space-md); }
.addr-name { font-size: var(--text-base); font-weight: 500; }
.addr-phone { font-size: var(--text-sm); color: var(--color-text-secondary); }
.addr-detail { font-size: var(--text-sm); color: var(--color-text); margin-top: var(--space-xs); }
.addr-default-tag { background: var(--color-primary-light); color: #C0392B; font-size: 22rpx; padding: 2rpx 10rpx; border-radius: var(--radius-sm); }

/* 新增地址按钮 */
.add-addr-btn {
  width: 100%; padding: var(--space-md) 0;
  border: 2rpx dashed #C0392B; border-radius: var(--radius-md);
  text-align: center; font-size: var(--text-sm); color: #C0392B;
  background: #fff;
}

/* 删除按钮 */
.del-btn { color: #C0392B; font-size: 24rpx; padding: var(--space-sm); }
```

- [ ] **Step 2: 更新 login.wxss**

```css
.login-container {
  display: flex; flex-direction: column; align-items: center;
  padding-top: 120rpx;
}
.login-title { font-size: var(--text-lg); font-weight: 600; margin-bottom: var(--space-xs); }
.login-subtitle { font-size: var(--text-sm); color: var(--color-text-secondary); margin-bottom: var(--space-2xl); }
.login-card {
  width: 85%; padding: var(--space-xl); background: #fff;
  border-radius: var(--radius-md); box-shadow: var(--shadow-card);
}
.login-input {
  width: 100%; height: var(--touch-min);
  border: 2rpx solid var(--color-border); border-radius: var(--radius-md);
  padding: 0 var(--space-md); font-size: var(--text-base); box-sizing: border-box;
}
.login-input:focus { border-color: #C0392B; }
.login-btn {
  width: 100%; margin-top: var(--space-xl); background: #C0392B; color: #fff;
  border-radius: var(--radius-md); font-size: var(--text-base);
  padding: var(--space-md) 0; text-align: center; border: none;
}
.login-btn:active { background: #A93226; opacity: 0.85; }
```

- [ ] **Step 3: 提交**

```bash
git add miniprogram/pages/address/ miniprogram/pages/admin/login/
git commit -m "feat: 地址页+登录页样式统一"
```

---

### Task 8: 后台管理三页样式升级

**Files:**
- Modify: `miniprogram/pages/admin/orders/orders.wxss`
- Modify: `miniprogram/pages/admin/products/products.wxss`
- Modify: `miniprogram/pages/admin/customers/customers.wxss`

后台管理页面主要依赖 `.card`、`.form-*`、`.btn-*`、`.badge-*` 全局类，WXSS 文件中只需替换所有遗留颜色值：

- [ ] **Step 1: 全局替换后台页面颜色**

三个文件中做以下替换：
- `#d32f2f` → `#C0392B`
- `#b71c1c` → `#A93226`
- `#ff9800` → `#E67E22`
- `#4caf50` → `#27AE60`
- `#9e9e9e` → `#7F8C8D`

所有后台订单页操作按钮统一用 `.btn-outline` / `.btn-primary` 全局类，移除内联颜色声明。

- [ ] **Step 2: 提交**

```bash
git add miniprogram/pages/admin/orders/ miniprogram/pages/admin/products/ miniprogram/pages/admin/customers/
git commit -m "feat: 后台管理三页颜色替换为设计 Token"
```

---

### Task 9: 仪表盘样式升级

**Files:**
- Modify: `miniprogram/pages/admin/dashboard/dashboard.wxss`

- [ ] **Step 1: 重写 dashboard.wxss**

```css
.dashboard { padding: var(--space-md); }
.date-tabs { display: flex; gap: var(--space-sm); margin-bottom: var(--space-md); }
.date-tab {
  flex: 1; text-align: center; padding: var(--space-sm) 0;
  background: #fff; border-radius: var(--radius-md); font-size: var(--text-sm);
  color: var(--color-text-secondary);
}
.date-tab.active { background: #C0392B; color: #fff; }

/* 指标卡 */
.metrics { display: flex; flex-wrap: wrap; gap: var(--space-md); margin-bottom: var(--space-lg); }
.metric-card {
  width: calc(50% - 8rpx); padding: var(--space-md);
  background: #fff; border-radius: var(--radius-md); box-shadow: var(--shadow-card);
}
.metric-value { font-size: var(--text-lg); font-weight: bold; color: var(--color-text); }
.metric-label { font-size: 24rpx; color: var(--color-text-secondary); margin-top: var(--space-xs); }
.metric-card.warning .metric-value { color: #E67E22; }
.metric-card.danger .metric-value { color: #C0392B; }

/* 趋势图 */
.trend-section { background: #fff; border-radius: var(--radius-md); padding: var(--space-md); margin-bottom: var(--space-lg); box-shadow: var(--shadow-card); }
.trend-title { font-size: var(--text-sm); font-weight: 600; margin-bottom: var(--space-md); }
.trend-chart { display: flex; align-items: flex-end; gap: var(--space-sm); height: 200rpx; }
.trend-bar-wrap { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; }
.trend-bar { width: 100%; max-width: 48rpx; background: #C0392B; border-radius: var(--radius-sm) var(--radius-sm) 0 0; min-height: 4rpx; }
.trend-label { font-size: 20rpx; color: var(--color-text-secondary); margin-top: var(--space-xs); }
.trend-value { font-size: 20rpx; color: var(--color-text); font-weight: 500; }

/* 排行列表 */
.rank-section { background: #fff; border-radius: var(--radius-md); padding: var(--space-md); margin-bottom: var(--space-lg); box-shadow: var(--shadow-card); }
.rank-title { font-size: var(--text-sm); font-weight: 600; margin-bottom: var(--space-md); }
.rank-item { display: flex; align-items: center; padding: var(--space-sm) 0; border-bottom: 1rpx solid #F5F5F5; }
.rank-item:last-child { border-bottom: none; }
.rank-num { width: 40rpx; font-size: 24rpx; font-weight: bold; color: var(--color-text-secondary); flex-shrink: 0; }
.rank-num.top3 { color: #C0392B; }
.rank-info { flex: 1; overflow: hidden; }
.rank-name { font-size: 26rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rank-sub { font-size: 22rpx; color: var(--color-text-secondary); }
.rank-value { font-size: 26rpx; font-weight: 500; color: var(--color-text); flex-shrink: 0; margin-left: var(--space-sm); }
.rank-bar-bg { height: 8rpx; background: #F0F0F0; border-radius: 4rpx; margin-top: var(--space-xs); }
.rank-bar-fill { height: 100%; background: #C0392B; border-radius: 4rpx; }

/* 缺货预警 */
.shortage-item { display: flex; align-items: center; padding: var(--space-sm) 0; border-bottom: 1rpx solid #F5F5F5; }
.shortage-status { font-size: 22rpx; padding: 2rpx 10rpx; border-radius: var(--radius-sm); margin-right: var(--space-sm); flex-shrink: 0; }
.shortage-status.out { background: #FDEDEC; color: #C0392B; }
.shortage-status.low { background: #FEF5E7; color: #E67E22; }
.shortage-name { flex: 1; font-size: 26rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.shortage-days { font-size: 22rpx; color: var(--color-text-secondary); flex-shrink: 0; }
```

- [ ] **Step 2: 提交**

```bash
git add miniprogram/pages/admin/dashboard/
git commit -m "feat: 仪表盘样式升级，使用柔和红+卡片统一"
```

---

### Task 10: 全局 WXML emoji 清理 + 最终验证

**Files:**
- Scan: 所有 `pages/**/*.wxml`、`custom-tab-bar/*.wxml`

- [ ] **Step 1: 搜索残留 emoji**

```bash
grep -rn "[🔄📦🛒🔍✕🏪🛵🚚⚠️📍🎗]" miniprogram/pages/ miniprogram/custom-tab-bar/
```

对任何残留 emoji，替换为文本符号或移除。

- [ ] **Step 2: 全局颜色验证**

```bash
grep -rn "d32f2f\|b71c1c" miniprogram/pages/ miniprogram/custom-tab-bar/
```

确保无残留旧颜色值，输出应为空。

- [ ] **Step 3: 微信开发者工具中预览所有页面**

打开微信开发者工具，遍历所有页面确认：
- 首页产品卡双列网格正常显示，悬浮购物车正常
- 购物车页全选、数量调整可用
- 结算页地址选择、配送方式、商品清单正常
- 订单页卡片、退换货弹窗正常
- 后台管理各页样式一致

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "feat: 全局 emoji 清理，UI 重设计完成"
```
