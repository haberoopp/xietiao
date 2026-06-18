# 温州斜条批发 — 项目架构设计文档

> 版本: 2.0 | 更新: 2026-06-18 | 类型: 立项级架构文档

---

## 一、项目概述

**定位**：B2B 纺织品辅料（斜条/缎带/包边条）移动端订货工具。

**运行形态**：微信小程序。下游服装厂客户通过小程序浏览产品、下单、跟踪订单；工厂内部（厂长/送货员/仓库调货员）通过管理后台处理订单全生命周期。

**规模指标**：产品约 2000 条，日均订单数十至上百，3 种管理角色 + 匿名客户群。

---

## 二、后端语言与框架

### 2.1 选择

| 层 | 选型 | 版本 |
|---|------|------|
| 后端运行时 | CloudBase 云函数 | Node.js 18.15 |
| 数据库 | CloudBase 文档数据库 | — |
| 语言 | JavaScript (ES6+) | — |
| SDK | `wx-server-sdk` | ~2.6.3 |
| 前端框架 | 微信小程序原生 | — |

### 2.2 为什么选 CloudBase 云函数 + 文档数据库

**决定性的三个原因——缺一不可**：

1. **微信身份自动注入**：云函数中调用 `cloud.getWXContext().OPENID` 即可获得当前用户的微信 openid，无需自建 OAuth 流程。小程序内每个用户的身份由微信保证，`_openid` 成为天然的数据隔离键。

2. **微信开放 API 免鉴权代理**：`cloud.openapi.subscribeMessage.send()` 内部自动管理 `access_token` 的获取、缓存、刷新、失效重试。自建服务器需要自行实现这套有状态逻辑。

3. **零运维**：无服务器、无域名备案、无 SSL 证书、无数据库安装。独立开发者无需运维任何基础设施。

### 2.3 为什么不选其他方案

| 未选方案 | 不选的原因 |
|---------|-----------|
| 自建 Express/Fastify + MySQL 服务器 | 需要：域名备案（国内 20+ 天）、SSL 证书管理、`access_token` 状态管理、数据库运维。对于独立开发者是净负收益。 |
| 自建服务器 + MongoDB | 同上，且 MongoDB 自建集群的运维成本高于 CloudBase 托管文档数据库。 |
| Taro / uni-app 跨端框架 | 本项目无支付宝/字节/百度小程序需求。原生框架无编译层、体积最小、微信 API 兼容性最好。 |
| TypeScript | 15 个云函数 + 12 个页面规模下，TS 编译链增加的复杂度大于类型安全带来的收益。可在云函数超 30 个后重新评估。 |
| Prisma / TypeORM | 文档数据库无固定 schema，ORM 的迁移系统和类型生成在此场景下不适用。直接使用 `db.collection().where()` 是最短路径。 |
| Redis 缓存 | 产品数据 2000 条，`Promise.all` 并行分页拉取在毫秒级完成，缓存无收益。缓存层引入的状态一致性问题反而不值得。 |
| 消息队列 | 通知发送是低优先级操作，同步调用 + 失败静默处理已足够。引入队列会凭空增加部署组件。 |

### 2.4 为什么不选更轻的方案

本项目的 Demo 模式 (`demoStore` + 本地 Storage) 就是一个"纯客户端"方案。它已经存在并作为降级策略运行。不把它作为主方案的原因是：

- 数据无法跨设备共享（客户在 A 手机下单，厂长在 B 手机看不到）
- 无订阅消息推送能力
- 客户数据无持久化保障（清除缓存 = 丢失所有订单）

---

## 三、必须遵守的语言工程规范

以下规则具有**强制性**，代码审查时违反即为不通过。

### 3.1 变量声明

```js
// 强制：不可重新赋值的变量用 const
const app = getApp();
const items = this.data.cartItems.filter(item => item.checked);

// 允许：需要重新赋值时用 let
let total = 0;
for (let i = 0; i < items.length; i++) { total += items[i].price; }

// 禁止：var 已全域清理，新代码不允许出现
```

### 3.2 命名约定

| 元素 | 风格 | 示例 |
|------|------|------|
| 文件名 | kebab-case | `admin-update-order-status/`、`demoStore.js` |
| 云函数目录 | camelCase | `submitOrder/` |
| 页面目录 | 域/功能 | `admin/orders/`、`checkout/` |
| 函数/变量 | camelCase | `loadProducts()`、`cartItems` |
| 常量 | UPPER_SNAKE_CASE | `PRODUCT_CATEGORIES`、`NOTIFY_TEMPLATES` |
| 数据库集合 | camelCase 复数 | `products`、`returnRequests` |
| 数据库字段 | camelCase | `createdAt`、`totalAmount`、`_openid` |
| 事件处理函数 | `on` + 动作 | `onSubmit()`、`onToggleCheck()` |

### 3.3 函数约束

- 单个函数不超过 **60 行**（不含注释和空行）。超标必须拆分。
- 循环嵌套不超过 3 层。
- 圈复杂度不超过 10。
- 每个云函数 `exports.main` 上方必须注释入参和返回值结构。

### 3.4 价格与时间

```js
// 价格：数据库以"分"存储（整数），前端展示时除以 100
const priceInCents = 150;          // ¥1.50
const displayPrice = (priceInCents / 100).toFixed(2);  // "1.50"

// 时间：云函数写数据库用 serverDate，客户端读展示用 new Date()
db.collection('orders').add({ data: { createdAt: db.serverDate() } });  // ✅
db.collection('orders').add({ data: { createdAt: new Date() } });       // ❌
```

### 3.5 模块系统

- 统一 CommonJS（`require` / `module.exports`）。
- 禁止 ES Module（`import` / `export`）。禁止 TypeScript。禁止任何需要编译的语法。

---

## 四、必须遵守的框架最大化利用原则

**原则**：能用框架内置能力解决的，禁止引入外部依赖。

