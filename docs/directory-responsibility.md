# 目录责任表

> 版本: 1.0 | 更新: 2026-06-18

---

## 一、目录责任总表

### 标注说明

- 🔵 **框架推荐** — 微信小程序或 CloudBase 官方文档规定的目录/文件
- 🟠 **框架要求但项目自定义** — 框架规定了类型（如"云函数目录"），但具体文件是项目自己的
- 🟢 **项目业务自定义** — 完全由本项目自行创建的目录

---

### 根目录

| 目录/文件 | 来源 | 主要职责 | 应该放什么 | 禁止放什么 | 示例 |
|---------|------|---------|-----------|-----------|------|
| `app.js` | 🔵 框架要求 | 小程序启动入口：初始化云开发、全局数据、探活降级 | 全局状态（`globalData`）、生命周期（`onLaunch`）、全局错误监听 | 页面业务逻辑、UI 代码 | `app.js` |
| `app.json` | 🔵 框架要求 | 全局配置：页面路由注册、tabBar 定义、窗口样式 | 页面路径、tabBar 配置、窗口标题/颜色 | 业务常量、API 密钥 | `app.json` |
| `app.wxss` | 🔵 框架要求 | 全局样式：CSS 变量、基础组件样式 | 颜色 Token、通用 class、reset 样式 | 页面专属样式 | `app.wxss` |
| `project.config.json` | 🔵 框架要求 | 微信开发者工具的项目配置 | 编译选项、AppID、打包配置 | 业务配置 | `project.config.json` |
| `cloudbaserc.json` | 🟢 业务自定义 | CloudBase CLI 部署配置：声明哪些云函数需要部署及参数 | 云函数名、超时、运行时版本 | 环境密钥、业务数据 | `cloudbaserc.json` |
| `.eslintrc.json` | 🟢 业务自定义 | 代码风格检查规则 | ESLint 规则 | — | `.eslintrc.json` |
| `CLAUDE.md` | 🟢 业务自定义 | AI 编码助手的项目宪法：强制规则、禁止事项 | 编码规范、分层规则、变更审批 | 业务描述、教程 | `CLAUDE.md` |
| `README.md` | 🟢 业务自定义 | 项目入口文档：启动步骤、配置说明、测试方法 | 快速开始、环境要求、账号密码 | 架构细节、API 文档 | `README.md` |

---

### pages/ — 前端页面

| 目录 | 来源 | 主要职责 | 应该放什么 | 禁止放什么 | 示例 |
|------|------|---------|-----------|-----------|------|
| `pages/index/` | 🟠 框架规定类型 | 首页：产品浏览、分类筛选、搜索、加入购物车 | 产品列表、悬浮购物车逻辑 | 订单处理逻辑、管理功能 | `index.js` `index.wxml` |
| `pages/cart/` | 🟠 框架规定类型 | 购物车：查看已选商品、勾选/取消、修改数量、去结算 | 购物车编辑逻辑 | 下单提交（那是结算页的事） | `cart.js` |
| `pages/checkout/` | 🟠 框架规定类型 | 结算页：填写收货信息、选拿货方式、提交订单、修改订单 | 表单校验、地址匹配、折扣计算、下单调用 | 购物车编辑（那是购物车页的事） | `checkout.js` |
| `pages/orders/` | 🟠 框架规定类型 | 我的订单：查看自己订单列表、取消订单、申请退换货 | 订单列表、退换货表单、换购选择 | 管理功能（那是 admin 的事） | `orders.js` |
| `pages/address/` | 🟠 框架规定类型 | 地址簿：管理收货地址、设默认、选择地址回填结算页 | 地址 CRUD、地图选点 | 订单逻辑 | `address.js` |
| `pages/admin/login/` | 🟢 业务自定义 | 管理员登录：账号密码输入、调用登录云函数 | 登录表单、身份存储 | 订单管理（那是 orders 页的事） | `login.js` |
| `pages/admin/dashboard/` | 🟢 业务自定义 | 仪表盘（仅厂长）：销量统计、趋势图、产品排行、缺货预警 | 数据统计、图表生成 | 订单编辑（那是 orders 页的事） | `dashboard.js` |
| `pages/admin/orders/` | 🟢 业务自定义 | 订单管理：查看全部订单、改状态、改价格、上传凭证、审核退换货 | 全部管理功能 | 产品编辑（那是 products 页的事） | `orders.js` |
| `pages/admin/products/` | 🟢 业务自定义 | 产品管理：增删改产品、CSV/Excel 导入 | 产品 CRUD、文件导入 | 订单处理 | `products.js` |
| `pages/admin/customers/` | 🟢 业务自定义 | 客户管理：增删改客户、折扣设置、欠款查看 | 客户 CRUD、折扣滑块 | 订单数据 | `customers.js` |

