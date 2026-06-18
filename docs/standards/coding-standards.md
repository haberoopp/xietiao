# 代码风格规范

## 语言与运行时

| 层 | 语言 | 运行时 | 模块系统 |
|---|------|--------|---------|
| 小程序前端 | JavaScript ES6+ | 微信小程序 AppService | CommonJS (`require`/`module.exports`) |
| 云函数 | JavaScript ES6+ | Node.js 18.15 | CommonJS |

**禁止使用**：TypeScript（当前未配置编译链）、ES Module（`import`/`export`）、`async/await` 之外的 Generator。

## 变量声明

- **强制 `const`**：所有不会重新赋值的变量。
- **允许 `let`**：需要重新赋值时（循环计数器、累加器）。
- **禁止 `var`**：已全域清理，仅 `notify.js`（历史遗留）除外。新代码不允许。

```js
// ✅ 正确
const app = getApp();
const items = this.data.cartItems.filter(item => item.checked);
let total = 0;
for (let i = 0; i < items.length; i++) { total += items[i].price; }

// ❌ 错误
var app = getApp();
var total = 0;
```

## 命名约定

| 元素 | 风格 | 示例 |
|------|------|------|
| 文件名 | kebab-case | `admin-update-order-status/`、`demoStore.js` |
| 云函数目录 | camelCase | `submitOrder/`、`getMyOrders/` |
| 页面目录 | kebab-case 或短名 | `admin/orders/`、`checkout/` |
| 函数/方法 | camelCase | `loadProducts()`、`onToggleCheck()` |
| 变量 | camelCase | `cartItems`、`searchKeyword` |
| 常量 | UPPER_SNAKE_CASE | `PRODUCT_CATEGORIES`、`NOTIFY_TEMPLATES` |
| 数据库集合 | camelCase 复数 | `products`、`returnRequests` |
| 数据库字段 | camelCase | `createdAt`、`totalAmount`、`_openid` |
| 事件处理函数 | `on` + PascalCase 动作 | `onSubmit()`、`onToggleCheck()`、`onSearchInput()` |
| 私有辅助方法 | camelCase | `calcTotal()`、`formatItems()`、`filterProducts()` |
| WXML data 属性 | camelCase | `data-product-id="{{item._id}}"` |

## 函数复杂度上限

- 单个函数不超过 **60 行**（不含注释和空行）。
- 如果超出，拆分为多个小函数。
- 已存在的超长函数（如 `checkout.js onLoad` ~80行）不强制重构，但新代码必须遵守。

## 注释规范

```js
/**
 * 多行注释：描述功能、参数、返回值
 * @param {string} phone - 客户手机号
 * @returns {Promise<void>}
 */
async function matchCustomer(phone) { ... }

// 单行注释：解释"为什么"而非"是什么"
// 状态变为充足时记录补货时间
if (productData.status === 'sufficient' && oldStatus !== 'sufficient') {
  productData.last_produced_at = Date.now();
}
```

**强制注释场景**：
1. 每个云函数的 `exports.main` 上方需注明入参和返回值结构
2. 非直观的业务逻辑（如折扣换算、金额回退算法）
3. 临时 workaround 需标注 `// FIXME:` 或 `// HACK:`

## WXML 规范

- 缩进 2 空格。
- 属性换行：超过 3 个属性时，每个属性一行。
- 条件渲染：`wx:if` 用于低频切换，`hidden` 用于高频切换。
- 列表渲染：`wx:for` 必须提供 `wx:key`（优先使用 `_id`）。

```xml
<!-- ✅ -->
<view
  class="order-card"
  wx:for="{{orders}}"
  wx:key="_id"
  data-order="{{item}}"
  bindtap="onTapOrder"
>
  <text class="order-name">{{item.customerName}}</text>
</view>

<!-- ❌ -->
<view class="order-card" wx:for="{{orders}}" data-order="{{item}}" bindtap="onTapOrder">
```

## WXSS 规范

- 使用 `rpx` 作为响应式单位（750rpx = 屏幕宽度）。
- 颜色使用小写 hex：`#e8594b`（非 `#E8594B`）。
- 禁止使用 `!important`，通过提高选择器优先级解决。
- 页面级样式写在页面 `.wxss` 中，全局样式写在 `app.wxss`。
- 组件样式默认隔离（`styleIsolation: 'isolated'`），需要穿透时使用 `externalClasses`。

## 云函数规范

- `config.json` 必须设置 `timeout` ≥ 10 秒。
- 入口文件固定为 `index.js`，主函数固定为 `exports.main`。
- 必须使用 `cloud.DYNAMIC_CURRENT_ENV` 而非硬编码环境 ID。
- 需要 `_openid` 的业务表必须检查和填充 `_openid`。
- 时间字段必须使用 `db.serverDate()` 而非 `new Date()` 或 `Date.now()`。

```json
// config.json 最小模板
{
  "permissions": {
    "openapi": []
  },
  "timeout": 30
}
```