### 4.1 能力对照表

| 需求 | 用框架能力 | 禁止引入 |
|------|-----------|---------|
| 用户身份 | `cloud.getWXContext().OPENID` | 自建登录系统、JWT |
| 消息推送 | `cloud.openapi.subscribeMessage.send` | 自建 HTTP 调用微信 API |
| 文件上传 | `wx.cloud.uploadFile` | 第三方 OSS/CDN SDK |
| 数据库操作 | `db.collection().where().get()` | 自建数据库连接池 |
| 环境配置 | `cloud.DYNAMIC_CURRENT_ENV` | 硬编码 envId |
| 部署 | `tcb fn deploy` + `cloudbaserc.json` | 手动右键上传、FTP |
| 时间戳 | `db.serverDate()` | `new Date()`、`Date.now()`、`moment.js` |
| 数组追加 | `db.command.push()` | 先读全量 → 修改 → 写回 |
| 原子增减 | `db.command.inc()` | 先读 → 计算 → 写回 |
| 字段删除 | `db.command.remove()` | 设 `null` 或 `undefined` |
| 批量查询 | `db.command.in()` | 循环逐个查 |

### 4.2 已有共享模块（禁止重复造轮子）

```
cloudfunctions/lib/
├── response.js    → 统一响应（26 个云函数使用）
├── logger.js      → 结构化日志（26 个云函数使用）
├── auth.js        → 统一鉴权（25 个云函数使用）
└── notify.js      → 订阅消息（待接入，当前 0 个云函数使用）
```

新增云函数必须使用 `response.js` 构建返回值，必须使用 `auth.js` 做鉴权，关键操作必须使用 `logger.js` 记录日志。

### 4.3 新增依赖审批

引入新 npm 包前，必须先回答三个问题：
1. 为什么现有框架能力或已有共享模块无法满足？
2. 有无更轻的替代方案？
3. 对部署包体积的影响？（云函数有大小限制）

---

## 五、目录结构约束

### 5.1 顶层结构

```
E:\miniprogram\
├── app.js                    # 入口：云初始化 + 探活 + 全局数据
├── app.json                  # 路由注册 + tabBar + 窗口配置
├── app.wxss                  # 全局样式
├── cloudbaserc.json          # CLI 部署配置（非交互式）
├── project.config.json       # 微信开发者工具配置
├── .eslintrc.json            # 统一代码风格
├── CLAUDE.md                 # 项目宪法（本文件的强制规则提取版）
│
├── pages/                    # 前端页面（每个子目录 = 一个页面）
│   ├── index/                #   首页 — 产品浏览 + 购物车
│   ├── cart/                 #   购物车 — 勾选结算
│   ├── checkout/             #   结算页 — 下单 + 修改订单
│   ├── orders/               #   我的订单 — 列表 + 退换货申请
│   ├── address/              #   地址簿管理
│   └── admin/                #   管理后台
│       ├── login/            #     登录
│       ├── dashboard/        #     仪表盘（仅厂长）
│       ├── orders/           #     订单管理 + 退换货审核
│       ├── products/         #     产品管理 + CSV/Excel 导入
│       └── customers/        #     客户管理 + 折扣
│
├── cloudfunctions/           # 后端云函数
│   ├── lib/                  #   【共享库】所有云函数的公共依赖
│   │   ├── response.js       #     统一响应构建器
│   │   ├── logger.js         #     结构化日志
│   │   └── notify.js         #     订阅消息通知
│   ├── getProducts/          #   产品列表
│   ├── submitOrder/          #   客户下单
│   ├── getMyOrders/          #   我的订单
│   ├── updateOrder/          #   修改订单
│   ├── cancelOrder/          #   取消订单
│   ├── requestReturn/        #   退换货申请
│   ├── adminLogin/           #   管理员登录
│   ├── adminLogout/          #   管理员登出
│   ├── adminGetOrders/       #   订单列表（管理）
│   ├── adminGetReturns/      #   退换货列表（管理）
│   ├── adminUpdateOrderStatus/  # 改状态
│   ├── adminUpdateOrderPrice/   # 改价格
│   ├── adminHandleReturn/    #   处理退换货
│   ├── adminAddProduct/      #   添加产品
│   ├── adminUpdateProduct/   #   更新产品
│   ├── adminDeleteProduct/   #   删除产品
│   ├── adminOrderImage/      #   上传订单图片
│   ├── adminDeleteOrderImage/#   删除订单图片
│   ├── adminTogglePickedUp/  #   切换已拿货
│   ├── addressCRUD/          #   地址簿 CRUD
│   ├── customerCRUD/         #   客户 CRUD
│   ├── importProducts/       #   Excel 批量导入
│   ├── initAdminAccounts/    #   初始化管理员账号
│   ├── seedAdmin/            #   种子账号
│   └── subscribeAdmin/       #   管理员订阅消息
│
├── utils/                    # 前端工具模块
│   ├── constants.js          #   共享常量（分类/状态/模板ID）
│   ├── demoStore.js          #   Demo 模式数据层
│   ├── mock.js               #   预置演示数据
│   ├── amap.js               #   高德地图 API 封装
│   ├── export.js             #   CSV 导出 + Canvas 对账单
│   └── util.js               #   格式化/校验
│
├── images/                   # 图标资源
├── custom-tab-bar/           # 自定义底部导航组件
└── docs/                     # 架构与规范文档
```

### 5.2 云函数内部结构（强制）

```
cloudfunctions/函数名/
├── index.js       # 必须存在，exports.main 为入口
├── package.json   # 必须存在，声明 wx-server-sdk 依赖
└── config.json    # 必须存在，显式声明 timeout ≥ 10s
```

### 5.3 页面内部结构（强制）

```
pages/域/功能/
├── 功能.js        # Page({ ... })
├── 功能.json      # { "usingComponents": {} }
├── 功能.wxml      # 界面
└── 功能.wxss      # 样式
```