---

### cloudfunctions/ — 后端云函数

| 目录 | 来源 | 主要职责 | 应该放什么 | 禁止放什么 | 示例 |
|------|------|---------|-----------|-----------|------|
| `cloudfunctions/lib/` | 🟢 业务自定义 | **共享模块**：所有云函数共用的工具代码 | 响应构建器、日志、鉴权、通知 | 业务逻辑、页面代码 | `response.js` `logger.js` `auth.js` `notify.js` |
| `cloudfunctions/healthCheck/` | 🟢 业务自定义 | 健康检查：验证数据库连接和集合可用性 | 数据库探活 | 业务逻辑 | `index.js` |
| `cloudfunctions/getProducts/` | 🟠 框架规定类型 | 产品列表：分页查询、分类/关键词筛选 | 产品查询 | 下单、用户管理 | `index.js` |
| `cloudfunctions/submitOrder/` | 🟠 框架规定类型 | 客户下单：创建订单、写入数据库 | 订单创建、_openid 绑定 | 通知发送（由 notify 模块处理） | `index.js` |
| `cloudfunctions/getMyOrders/` | 🟠 框架规定类型 | 我的订单：按 openid 查自己的订单 | 订单查询（按 _openid） | 读取别人的订单 | `index.js` |
| `cloudfunctions/updateOrder/` | 🟠 框架规定类型 | 修改订单：更新订单信息 | 订单字段更新 | 状态机逻辑（那是业务层的活） | `index.js` |
| `cloudfunctions/cancelOrder/` | 🟠 框架规定类型 | 取消订单：状态机检查 + 状态变更 | 取消条件判断 + 状态更新 | 退款计算（那是 adminHandleReturn 的事） | `index.js` |
| `cloudfunctions/requestReturn/` | 🟠 框架规定类型 | 退换货申请：规则校验 + 写入退换货记录 | 退换货条件判断、returnRequests 表写入 | 审核处理（那是 adminHandleReturn 的事） | `index.js` |
| `cloudfunctions/addressCRUD/` | 🟠 框架规定类型 | 地址管理：客户地址的增删改查 | 地址 CRUD、默认地址逻辑 | 订单数据 | `index.js` |
| `cloudfunctions/customerCRUD/` | 🟠 框架规定类型 | 客户管理：客户档案的增删改查 + 自动录入 | 客户 CRUD、折扣管理、upsert | 订单创建 | `index.js` |
| `cloudfunctions/adminLogin/` | 🟠 框架规定类型 | 管理员登录：密码验证 + 登录态写入 | PBKDF2 验证、锁定逻辑 | 客户登录（客户不需要登录） | `index.js` |
| `cloudfunctions/adminLogout/` | 🟠 框架规定类型 | 管理员登出：清除登录态 | 登录态清除 | — | `index.js` |
| `cloudfunctions/adminGetOrders/` | 🟠 框架规定类型 | 订单列表（管理）：查全部客户订单 | 全部订单查询（不限 _openid） | 修改订单 | `index.js` |
| `cloudfunctions/adminGetReturns/` | 🟠 框架规定类型 | 退换货列表：查退换货申请 + 关联订单信息 | 退换货查询 + 批量订单关联 | 审核处理 | `index.js` |
| `cloudfunctions/adminUpdateOrderStatus/` | 🟠 框架规定类型 | 改订单状态：processing/completed/cancelled 切换 | 状态变更 | 价格修改、退换货处理 | `index.js` |
| `cloudfunctions/adminUpdateOrderPrice/` | 🟠 框架规定类型 | 改订单金额：修改 totalAmount | 金额更新 | 其他订单字段 | `index.js` |
| `cloudfunctions/adminHandleReturn/` | 🟠 框架规定类型 | 处理退换货：通过/拒绝/完成 + 金额重算 | 审核逻辑、金额算法、状态联动 | 申请退换货（那是 requestReturn 的事） | `index.js` |
| `cloudfunctions/adminAddProduct/` | 🟠 框架规定类型 | 添加产品：校验字段 + 写入 products 表 | 产品创建 | 更新、删除 | `index.js` |
| `cloudfunctions/adminUpdateProduct/` | 🟠 框架规定类型 | 更新产品：修改产品字段 | 产品字段更新 | 创建、删除 | `index.js` |
| `cloudfunctions/adminDeleteProduct/` | 🟠 框架规定类型 | 删除产品：从 products 表移除 | 产品删除 | 更新、创建 | `index.js` |
| `cloudfunctions/adminOrderImage/` | 🟠 框架规定类型 | 订单图片上传：把云存储 fileID 写入订单 | 图片 ID 写入 orders.images[] | 文件上传本身（由客户端 wx.cloud.uploadFile 完成） | `index.js` |
| `cloudfunctions/adminDeleteOrderImage/` | 🟠 框架规定类型 | 删除订单图片：从 orders.images[] 移除 | 图片记录删除 | 业务逻辑 | `index.js` |
| `cloudfunctions/adminTogglePickedUp/` | 🟠 框架规定类型 | 切换已拿货状态：pickedUp true/false 翻转 | pickedUp 字段切换 | 其他状态管理 | `index.js` |
| `cloudfunctions/importProducts/` | 🟠 框架规定类型 | Excel 导入：下载文件 → 解析 → 批量写入 | xlsx 解析 + 批量写入 | CSV 解析（客户端自己做） | `index.js` |
| `cloudfunctions/subscribeAdmin/` | 🟠 框架规定类型 | 管理订阅消息：写入/更新 adminSubscriptions 表 | 订阅状态管理 | 消息发送（由 notify.js 完成） | `index.js` |
| `cloudfunctions/seedAdmin/` | 🟢 业务自定义 | 种子账号：首次部署时写入 3 个预置管理员 | 账号初始化 | 日常使用（仅部署时调用一次） | `index.js` |
| `cloudfunctions/initAdminAccounts/` | 🟢 业务自定义 | 初始化账号（旧版）：与 seedAdmin 功能相同 | 账号初始化 | 日常使用 | `index.js` |

---

### utils/ — 前端工具模块

| 目录/文件 | 来源 | 主要职责 | 应该放什么 | 禁止放什么 | 示例 |
|---------|------|---------|-----------|-----------|------|
| `utils/` 整体 | 🟢 业务自定义 | 前端共享工具：被多个页面引用的公共代码 | 格式化函数、常量、数据存储层、地图封装 | 页面内部逻辑、云函数代码 | — |
| `utils/constants.js` | 🟢 业务自定义 | 共享常量：产品分类、状态映射、模板 ID | 所有枚举值和映射表 | 业务逻辑、API 密钥 | `PRODUCT_CATEGORIES` |
| `utils/demoStore.js` | 🟢 业务自定义 | Demo 模式数据层：统一读写本地缓存 | 本地数据的 get/set/update | 云函数调用 | `demoStore.getAll(KEYS.orders)` |
| `utils/mock.js` | 🟢 业务自定义 | 预置演示数据：首次启动时的示例数据 | 静态演示数据 | 运行中修改的数据 | `mockProducts` `demoAdminAccounts` |
| `utils/amap.js` | 🟢 业务自定义 | 高德地图封装：POI 搜索、地理编码、导航 | 地图 API 调用 | 业务逻辑 | `chooseLocation()` |
| `utils/export.js` | 🟢 业务自定义 | 导出工具：CSV 生成 + Canvas 对账单 | CSV 格式、Canvas 绑制 | 业务数据查询 | `ordersToCSV()` |
| `utils/util.js` | 🟢 业务自定义 | 通用工具：格式化日期/价格、手机号校验、状态映射 | 纯函数工具 | 有副作用的操作 | `formatPrice()` `isValidPhone()` |

---

### 其他

| 目录 | 来源 | 主要职责 | 应该放什么 | 禁止放什么 | 示例 |
|------|------|---------|-----------|-----------|------|
| `images/` | 🔵 框架推荐 | 图标资源 | tabBar 图标、占位图 | 业务图片（放云存储） | `home.png` |
| `custom-tab-bar/` | 🔵 框架提供 | 自定义底部导航栏组件 | tabBar 的 wxml/wxss/js | 页面业务逻辑 | `index.js` |
| `docs/` | 🟢 业务自定义 | 项目文档：架构、数据模型、API、规范、教程 | 所有 .md 文档 | 代码文件 | `architecture-overview.md` |
| `docs/standards/` | 🟢 业务自定义 | 编码规范：代码风格、响应格式、错误处理、日志 | 规范文档 | 代码 | `coding-standards.md` |