---

## 六、分层架构

### 6.1 框架原生分层 vs 自建分层

CloudBase 云函数**不是 HTTP 框架**，没有 Controller/Service/Repository 的目录结构。但职责边界仍然存在——通过**函数内拆分为独立函数**来实现，而不是通过新建目录和类。

本项目的分层定义：

```
exports.main(event)               ← 接口层入口（框架提供，不可改名）
  │
  ├─ 参数校验函数 validateXxx(event)
  │     ↓ return res.badRequest()  ← 接口层职责：请求检查和响应返回
  │
  ├─ 权限校验函数 authorizeAdmin()
  │     ↓ return res.forbidden()   ← 接口层职责：401/403 在此返回
  │
  ├─ 业务函数 doXxx(validatedData) ← 业务层：只接收已验证的数据
  │     │                            纯逻辑，不碰 event，不调 db
  │     ↓ 返回结果或错误描述
  │
  └─ db.collection('xxx').xxx()    ← 数据层：框架的 db 对象就是数据层
                                      不需要 ORM，不需要 Repository 类
```

**关键原则**：

| 原则 | 框架机制 | 禁止 |
|------|---------|------|
| 接口层只处理请求和响应 | `exports.main` 做入参提取、调校验/业务函数、`return res.xxx()` | 在 `exports.main` 中写业务判断逻辑 |
| 业务规则放到业务层 | 独立函数，接收纯数据，返回纯结果 | 业务函数中调用 `event.xxx` 或 `wxContext` |
| 数据库读写放到数据层 | `db.collection()` — 框架自带的数据库客户端 | 在业务函数中直接操作 DOM/Storage/event |
| 不发明新概念 | CloudBase 没有"中间件""拦截器""依赖注入" | 自建 middleware 链、装饰器、IoC 容器 |

### 6.2 各层职责与位置

| 层 | 框架对应 | 文件位置 | 职责 | 禁止 |
|---|---------|---------|------|------|
| **接口层** | `exports.main` | `index.js` 顶部 50 行内 | 提取 event 参数 → 调校验 → 调业务 → 返回 | 写业务判断、直接操作数据库 |
| **校验层** | 独立 `validate*` 函数 | `index.js` 内、或 `validate.js`（校验逻辑超过 30 行时拆出） | 字段存在性、类型、格式、范围检查 | 查数据库（如查手机号是否重复） |
| **权限层** | `authorize*` 函数 | `index.js` 内、或共享 `lib/auth.js` | 验证 OPENID、查询 admins 表 | 混在业务逻辑中 |
| **业务层** | 独立 `do*` / `handle*` 函数 | `index.js` 内、或 `biz/xxx.js`（业务逻辑超过 60 行时拆出） | 纯业务规则：状态机、金额计算、约束判断 | 访问 `event`、`wxContext`、直接 `return` |
| **数据层** | `db.collection('xxx')` | CloudBase SDK 内置 | CRUD 操作 | 在业务层之上再封装一层无意义的 Repository |

### 6.3 参数校验

**位置**：接口层内部，`exports.main` 中第一个步骤，在权限校验之前。

**框架机制**：没有内置校验器。通过**独立校验函数**实现，接收 `event`，返回 `{ valid: false, error: '...' }` 或 `{ valid: true, data: {...} }`。

```js
// 校验函数——放在 index.js 内（<30行）或拆到 validate.js（>30行）
function validateSubmitOrder(event) {
  const { customerName, phone, address, items } = event;
  if (!customerName || !phone || !address) {
    return { valid: false, error: '请填写完整信息' };
  }
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    return { valid: false, error: '请填写正确的手机号' };
  }
  if (!items || items.length === 0) {
    return { valid: false, error: '请至少选择一件商品' };
  }
  return {
    valid: true,
    data: { customerName: customerName.trim(), phone: phone.trim(), address: address.trim(), items }
  };
}
```

**规则**：
- 校验函数**只做字段检查**，不查数据库。
- 需要查数据库的校验（如"手机号是否已注册"）放到业务层，不属于参数校验。
- 校验失败直接返回 `res.badRequest()`，不继续执行。

### 6.4 权限校验

**位置**：接口层内部，参数校验通过后、业务逻辑之前。

**框架机制**：使用 `cloud.getWXContext().OPENID`（自动注入，不是自建的 token 系统）。

**两种权限模式**（从 `lib/auth.js` 引用，不每个函数重写）：

```js
// cloudfunctions/lib/auth.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const res = require('./response');

/**
 * 客户身份校验 — 返回 openid 或 401
 */
async function requireOpenid() {
  const openid = cloud.getWXContext().OPENID;
  if (!openid) {
    return { authorized: false, response: res.unauthorized() };
  }
  return { authorized: true, openid };
}

/**
 * 管理员身份校验 — 返回 admin 信息或 401/403
 */
async function requireAdmin() {
  const openid = cloud.getWXContext().OPENID;
  if (!openid) {
    return { authorized: false, response: res.unauthorized() };
  }
  const result = await db.collection('admins')
    .where({ lastLoginOpenid: openid, loggedIn: true })
    .get();
  if (result.data.length === 0) {
    return { authorized: false, response: res.forbidden() };
  }
  return { authorized: true, admin: result.data[0], openid };
}

module.exports = { requireOpenid, requireAdmin };
```

**使用方式**（在 `exports.main` 中）：
```js
const auth = await requireAdmin();
if (!auth.authorized) return auth.response;
// auth.admin 可用
```

### 6.5 业务层

**位置**：独立函数，放在 `exports.main` 之后或 `biz/` 目录。

**框架机制**：没有 Service 层概念。通过**纯函数**实现——接收数据，返回结果。