---

## 二、框架概念 → 项目位置映射

以下按当前框架（微信小程序 + CloudBase 云函数）解释每个架构概念在项目中的实际位置：

### 2.1 请求入口在哪里

| 请求类型 | 入口位置 | 框架机制 | 具体文件 |
|---------|---------|---------|---------|
| 客户端发起云函数调用 | 云函数 `exports.main` | `wx.cloud.callFunction({ name, data })` 将 `data` 传给 `event` | 每个 `cloudfunctions/*/index.js` 的 `exports.main` |
| 客户端页面跳转 | 页面 `onLoad(options)` | URL query string 传入 `options` | 每个 `pages/**/*.js` 的 `onLoad` |
| 小程序冷启动 | `App.onLaunch` | 微信框架自动调用 | `app.js` → `onLaunch()` |
| Tab 切换 | 页面 `onShow` | 微信框架自动调用 | 每个 Tab 页面的 `onShow()` |

**关键理解**：CloudBase 云函数不是 HTTP 接口。没有 URL 路径、没有 HTTP method（GET/POST）、没有 HTTP header。`wx.cloud.callFunction({ name: '函数名', data: {...} })` 是微信自定义的 RPC 调用通道。`name` 对应云函数目录名，`data` 直接变成 `event` 参数。

### 2.2 业务规则在哪里

| 业务规则类型 | 位置 | 具体形式 |
|------------|------|---------|
| 订单状态机（什么状态可以取消、什么状态可以退换货） | 云函数内部的 `doXxx` 函数 | `doCancelOrder()`、`requestReturn` 中的校验逻辑 |
| 退换货金额重算（退货扣款、换货补差价） | `adminHandleReturn/index.js` 中的计算逻辑 | `Math.round((price * discount) * quantity)` + `Math.max(0, ...)` |
| 登录锁定（5 次失败锁 15 分钟） | `adminLogin/index.js` | `MAX_ATTEMPTS=5` `LOCK_MINUTES=15` |
| 被拒次数限制（2 次不可再申请） | `requestReturn/index.js` | `rejectionCount >= 2` |
| 送货员/仓库员必须上传凭证 | 客户端 `admin/orders/orders.js` 的 `onStatusChange` | 前端校验 `images.length === 0` 时拦截 |

**关键理解**：CloudBase 框架没有 Service 层或 Domain 层的概念。业务规则以**纯函数**的形式存在——在 `exports.main` 之后定义 `async function doXxx()`，接收已验证的数据，返回 `{ success: true/false, ... }`。框架不强制这种分层，这是项目自己的架构约定。

### 2.3 参数校验在哪里

| 校验类型 | 位置 | 框架机制 |
|---------|------|---------|
| 字段存在性检查 | 云函数 `exports.main` 中第一个步骤，调用 `validate()` 函数 | 没有框架内置校验器，通过手工函数实现 |
| 手机号格式 | `utils/util.js` 的 `isValidPhone()` | 正则 `/^1[3-9]\d{9}$/` |
| 客户端表单校验 | 各页面的 `onSubmit()` 中，调用云函数前 | `wx.showToast({ title: '请填写完整信息' })` 拦截 |

**校验函数的位置约定**：
```
cloudfunctions/函数名/index.js
├── exports.main          ← 调用 validate(event)
├── function validate()   ← 校验逻辑（<30行放这里）
└── 或 validate.js        ← 校验逻辑（>30行拆出单独文件）
```

**关键理解**：CloudBase 没有像 Express 的 `express-validator` 或 Spring 的 `@Valid` 这样的校验框架。校验是通过接收 `event`、逐字段检查、返回 `{ valid, error }` 的手工函数实现的。这是框架本身的限制，不是项目偷懒。

### 2.4 数据访问在哪里

| 数据操作 | 位置 | 框架机制 |
|---------|------|---------|
| 所有数据库读写 | 云函数内部，直接调用 `db.collection('xxx').xxx()` | `wx-server-sdk` 的 `db` 对象 |
| 读操作（查询） | 业务函数 `doXxx()` 中 | `db.collection().where().get()` |
| 写操作（增删改） | 业务函数 `doXxx()` 中 | `db.collection().add()` / `.doc().update()` / `.doc().remove()` |
| 原子操作（增减、追加） | 业务函数中 | `db.command.inc()` / `db.command.push()` |
| 客户端本地数据 | `utils/demoStore.js`（Demo 模式）或 `wx.getStorageSync()` | 微信小程序 Storage API |

**关键理解**：本项目**没有**在 `db.collection()` 之上再封装一层 Repository 或 DAO。原因是 CloudBase SDK 的 `db` 对象已经封装了连接管理、权限过滤、序列化。再加一层抽象的收益为零，只会增加代码量和 bug 面。

**数据层 = `db` 对象本身**。这就是框架提供的全部数据访问能力。

### 2.5 错误处理在哪里

| 层级 | 位置 | 框架机制 |
|------|------|---------|
| **Layer 1 — 云函数异常** | 每个云函数 `exports.main` 的 `catch(err)` 块 | JavaScript 原生 try/catch |
| **Layer 2 — 客户端网络错误** | 每个 Page 方法的 `catch(err)` 块 | `wx.cloud.callFunction` 的 Promise catch |
| **Layer 3 — 全局兜底** | `app.js` 的 `initErrorListener()` | `wx.onError` + `wx.onUnhandledRejection` |

**三层结构**（代码角度）：

```
cloudfunctions/xxx/index.js:
  exports.main = async (event) => {
    try { ... }                              ← Layer 1
    catch (err) {
      logger.error('函数名', err, {...})      ← 记日志
      return res.internalError()             ← 返回中文提示
    }
  }

pages/xxx/xxx.js:
  async loadData() {
    try { ... }                              ← Layer 2
    catch (err) {
      wx.showToast({ title: '网络错误' })     ← 提示用户
      console.error('[loadData]', ...)       ← 记控制台
    }
  }

app.js:
  wx.onError((err) => { ... })              ← Layer 3
  wx.onUnhandledRejection((res) => { ... })
```

**关键理解**：CloudBase 没有全局异常处理器或中间件。错误处理是通过 JavaScript 原生的 try/catch 在每一层手工实现的。`logger.error()` 是我们自己加的（不是框架内置），`res.internalError()` 是我们约定的返回格式（不是框架强制的）。

### 2.6 权限校验入口在哪里

| 校验类型 | 唯一入口 | 文件位置 | 框架机制 |
|---------|---------|---------|---------|
| 客户身份（openid 是否存在） | `auth.requireOpenid()` | `cloudfunctions/lib/auth.js` | `cloud.getWXContext().OPENID` |
| 管理员身份（openid + admins 表登录态） | `auth.requireAdmin()` | `cloudfunctions/lib/auth.js` | 同上 + `db.collection('admins').where({...}).get()` |

**调用方式**（在云函数 `exports.main` 中）：
```js
const authResult = await auth.requireAdmin();
if (!authResult.authorized) return authResult.response;
```

**为什么只有一个入口**：
- 如果有 15 个管理云函数各自写鉴权代码，改鉴权规则（比如增加 IP 白名单）需要改 15 个文件。
- 统一到 `lib/auth.js` 后，只改一个文件。这是架构文档 §6.4 的强制规则。

**哪些云函数不需要鉴权**：
- `getProducts` — 公开产品目录
- `adminLogin` — 登录本身
- `customerCRUD.getByPhone` — 结算页匹配折扣
- `customerCRUD.upsert` — 下单后自动录入
- `seedAdmin` / `initAdminAccounts` — 首次手动调用

---

## 三、新增文件时的决策速查

当你要新增代码时，按以下顺序判断放哪里：

```
新增代码 →
  │
  ├─ 是前端页面？
  │   └─ pages/{业务域}/{功能名}/  → 建 4 个文件 → app.json 注册
  │
  ├─ 是后端处理逻辑？
  │   └─ cloudfunctions/{函数名}/  → 建 3 个文件 → cloudbaserc.json 注册
  │       └─ 逻辑很复杂？
  │           ├─ 校验 > 30 行 → 拆出 validate.js
  │           └─ 业务 > 60 行 → 拆出 biz/ 目录
  │
  ├─ 是多个云函数共用的？
  │   └─ cloudfunctions/lib/{功能名}.js
  │
  ├─ 是多个页面共用的工具？
  │   └─ utils/{功能名}.js
  │
  ├─ 是常量/配置？
  │   ├─ 业务常量（分类、状态）→ utils/constants.js
  │   ├─ 密钥/外部 Key        → utils/config.js
  │   └─ 部署配置              → cloudbaserc.json
  │
  └─ 是文档？
      ├─ 架构相关   → docs/xxx.md
      ├─ 编码规范   → docs/standards/xxx.md
      └─ 教程       → docs/新手教程.md
```