**特征**：
- 不访问 `event`（入参已由校验层提取和清理）
- 不访问 `wxContext`（身份已由权限层转换为 `openid` / `admin`）
- 不直接 `return res.xxx()`（由接口层统一返回）
- 可以调用 `db.collection()` 读取数据做业务判断（如判断订单状态是否允许取消）
- 可以调用 `db.collection()` 写入数据（业务操作的结果持久化）

```js
/**
 * 取消订单 — 业务函数
 * @param {string} orderId - 订单 ID
 * @param {string} openid - 操作者 openid（已由权限层验证）
 * @returns {{ success: true, order: {...} } | { success: false, error: string }}
 */
async function doCancelOrder(orderId, openid) {
  // 读数据
  const order = await db.collection('orders').doc(orderId).get();
  if (!order.data) return { success: false, error: '订单不存在' };
  if (order.data._openid !== openid) return { success: false, error: '无权操作' };

  // 业务规则
  if (order.data.status === 'completed') {
    return { success: false, error: '订单已完成，无法取消' };
  }
  if (order.data.status === 'cancelled') {
    return { success: false, error: '订单已取消' };
  }
  if (order.data.returnRequest) {
    return { success: false, error: '该订单已有退换货申请，无法取消' };
  }

  // 写数据
  await db.collection('orders').doc(orderId).update({
    data: { status: 'cancelled', updatedAt: db.serverDate() }
  });

  return { success: true, order: order.data };
}
```

### 6.6 数据层

**位置**：`db.collection('xxx')` — CloudBase SDK 内置，不需要额外封装。

**框架机制**：`wx-server-sdk` 的 `db` 对象就是数据访问层。它提供了：
- CRUD: `add()` / `doc().get()` / `where().get()` / `doc().update()` / `doc().remove()`
- 分页: `skip()` / `limit()`
- 排序: `orderBy()`
- 聚合: `aggregate()`
- 原子操作: `db.command.inc()` / `db.command.push()` / `db.command.remove()`
- 批量查询: `db.command.in()`
- 服务端时间: `db.serverDate()`

**本项目不需要**在 `db.collection()` 之上再包一层 Repository 类。原因是：

1. CloudBase SDK 已经封装了连接管理、权限过滤、序列化/反序列化。
2. 文档数据库没有 schema 迁移问题，不需要 ORM 的类型映射。
3. 当前规模（7 个集合）下，加一层抽象只是增加代码量，不增加灵活性。

**只在一个场景下抽取数据层函数**：同一个查询在 3 个以上云函数中重复出现。例如：
```js
// cloudfunctions/lib/data.js — 仅在多个云函数复用时抽取
async function getOrderById(orderId) {
  const result = await db.collection('orders').doc(orderId).get();
  return result.data || null;
}
```

### 6.7 完整示例：cancelOrder 按分层重写

**重构前**（当前代码——全部混在 `exports.main`）：
```js
exports.main = async (event) => {
  const { orderId } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  if (!orderId) return { code: -1, msg: '参数错误' };

  try {
    const order = await db.collection('orders').doc(orderId).get();
    if (!order.data) return { code: -1, msg: '订单不存在' };
    if (order.data._openid !== openid) return { code: -1, msg: '无权操作' };
    if (order.data.status === 'completed') {
      return { code: -1, msg: '订单已完成，无法取消。如需退换货请申请退换货' };
    }
    if (order.data.status === 'cancelled') return { code: -1, msg: '订单已取消' };
    if (order.data.returnRequest) return { code: -1, msg: '该订单已有退换货申请，无法取消' };

    await db.collection('orders').doc(orderId).update({
      data: { status: 'cancelled', updatedAt: db.serverDate() }
    });
    return { code: 0 };
  } catch (err) {
    return { code: -1, msg: err.message };
  }
};
```

**重构后**（分三层）：
```js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const res = require('../lib/response');
const logger = require('../lib/logger');
const auth = require('../lib/auth');

// ========== 接口层 ==========
exports.main = async (event) => {
  try {
    // 1. 参数校验
    const v = validate(event);
    if (!v.valid) return res.badRequest(v.error);

    // 2. 权限校验
    const authResult = await auth.requireOpenid();
    if (!authResult.authorized) return authResult.response;

    // 3. 业务逻辑
    const bizResult = await doCancelOrder(v.orderId, authResult.openid);
    if (!bizResult.success) {
      // 按错误类型映射到对应的响应码
      if (bizResult.error === '订单不存在') return res.notFound(bizResult.error);
      if (bizResult.error === '无权操作') return res.forbidden();
      return res.conflict(bizResult.error);
    }

    // 4. 返回
    logger.info('orderCancelled', { orderId: v.orderId });
    return res.ok();
  } catch (err) {
    logger.error('cancelOrder', err, { orderId: event.orderId });
    return res.internalError();
  }
};

// ========== 校验层 ==========
function validate(event) {
  if (!event.orderId) return { valid: false, error: '参数错误' };
  return { valid: true, orderId: event.orderId };
}

// ========== 业务层 ==========
async function doCancelOrder(orderId, openid) {
  const order = await db.collection('orders').doc(orderId).get();
  if (!order.data) return { success: false, error: '订单不存在' };
  if (order.data._openid !== openid) return { success: false, error: '无权操作' };
  if (order.data.status === 'completed') {
    return { success: false, error: '订单已完成，无法取消' };
  }
  if (order.data.status === 'cancelled') return { success: false, error: '订单已取消' };
  if (order.data.returnRequest) return { success: false, error: '该订单已有退换货申请，无法取消' };

  await db.collection('orders').doc(orderId).update({
    data: { status: 'cancelled', updatedAt: db.serverDate() }
  });
  return { success: true };
}
```

**对比**：重构后 `exports.main` 从 21 行降到 8 行。每个函数的职责明确：`validate` 只检查参数、`doCancelOrder` 只写业务规则、接口层只管调度和返回。

### 6.8 拆分阈值

**不强制所有云函数立即拆分**。以下阈值决定是否拆分：

| 条件 | 动作 |
|------|------|
| `exports.main` 超过 30 行 | 必须拆分校验函数 |
| 权限校验逻辑超过 5 行（当前每个管理云函数 4 行） | 必须使用 `lib/auth.js` |
| 业务判断超过 3 个 `if` 分支 | 必须抽取 `doXxx` 业务函数 |
| 同一个校验/业务逻辑在 2 个以上云函数出现 | 必须抽取到共享模块 |

---

## 七、路由体系

### 6.1 路由总览

本项目有两套路由系统：页面路由（客户端导航）和云函数路由（后端调用）。两套路由**分离管理**，不交叉。

| 路由类型 | 定义位置 | 调用方式 | 用途 |
|---------|---------|---------|------|
| 页面路由 | `app.json` → `pages` 数组 | `wx.navigateTo` / `wx.switchTab` / `wx.redirectTo` | 页面间跳转 |
| Tab 路由 | `app.json` → `tabBar.list` | `wx.switchTab` | 底部导航栏切换 |
| 云函数路由 | `cloudbaserc.json` → `functions` | `wx.cloud.callFunction({ name })` | 后端接口调用 |

### 6.2 页面路由 — app.json

```json
{
  "pages": [
    "pages/index/index",
    "pages/cart/cart",
    "pages/checkout/checkout",
    "pages/orders/orders",
    "pages/address/address",
    "pages/admin/login/login",
    "pages/admin/dashboard/dashboard",
    "pages/admin/orders/orders",
    "pages/admin/products/products",
    "pages/admin/customers/customers"
  ]
}
```

- `pages` 数组的**第一个元素是首页**（小程序启动时加载）。
- 新增页面**必须**在此数组中注册，否则微信框架不识别该路由。
- 数组顺序影响页面栈的初始顺序，但不影响导航行为。

**跳转方式选择规则**：

| 目标页面类型 | 使用 API | 说明 |
|------------|---------|------|
| Tab 页面（首页/地址/订单/后台） | `wx.switchTab({ url })` | 关闭所有非 Tab 页面，跳转到 Tab 页 |
| 非 Tab 页面（结算/管理子页） | `wx.navigateTo({ url })` | 保留当前页，新页入栈 |
| 替换当前页（如登录后进后台） | `wx.redirectTo({ url })` | 关闭当前页，新页不入栈 |
| 返回上一页 | `wx.navigateBack()` | 出栈 |

### 6.3 Tab 路由 — app.json → tabBar

```json
{
  "tabBar": {
    "custom": true,
    "list": [
      { "pagePath": "pages/index/index",    "text": "首页" },
      { "pagePath": "pages/address/address", "text": "收货地址" },
      { "pagePath": "pages/orders/orders",   "text": "我的订单" },
      { "pagePath": "pages/admin/login/login","text": "后台" }
    ]
  }
}
```

- `"custom": true` 表示使用自定义 TabBar 组件（`custom-tab-bar/index.*`），而非微信原生 TabBar。
- Tab 页面的 `.json` 文件中必须声明 `"usingComponents": { "custom-tab-bar": "/custom-tab-bar/index" }`。
- Tab 页面只能用 `wx.switchTab` 跳转，不能通过 `wx.navigateTo`。
- 当前 4 个 Tab：首页、收货地址、我的订单、后台（登录/管理入口）。

### 6.4 云函数路由 — cloudbaserc.json + wx.cloud.callFunction

**注册侧**（`cloudbaserc.json`）：
```json
{
  "functions": [
    { "name": "submitOrder", "timeout": 30, "runtime": "Nodejs18.15", "handler": "index.main" }
  ]
}
```

**调用侧**（客户端）：
```js
wx.cloud.callFunction({ name: 'submitOrder', data: { ... } })
```

- 云函数的 `name` 对应 `cloudfunctions/` 下的目录名。
- `handler` 固定为 `index.main`（文件 `index.js` 的 `exports.main`）。
- 新增云函数**必须**在 `cloudbaserc.json` 的 `functions` 数组中注册。
- 客户端通过 `name` 调用，没有 URL 路径的概念——这不是 HTTP 路由。

### 6.5 路由参数传递

**页面间传参**：通过 URL query string（微信框架标准方式）：
```js
wx.navigateTo({ url: '/pages/checkout/checkout?editOrder=1' });
// checkout.js onLoad(options) → options.editOrder === '1'
```

**云函数传参**：通过 `data` 对象（不是 HTTP body / query）：
```js
wx.cloud.callFunction({ name: 'getProducts', data: { page: 1, pageSize: 20 } });
// event.page === 1, event.pageSize === 20
```

**跨页面共享数据**（不通过路由参数）：使用 `app.globalData`：
```js
// 结算页跳首页选商品前，保存状态
app.globalData.checkoutState = { customerName: '...', phone: '...' };
wx.switchTab({ url: '/pages/index/index' });
// 首页 onShow 读取 app.globalData.checkoutState 恢复
```

---

## 八、接口响应规则

### 7.1 设计原则

云函数与客户端之间不是 HTTP 协议，而是 CloudBase SDK 的专有调用通道。**但返回格式对标 HTTP 语义设计**，让任何开发者一眼看懂：

| 场景 | HTTP 对标 | code 值 | 说明 |
|------|----------|---------|------|
| 成功 | 200 OK | `0` | 所有正常返回 |
| 参数错误 | 400 Bad Request | `400` | 客户端传参不合法 |
| 未登录 | 401 Unauthorized | `401` | 无法获取用户身份 |
| 无权限 | 403 Forbidden | `403` | 用户已识别但权限不足 |
| 资源不存在 | 404 Not Found | `404` | 查/改/删的目标不存在 |
| 状态冲突 | 409 Conflict | `409` | 业务状态不允许当前操作 |
| 系统异常 | 500 Internal Server Error | `500` | 服务端不可预期错误 |

**禁止使用其他 code 值**。以上 7 个 code 覆盖所有场景。

### 7.2 成功场景一：列表

**适用**：`getProducts`、`getMyOrders`、`adminGetOrders`、`adminGetReturns` 等返回多条数据的接口。

```json
{
  "code": 0,
  "data": {
    "list": [
      { "_id": "abc", "name": "色丁精品缎面", ... },
      { "_id": "def", "name": "凉感丝包边条", ... }
    ],
    "total": 1250,
    "page": 1,
    "pageSize": 20
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `list` | array | 是 | 数据行（可为空数组 `[]`） |
| `total` | integer | 是 | 符合查询条件的总记录数 |
| `page` | integer | 否 | 当前页码（入参有 page 时返回） |
| `pageSize` | integer | 否 | 每页数量（入参有 pageSize 时返回） |

**空列表示例**（查询无结果仍然是成功）：
```json
{ "code": 0, "data": { "list": [], "total": 0 } }
```

### 7.3 成功场景二：对象（详情）

**适用**：`adminLogin`（返回管理员信息）、`customerCRUD.getByPhone`（返回单个客户）等返回单个对象的接口。

```json
{
  "code": 0,
  "data": {
    "record": {
      "_id": "abc",
      "username": "changzhang",
      "role": "manager",
      "nickname": "厂长"
    }
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `record` | object | 是 | 单条数据（可为 `null` 表示不存在） |

**对象不存在但非错误时**：
```json
{ "code": 0, "data": { "record": null } }
```

### 7.4 成功场景三：创建后的数据

**适用**：`submitOrder`、`adminAddProduct`、`addressCRUD.add` 等创建类接口。

```json
{
  "code": 0,
  "data": {
    "record": {
      "_id": "abc123",
      "customerName": "温州服装厂",
      "totalAmount": 25000,
      "status": "processing",
      "createdAt": "2026-06-18T..."
    }
  }
}
```

**关键约定**：创建成功后**必须**返回完整的新建记录（包含 `_id`），客户端可能立即使用这个 ID 做后续操作。

### 7.5 成功场景四：更新后的数据

**适用**：`updateOrder`、`adminUpdateProduct`、`adminHandleReturn` 等修改类接口。

```json
{
  "code": 0,
  "data": {
    "record": {
      "_id": "abc123",
      "totalAmount": 25000,
      "status": "completed",
      "updatedAt": "2026-06-18T..."
    }
  }
}
```

**关键约定**：返回更新后的最新数据。如果更新涉及的字段较多，至少返回 `_id` 和变更的字段。

### 7.6 成功场景五：无数据返回

**适用**：`adminLogout`、`adminDeleteProduct`、`cancelOrder`、`adminTogglePickedUp` 等纯操作接口。

```json
{ "code": 0 }
```

不包含 `data` 字段。客户端检查 `code === 0` 即表示操作成功。

### 7.7 失败场景一：参数错误（code: 400）

```json
{
  "code": 400,
  "msg": "请填写完整信息并选择商品",
  "errors": {
    "customerName": "不能为空",
    "phone": "格式不正确",
    "items": "至少选择一件商品"
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `msg` | string | 是 | 用户可读的中文摘要，可直接用于 Toast |
| `errors` | object | 否 | 逐字段错误明细（键为字段名，值为中文描述） |

**触发条件**：入参缺失、格式非法、值不在允许范围内。

### 7.8 失败场景二：未登录（code: 401）

```json
{
  "code": 401,
  "msg": "请先登录"
}
```

**触发条件**：`cloud.getWXContext().OPENID` 返回空。客户端收到后应引导用户重新授权。

### 7.9 失败场景三：无权限（code: 403）

```json
{
  "code": 403,
  "msg": "无管理员权限"
}
```

**触发条件**：`admins` 表中找不到匹配的 `lastLoginOpenid` 或 `loggedIn` 为 `false`。

### 7.10 失败场景四：资源不存在（code: 404）

```json
{
  "code": 404,
  "msg": "订单不存在"
}
```

**触发条件**：`db.collection().doc(id).get()` 返回空、或 `_openid` 匹配但记录未找到。与 `code: 403` 的区别：404 是"目标不存在"，403 是"目标存在但你无权访问"。

### 7.11 失败场景五：状态冲突（code: 409）

```json
{
  "code": 409,
  "msg": "订单已完成，无法取消。如需退换货请申请退换货"
}
```

**触发条件**：操作与当前业务状态冲突——已完成订单不能取消、已有退换货申请不能重复提交、被拒 2 次后不能再次申请。

### 7.12 失败场景六：系统异常（code: 500）

```json
{
  "code": 500,
  "msg": "操作失败，请稍后重试"
}
```

**触发条件**：所有 `catch(err)` 捕获的未预期错误。**msg 固定为中文通用提示**，不暴露 `err.message`。原始错误通过 `logger.error()` 记录。

### 7.13 错误码速查

| code | HTTP 对标 | 语义 | msg 示例 | 客户端处理 |
|------|----------|------|---------|-----------|
| `0` | 200 | 成功 | — | 消费 `data` |
| `400` | 400 | 参数错误 | `"请填写完整信息"` | Toast msg，如有 `errors` 可逐字段标红 |
| `401` | 401 | 未登录 | `"请先登录"` | 引导重新授权 |
| `403` | 403 | 无权限 | `"无管理员权限"` | Toast + 跳转登录页 |
| `404` | 404 | 不存在 | `"订单不存在"` | Toast + 返回上一页 |
| `409` | 409 | 状态冲突 | `"订单已完成，无法取消"` | Toast，不重试 |
| `500` | 500 | 系统异常 | `"操作失败，请稍后重试"` | Toast，可重试 |

### 7.14 构建方式

```js
const res = require('../lib/response');

// 列表
return res.list(list, total, page, pageSize);

// 对象
return res.record(data);

// 创建/更新后的数据
return res.record(newData);

// 无数据返回
return res.ok();

// 失败
return res.badRequest('请填写完整信息', { customerName: '不能为空' });
return res.unauthorized();
return res.forbidden('无管理员权限');
return res.notFound('订单不存在');
return res.conflict('订单已完成，无法取消');
return res.internalError();
```

### 7.15 客户端消费

```js
const { result } = await wx.cloud.callFunction({ name: 'getProducts', data: { page: 1, pageSize: 20 } });

if (!result || result.code !== 0) {
  const msg = (result && result.msg) || '操作失败';
  wx.showToast({ title: msg, icon: 'none' });
  // 按 code 细化处理
  if (result && result.code === 401) {
    // 跳转登录
  } else if (result && result.code === 403) {
    wx.switchTab({ url: '/pages/admin/login/login' });
  }
  return;
}

// 列表
const { list, total } = result.data;
// 对象
const { record } = result.data;

---

## 九、错误处理规则

### 7.1 三层架构

```
Layer 3: app.js → wx.onError + wx.onUnhandledRejection → 写入 _error_logs (Storage)
Layer 2: 客户端 Page 方法 → try/catch → wx.showToast + console.error
Layer 1: 云函数 exports.main → try/catch → { code: -1, msg } + logger.error
```

### 7.2 云函数错误处理模板

```js
exports.main = async (event) => {
  try {
    // 鉴权 → 校验 → 业务 → 返回
    return res.success(data);
  } catch (err) {
    logger.error('函数名', err, { 入参关键字段 });
    return res.fail('操作失败，请稍后重试');
    //                    ↑ 中文提示，不暴露 err.message
  }
};
```

**铁律**：catch 中**不向客户端返回 `err.message`**。原始错误记入 `logger.error`，客户端只收到固定中文提示。

### 7.3 客户端错误处理模板

```js
async loadData() {
  this.setData({ loading: true });
  const app = getApp();

  // Demo 降级分支必须写在 try 之前
  if (app.globalData.demoMode) {
    this.setData({ items: demoStore.getAll(demoStore.KEYS.xxx), loading: false });
    return;
  }

  try {
    const res = await wx.cloud.callFunction({ name: 'xxx', data: {} });
    if (res.result && res.result.code === 0) {
      this.setData({ items: res.result.data.list });
    } else {
      wx.showToast({ title: (res.result && res.result.msg) || '加载失败', icon: 'none' });
    }
  } catch (err) {
    wx.showToast({ title: '网络错误，请检查网络后重试', icon: 'none' });
    console.error('[loadData]', err.errMsg || String(err).slice(0, 100));
  }
  this.setData({ loading: false });
}
```

### 7.4 静默失败场景（允许不弹 Toast）

以下场景可以静默处理，仅 `console.warn`：
1. 订阅消息发送失败（非阻塞）
2. 下单后自动保存地址/录入客户失败（主流程已完成）
3. 临时文件清理失败
4. 云存储文件删除失败（文件可能已不存在）

---

## 十、日志规则

### 8.1 三级日志

| 级别 | 云函数用法 | 客户端用法 | 场景 |
|------|-----------|-----------|------|
| info | `logger.info(event, ctx)` | `console.log` | 关键业务流程节点 |
| warn | `logger.warn(event, ctx)` | `console.warn` | 可恢复异常、降级 |
| error | `logger.error(event, err, ctx)` | `console.error` | 不可恢复错误 |

### 8.2 云函数日志格式

```
[2026-06-18T14:32:05.123Z] [INFO] orderSubmitted {"orderId":"abc123","amount":25000}
[2026-06-18T14:32:10.456Z] [ERROR] dbWriteError {"collection":"orders"} Cannot read property...
```

每条日志必须包含 3 个要素：**事件名**（camelCase）+ **上下文对象**（含关键 ID）+ **错误对象**（仅 error 级）。

### 8.3 禁止的日志行为

- 打印用户敏感信息（密码、完整手机号、完整地址）
- 循环中打日志
- 用 `JSON.stringify` 打印大对象
- catch 块不记日志直接吞掉错误

---

## 十一、数据库连接方式

### 9.1 连接模型

CloudBase 云函数与数据库之间**不需要连接字符串、连接池、或任何连接管理代码**。原因是 CloudBase 平台将数据库访问封装在 `wx-server-sdk` 内部，云函数执行时自动注入 SDK 初始化所需的上下文。

```js
// 每个云函数的标准开头 —— 这就是"数据库连接"
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });  // 环境自动识别
const db = cloud.database();                       // 数据库句柄
```

- `DYNAMIC_CURRENT_ENV`：云函数自动读取自身所属环境，不硬编码环境 ID。
- `db` 对象是单例，云函数生命周期内复用。
- SDK 内部使用 HTTP 短连接（每次操作独立请求），不需要连接池。

### 9.2 集合权限设计

| 集合 | 读权限 | 写权限 | 原理 |
|------|--------|--------|------|
| `products` | 所有用户 | 仅管理员（通过云函数控制） | 公开目录 |
| `orders` | 仅创建者 | 仅创建者 | `_openid` 行级隔离 |
| `addresses` | 仅创建者 | 仅创建者 | `_openid` 行级隔离 |
| `returnRequests` | 仅创建者 | 仅创建者 | `_openid` 行级隔离 |
| `admins` | 所有用户 | 仅管理员 | 密码哈希保护 |
| `customers` | 所有用户 | 仅管理员 | 公开档案 |
| `adminSubscriptions` | 所有用户 | 仅创建者 | 订阅状态 |

---

## 十二、权限校验入口

> 完整的层次结构见 [第六章 分层架构](#六分层架构)。此处仅说明权限校验的具体位置和机制。

### 12.1 校验位置

权限校验属于**接口层**职责，在参数校验通过后、业务函数调用前执行。

### 12.2 框架机制

使用 `cloud.getWXContext().OPENID`，这是微信框架**自动注入**的用户标识，无需自建 token 或 session。客户端不需要传任何身份参数。

### 12.3 统一入口

**禁止在云函数中手写 `wxContext.OPENID` 校验逻辑**。使用共享模块 `cloudfunctions/lib/auth.js`：

```js
const auth = require('../lib/auth');

// 客户身份 — 仅验证 openid 存在
const r = await auth.requireOpenid();
if (!r.authorized) return r.response;   // 401

// 管理员身份 — 验证 openid 存在 + admins 表登录态
const r = await auth.requireAdmin();
if (!r.authorized) return r.response;   // 401 或 403
```

### 12.4 无需鉴权的例外

- `getProducts` — 公开产品目录
- `adminLogin` — 登录本身不需要鉴权
- `customerCRUD.getByPhone` — 结算页匹配折扣（公开查询接口）
- `customerCRUD.upsert` — 下单后自动录入（客户端 submitOrder 已通过自己身份）
- `seedAdmin` / `initAdminAccounts` — 仅首次手动调用

---

## 十三、新增模块规范

### 11.1 新增页面

**步骤**：
1. 在 `pages/{域}/{功能}/` 下建目录
2. 创建 4 个文件：`{功能}.js`、`{功能}.json`、`{功能}.wxml`、`{功能}.wxss`
3. 在 `app.json` 的 `"pages"` 数组末尾注册路径
4. 如果是 tabBar 页面，在 `app.json` 的 `"tabBar.list"` 中同时注册

**JS 模板**：
```js
const demoStore = require('../../utils/demoStore');

Page({
  data: { loading: false, items: [] },

  onShow() {
    // 管理页面至此检查 adminLoggedIn
    this.loadData();
  },

  async loadData() {
    this.setData({ loading: true });
    const app = getApp();
    if (app.globalData.demoMode) {
      this.setData({ items: demoStore.getAll(demoStore.KEYS.xxx), loading: false });
      return;
    }
    try {
      const res = await wx.cloud.callFunction({ name: 'xxx', data: {} });
      if (res.result && res.result.code === 0) {
        this.setData({ items: res.result.data.list });
      }
    } catch (err) {
      wx.showToast({ title: '网络错误', icon: 'none' });
    }
    this.setData({ loading: false });
  }
});
```

**强制要求**：每个数据加载方法必须有 demo 降级分支，写在 try 之前。

### 11.2 新增云函数

**步骤**：
1. 在 `cloudfunctions/{函数名}/` 下建目录
2. 创建 3 个文件：`index.js`、`package.json`、`config.json`
3. 在 `cloudbaserc.json` 的 `"functions"` 数组中注册
4. 在 `docs/api-reference.md` 中添加接口定义

**config.json 模板**：
```json
{
  "permissions": { "openapi": [] },
  "timeout": 20
}
```

**package.json 模板**：
```json
{
  "name": "函数名",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": { "wx-server-sdk": "~2.6.3" }
}
```

**index.js 模板**：
```js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const res = require('../lib/response');
const logger = require('../lib/logger');

exports.main = async (event) => {
  try {
    const wxContext = cloud.getWXContext();

    // 鉴权（按需选择模式 A 或 B）
    if (/* 管理操作 */) {
      if (!wxContext.OPENID) return res.unauthorized();
      const admin = await db.collection('admins')
        .where({ lastLoginOpenid: wxContext.OPENID, loggedIn: true }).get();
      if (admin.data.length === 0) return res.forbidden();
    }

    // 参数校验
    const { param } = event;
    if (!param) return res.fail('参数描述不能为空');

    // 业务逻辑
    logger.info('事件名', { param });

    // 返回
    return res.success({ ... });
  } catch (err) {
    logger.error('函数名', err, { 入参关键字段 });
    return res.fail('操作失败，请稍后重试');
  }
};
```

### 11.3 新增前端工具模块

在 `utils/{name}.js` 下创建，`module.exports` 导出，页面通过 `require('../../utils/{name}')` 引用。

### 11.4 新增云函数共享库

在 `cloudfunctions/lib/{name}.js` 下创建，`module.exports` 导出，云函数通过 `require('../lib/{name}')` 引用。

### 11.5 新增数据库集合

1. 在微信云开发控制台 → 数据库 → 添加集合
2. 根据数据的所有权设置权限（参考第九节）
3. 在 `docs/data-model.md` 中添加集合 Schema
4. 如需要索引，在控制台手动创建

---

## 十四、关联文档索引

| 文档 | 路径 | 说明 |
|------|------|------|
| **后端实施真源文档** | [backend-implementation-spec.md](backend-implementation-spec.md) | **后端开发唯一权威参考。与本文档冲突时以它为准。** |
| 项目宪法 | `../CLAUDE.md` | 本文档的强制规则提取版（AI Agent 每次会话自动加载） |
| 数据模型 | [data-model.md](data-model.md) | 7 个集合完整 Schema |
| API 接口 | [api-reference.md](api-reference.md) | 25 个云函数入参/出参/错误码 |
| 部署文档 | [deployment.md](deployment.md) | 环境/部署/回滚/常见问题 |
| 代码规范 | [standards/coding-standards.md](standards/coding-standards.md) | JS/WXML/WXSS 详细风格 |
| 项目目录 | [standards/project-structure.md](standards/project-structure.md) | 目录职责与命名 |
| 错误处理 | [standards/error-handling.md](standards/error-handling.md) | 三层架构 + Toast 规范 |
| API 响应 | [standards/api-response.md](standards/api-response.md) | 统一格式与错误码 |
| 日志规范 | [standards/logging.md](standards/logging.md) | 结构化日志与禁止项 |
| 模块拓展 | [standards/module-extension.md](standards/module-extension.md) | 新增页面/云函数流程 |
