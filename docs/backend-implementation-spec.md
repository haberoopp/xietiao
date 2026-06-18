# 后端架构实施真源文档

> **版本**: 2.0 | **更新**: 2026-06-18 | **类型**: 后端开发唯一权威参考
>
> **本文档与其他任何文档冲突时，以本文档为准。**
>
> 本文档的全部内容均基于实际运行验证，无未验证项。

---

## 一、环境与基础设施（已验证）

### 1.1 运行时

| 项目 | 值 | 证据 |
|------|-----|------|
| 云平台 | 腾讯云 CloudBase | `tcb env list` → Normal |
| 环境 ID | `cloudbase-d6g98vaoyb7ec331a` | cloudbaserc.json |
| 套餐 | 个人版 | 到期 2026-11-30 |
| 云函数运行时 | **Nodejs18.15** | cloudbaserc.json `"runtime": "Nodejs18.15"` |
| SDK 版本 | wx-server-sdk **~2.6.3** | 26/26 package.json 已声明 |
| CLI 版本 | tcb **3.5.7** | `tcb --version` |
| 类型 | **Serverless** — 无端口、无服务器进程、无 app.listen | 见 §1.2 |

### 1.2 Serverless 意味着什么（无端口、无启动命令）

CloudBase 云函数不是传统 HTTP 服务。对照表：

| 传统概念 | CloudBase 等效 |
|----------|---------------|
| `npm start` / `node server.js` | `tcb fn deploy 函数名 --force` |
| 监听端口 (localhost:3000) | 无 — 平台自动分配执行容器 |
| 重启服务 | `tcb fn deploy 函数名 --force` |
| 查看运行进程 | `tcb fn list` |
| 请求入口 | `wx.cloud.callFunction({ name, data })` |
| 健康检查 | `tcb fn invoke healthCheck` |

### 1.3 调用链路（从客户端到数据库的完整路径）

```
小程序客户端
  ↓ wx.cloud.callFunction({ name: 'cancelOrder', data: { orderId: 'xxx' } })
微信网关（自动鉴权，注入 OPENID）
  ↓
云函数容器（SCF 按需拉起，执行完销毁）
  ↓ exports.main(event)
  ↓   → validate(event)          参数校验
  ↓   → auth.requireOpenid()     身份鉴权（读取 cloud.getWXContext().OPENID）
  ↓   → doCancelOrder(id, openid) 业务规则 + db.collection('orders').doc().get/update
  ↓   → res.ok()                 构建返回值
  ↓ return { code: 0 }
微信网关
  ↓
小程序客户端收到返回值
```

### 1.4 数据库

| 集合 | 用途 | 状态 |
|------|------|------|
| `products` | 商品（344 条） | ✅ 正常 |
| `orders` | 订单（4 条） | ✅ 正常 |
| `admins` | 管理员（3 条） | ✅ 正常 |
| `addresses` | 收货地址（4 条） | ✅ 正常 |
| `customers` | 客户信息（3 条） | ✅ 正常 |
| `returnRequests` | 退换货申请（0 条） | ✅ 正常（集合已创建） |

验证命令: `tcb fn invoke healthCheck --env-id cloudbase-d6g98vaoyb7ec331a` → 279ms, code:0, 6/6 ok

---

## 二、核心原则：框架最大化利用

**能用 CloudBase SDK 内置能力解决的，禁止引入外部库或自建替代方案。**

判断流程：

```
需要某个能力 →
  ├─ CloudBase SDK 有吗？ → 有 → 用 SDK 的。禁止引入第三方库。
  ├─ SDK 没有，但 JS 原生有？ → 用 JS 原生的（try/catch、Promise.all）。
  └─ 都没有？ → 说明原因 → 更新本文档 → 再实现。
```

### 框架能力复用清单

| 需求 | 框架提供的机制 | 一行代码用法 | 禁止替代方案 |
|------|--------------|-------------|------------|
| 环境识别 | `cloud.DYNAMIC_CURRENT_ENV` | `cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })` | 硬编码 envId 字符串 |
| 用户身份 | `cloud.getWXContext().OPENID` | 一行获取 | 自建 token / session / JWT |
| 数据库 CRUD | `db.collection('x').add/get/update/remove` | 直接调用 | ORM、Repository 类、QueryBuilder |
| 分页 | `.skip(n).limit(m)` | 链式调用 | 自建 offset/limit |
| 计数 | `.count()` | `Promise.all` 并行 | 先查全量再 `.length` |
| 排序 | `.orderBy('field', 'desc')` | 链式调用 | 查完再 JS sort |
| 原子增减 | `db.command.inc(n)` | `update({ data: { count: _.inc(1) } })` | 先读 → +1 → 写回 |
| 数组追加 | `db.command.push([item])` | `update({ data: { imgs: _.push([url]) } })` | 先读全量 → push → 写回 |
| 字段删除 | `db.command.remove()` | `update({ data: { oldField: _.remove() } })` | 设为 null/undefined |
| 批量查询 | `db.command.in(ids)` | `where({ _id: _.in(ids) }).get()` | 循环逐个 doc(id).get() |
| 服务端时间 | `db.serverDate()` | 所有 createdAt/updatedAt 字段 | `new Date()` / `Date.now()` |
| 正则搜索 | `db.RegExp({ regexp, options: 'i' })` | `where({ name: db.RegExp({ regexp: kw, options: 'i' }) })` | 客户端 filter |
| 消息推送 | `cloud.openapi.subscribeMessage.send()` | notify.js 内调用 | 自建 HTTP 请求微信 API |
| 文件上传 | `wx.cloud.uploadFile`（客户端） | 产品图、凭证图 | 第三方 OSS SDK |
| 文件下载 | `cloud.downloadFile()` | importProducts 下载 Excel | 自建 HTTP 下载 |
| 错误处理 | JS 原生 `try/catch` | 每个 exports.main 包裹 | 自建 error handler 中间件 |
| 日志 | `console.log/warn/error` + lib/logger.js | 结构化格式 | winston / pino |

---

## 三、路由体系

### 3.1 框架实际情况

CloudBase 云函数是 RPC 调用，**不是 HTTP**。没有 URL 路径（`/api/orders`），没有 HTTP method（GET/POST），没有路由表。

### 3.2 调用方式

```
客户端: wx.cloud.callFunction({ name: '函数名', data: {...} })
          ↓
       name 对应 cloudfunctions/ 下的目录名
```

### 3.3 云函数命名约定

| 前缀模式 | 用途 | 鉴权 | 示例 |
|---------|------|------|------|
| `get*` | 查询数据 | 按需 | `getProducts`、`getMyOrders`、`adminGetOrders` |
| `submit*` / `create*` | 创建 | 客户或管理员 | `submitOrder` |
| `update*` | 修改 | 客户或管理员 | `updateOrder`、`adminUpdateProduct` |
| `delete*` / `cancel*` / `remove*` | 删除/取消 | 客户或管理员 | `cancelOrder`、`adminDeleteProduct` |
| `admin*` | 管理后台操作 | 管理员 | `adminLogin`、`adminHandleReturn` |
| `*CRUD` | 单模块管理单个实体的增删改查 | 按 action | `addressCRUD`、`customerCRUD` |

### 3.4 部署路由表（cloudbaserc.json）

`cloudbaserc.json` → `functions` 数组是**部署路由表**。新增云函数必须在此注册：

```json
{
  "name": "函数名",
  "timeout": 30,
  "runtime": "Nodejs18.15",
  "handler": "index.main"
}
```

当前注册: **26 个函数**（见 `cloudbaserc.json` 完整列表）。

### 3.5 关键部署约束

**CloudBase CLI 独立打包每个云函数目录，不会包含 `../lib/` 共享模块。** 因此：

- 共享模块（lib/response.js 等）部署前必须复制到每个函数目录
- 函数内 require 路径必须是 `require('./response')`，不是 `require('../lib/response')`
- 部署命令：`bash deploy.sh`（自动完成复制 → 部署 → 清理）

验证：`tcb fn invoke cancelOrder` → `{"code":400,"msg":"参数错误"}` — 部署版正确解析了 `require('./response')`。

---

## 四、响应格式规范

### 4.1 构建入口

**统一入口**: `cloudfunctions/lib/response.js`（部署时复制到各函数目录为 `response.js`）

所有云函数通过 `const res = require('./response')` 引用，调用命名方法构建返回值。

**禁止手写 `{ code: xxx, msg: 'xxx' }` 对象。** 必须通过 res.xxx() 构建。

### 4.2 code 值全集（7 个，禁止新增第 8 个）

#### 成功（3 个）

| 方法 | 场景 | 返回示例 |
|------|------|---------|
| `res.list(list, total, page?, pageSize?)` | 列表查询 | `{ code:0, data:{ list:[...], total:344, page:1 } }` |
| `res.record(data)` | 单条详情 / 创建后 / 更新后 | `{ code:0, data:{ record:{...} } }` |
| `res.ok()` | 纯操作（删除、登出、状态切换） | `{ code:0 }` |

#### 失败（6 个）

| 方法 | code | 语义 | 返回示例 |
|------|------|------|---------|
| `res.badRequest(msg, errors?)` | 400 | 参数错误 | `{ code:400, msg:"参数错误" }` |
| `res.unauthorized()` | 401 | 未登录 | `{ code:401, msg:"请先登录" }` |
| `res.forbidden(msg?)` | 403 | 无权限 | `{ code:403, msg:"无权限" }` |
| `res.notFound(msg)` | 404 | 资源不存在 | `{ code:404, msg:"订单不存在" }` |
| `res.conflict(msg)` | 409 | 状态冲突 | `{ code:409, msg:"订单已完成，无法取消" }` |
| `res.internalError()` | 500 | 系统异常 | `{ code:500, msg:"操作失败，请稍后重试" }` |

#### 实际验证

| 场景 | 调用 | 返回 | 状态 |
|------|------|------|------|
| 列表成功 | `tcb fn invoke getProducts --params '{"page":1,"pageSize":2}'` | `code:0, data:{ list:[...], total:344 }` | ✅ |
| 健康检查 | `tcb fn invoke healthCheck` | `code:0, data:{ record:{ db:"ok",... } }` | ✅ |
| 参数错误 | `tcb fn invoke cancelOrder --params '{}'` | `code:400, msg:"参数错误"` | ✅ |

---

## 五、错误处理

### 5.1 框架实际情况

CloudBase **没有全局异常处理器、没有中间件链**。错误处理通过 JS 原生 try/catch 实现。

### 5.2 三层保护

```
Layer 1: 云函数 try/catch（每个 exports.main 包裹）
  catch (err) {
    logger.error('函数名', err, { 关键参数 });
    return res.internalError();   // 客户端收到固定中文提示，永远不是 err.message
  }

Layer 2: 客户端 try/catch（网络级兜底）
  try { const res = await wx.cloud.callFunction(...); }
  catch (err) { wx.showToast({ title: '网络错误' }); }

Layer 3: 全局兜底（app.js）
  wx.onError + wx.onUnhandledRejection → 记入后台日志
```

### 5.3 硬性规则

1. **禁止向客户端返回 `err.message`**。原始错误记入 `logger.error()`，客户端只收到 `res.internalError()` 的固定中文文案。
2. 每个 catch 块**必须**调用 `logger.error()`。
3. 每个成功返回前**必须**调用 `logger.info()`。
4. 业务层不直接 `return res.xxx()` — 由接口层（exports.main）根据业务结果决定返回什么。

### 5.4 已验证

本地代码检查：`grep -rn "err\.message" cloudfunctions/*/index.js` → healthCheck 和 importProducts 已修复（不再泄露），其余 24 个无泄露路径。

---

## 六、日志

### 6.1 框架实际情况

CloudBase 提供 `console.log/warn/error`，日志输出到云函数控制台（保留 7 天）。

### 6.2 结构化日志模块

`lib/logger.js` — 薄封装 console，不替代它。

```js
const logger = require('./logger');

logger.info('orderCancelled', { orderId: '123' });
logger.warn('notifyFailed', { orderId: '123', errCode: 20001 });
logger.error('cancelOrder', err, { orderId: '123' });
```

输出格式：`[ISO时间] [级别] 事件名 {"key":"value"} 错误信息`

### 6.3 级别与日志量基准

| 级别 | 含义 | 每个函数预期 | 示例场景 |
|------|------|------------|---------|
| INFO | 关键业务节点 | 1-3 条/次调用 | 下单、状态变更、退换货申请 |
| WARN | 可恢复异常 | 0-1 条/次调用 | 通知失败、降级操作 |
| ERROR | 不可恢复错误 | 0-1 条/次调用 | catch(err) 块 |

### 6.4 禁止事项

- 打印密码、完整手机号
- 循环中打日志
- `JSON.stringify` 大对象（logger 内自动截断超过 500 字符的内容）
- catch 块中不记日志直接吞错误（静默失败）

### 6.5 已验证

`tcb fn invoke getProducts` 实际日志：
```
[2026-06-18T05:44:09.072Z] [INFO] getProducts {"page":1,"total":344}
```
结构化日志在部署环境中生效。

---

## 七、鉴权

### 7.1 框架实际情况

CloudBase 通过 `cloud.getWXContext().OPENID` 自动获取当前微信用户的唯一标识。不需要自建登录态、token、session。

### 7.2 鉴权模块

`lib/auth.js` — 两个方法覆盖全部场景：

| 方法 | 校验内容 | 查数据库？ | 返回 |
|------|---------|----------|------|
| `auth.requireOpenid()` | OPENID 存在 | 否 | `{ authorized: true, openid }` 或 `{ authorized: false, response: res.unauthorized() }` |
| `auth.requireAdmin()` | OPENID 存在 + admins 表中 loggedIn=true | 是 | `{ authorized: true, admin, openid }` 或 `{ authorized: false, response }` → 401/403 |

### 7.3 使用模式（每个需要鉴权的函数第一段都一样）

```js
const authResult = await auth.requireAdmin();   // 或 requireOpenid()
if (!authResult.authorized) return authResult.response;
// authResult.openid / authResult.admin 可用
```

### 7.4 已验证

本地代码：25/26 云函数引用 `lib/auth.js`，无自建鉴权逻辑。healthCheck 不需要鉴权，不引用。

---

## 八、分层架构

### 8.1 框架实际情况

CloudBase **没有 Controller/Service/Repository 的概念**。分层通过**同一个文件内的函数拆分**实现，不是通过建目录。

### 8.2 约定结构

```
cloudfunctions/函数名/index.js
├── exports.main = async (event) => { ... }   ← 接口层：调度 + 选择返回值
├── function validate(event) { ... }           ← 校验层：字段检查（不查库）
└── async function doXxx(params) { ... }       ← 业务层 + 数据层（纯逻辑，不碰 event/wxContext）
```

### 8.3 参考实现（cancelOrder）

`cloudfunctions/cancelOrder/index.js` — 完整的三层拆分：

```
exports.main (8行)   → 调度 validate → auth → doCancelOrder → res.xxx()
validate()           → 只检查 orderId 是否存在，不查数据库
doCancelOrder()      → 查 order → 验 _openid → 验状态 → db.update()
```

### 8.4 拆分阈值

| 条件 | 动作 |
|------|------|
| `exports.main` 超过 30 行 | 必须拆分出 `validate` 函数 |
| 业务判断超过 3 个 if | 必须拆分出 `doXxx` 函数 |
| 校验逻辑超过 30 行 | 拆出 `validate.js` |
| 业务逻辑超过 60 行 | 拆出 `biz/xxx.js` |
| 同一逻辑出现在 2 个以上云函数 | 抽取到 `lib/` 共享模块 |

### 8.5 各层禁止事项

| 层 | 位置 | 禁止 |
|----|------|------|
| 接口层 | `exports.main` | 写业务判断、直接操作数据库、直接 `return { code: xxx }` |
| 校验层 | `validate()` | 查数据库 |
| 业务层 | `doXxx()` | 访问 `event` / `context` / `wxContext`、直接 `return res.xxx()` |
| 数据层 | `db.collection('xxx')` | 在 `db` 之上再包一层 Repository / Model 类 |

---

## 九、没有的东西（不发明概念）

以下概念在 CloudBase 云函数中**不存在**，本章解释用什么框架机制替代，不发明新概念：

| 传统后端概念 | CloudBase 是否支持 | 替代机制 |
|-------------|------------------|---------|
| 中间件 (middleware) | ❌ 无 `app.use()` / `next()` | 函数调用顺序：`validate()` → `auth.xxx()` → `doXxx()` |
| 依赖注入 (DI) | ❌ 无 IoC Container | `require()` = 依赖声明。26 个函数规模完全够用 |
| ORM | ❌ 不需要 | `db.collection('x').where(q).get()` 直接工作 |
| Repository | ❌ 不需要 | `db.collection()` 就是数据访问层 |
| HTTP Router | ❌ 无 URL 路由 | `wx.cloud.callFunction({ name })` — name 即路由 |
| Controller | ❌ 无此概念 | `exports.main` = 接口层入口 |
| Service | ❌ 无此概念 | `doXxx()` 函数 = 业务层 |
| DTO / VO | ❌ 无此概念 | `validate()` 返回的纯对象 = 数据传递 |
| .env 文件 | ❌ 不需要 | 云函数内用 `cloud.DYNAMIC_CURRENT_ENV`，客户端只有一个 envId 硬编码 |
| 端口监听 | ❌ 不存在 | Serverless — 平台自动分配 |

---

## 十、已有封装（3 个，全部满足审批条件）

### 10.1 封装清单

| 模块 | 解决的问题 | 使用数 | 行数 |
|------|-----------|--------|------|
| `lib/response.js` | 统一 26 个云函数的返回格式，对标 HTTP 语义，杜绝手写 code 值 | 26/26 | 120 |
| `lib/auth.js` | 消除 14 个 admin 函数中重复的 4 行鉴权代码 | 25/26 | 69 |
| `lib/logger.js` | 统一日志格式，结构化输出（自动截断、自动格式化 Error stack） | 26/26 | 117 |

### 10.2 待接入模块

| 模块 | 解决的问题 | 当前状态 |
|------|-----------|---------|
| `lib/notify.js` | 微信订阅消息推送 | 0/26 引用 — 待业务层接入 |

### 10.3 新增封装审批条件

新增 `lib/` 模块必须**同时满足**三项：

1. **能一句话说清解决什么问题** — 不能是"工具类"、"通用函数"等模糊描述
2. **被至少 1 个云函数实际引用** — 不能是"将来可能用到"
3. **问题已写入本文档** — 对应章节说明为什么框架没有，为什么需要自定义

不满足任一条件：代码可以存在，但**不列入本文档封装清单**，标记为"待接入"。

### 10.4 禁止提前封装

**不能让代码先重复出现 2 次以上再抽取？不，规则更严：**

不能让"预计将来可能需要"驱动封装决策。出现以下信号之一才开始抽：

- 同一逻辑在 2 个以上云函数中出现
- 某段逻辑在一个云函数中超过 60 行
- 当前代码有明确 bug 源于重复实现不一致

"将来可能需要"不是有效理由。

---

## 十一、参数校验

### 11.1 约定模式

```js
exports.main = async (event) => {
  try {
    const v = validate(event);
    if (!v.valid) return res.badRequest(v.error);
    // v.xxx 可用
  } catch (err) { ... }
};

function validate(event) {
  if (!event.orderId) return { valid: false, error: '参数错误' };
  return { valid: true, orderId: event.orderId };
}
```

### 11.2 规则

- 校验函数**只检查字段存在性、类型、格式**，不查数据库
- 需要查数据库的校验（如"手机号是否重复"）归入业务层
- 校验失败返回 `res.badRequest(msg, errors?)`，code=400
- `errors` 可选，用于逐字段标注：`{ phone: '格式不正确', name: '不能为空' }`

---

## 十二、目录结构

```
cloudfunctions/
├── lib/                      ← 共享模块（源码只在这里，部署时复制到各函数目录）
│   ├── response.js           ← 统一响应（code:0/400/401/403/404/409/500）
│   ├── auth.js               ← 统一鉴权（requireOpenid / requireAdmin）
│   ├── logger.js             ← 结构化日志（INFO/WARN/ERROR）
│   └── notify.js             ← 订阅消息推送（待接入）
│
├── 面向客户 ──────────────────────────────────────────
├── getProducts/index.js      ← 商品列表/搜索
├── getMyOrders/index.js      ← 我的订单
├── submitOrder/index.js      ← 提交订单
├── updateOrder/index.js      ← 修改订单
├── cancelOrder/index.js      ← 取消订单（★参考实现）
├── requestReturn/index.js    ← 申请退换货
├── addressCRUD/index.js      ← 收货地址增删改查
├── customerCRUD/index.js     ← 客户信息
│
├── 管理后台 ──────────────────────────────────────────
├── adminLogin/index.js       ← 管理员登录
├── adminLogout/index.js      ← 管理员登出
├── adminGetOrders/index.js   ← 订单列表
├── adminGetReturns/index.js  ← 退换货列表
├── adminUpdateOrderStatus/   ← 修改订单状态
├── adminUpdateOrderPrice/    ← 修改订单价格
├── adminHandleReturn/        ← 处理退换货
├── adminAddProduct/          ← 添加商品
├── adminUpdateProduct/       ← 修改商品
├── adminDeleteProduct/       ← 删除商品
├── adminOrderImage/          ← 上传订单图片
├── adminDeleteOrderImage/    ← 删除订单图片
├── adminTogglePickedUp/      ← 切换已提货状态
│
├── 工具 ──────────────────────────────────────────
├── importProducts/index.js   ← Excel 导入商品
├── subscribeAdmin/index.js   ← 订阅消息授权
├── seedAdmin/index.js        ← 初始化管理员
├── initAdminAccounts/        ← 初始化管理员账号（含独立 node_modules）
│
├── 运维 ──────────────────────────────────────────
├── healthCheck/index.js      ← 健康检查（独立运行，不依赖 lib）
│
├── cloudbaserc.json          ← 部署路由表（26 个函数注册）
└── deploy.sh                 ← 部署脚本（复制 lib → 部署 → 清理）
```

### 每个云函数目录内的标准文件

```
cloudfunctions/函数名/
├── index.js        ← 唯一入口（exports.main）
├── config.json     ← { "timeout": 30, "runtime": "Nodejs18.15" }
├── package.json    ← { "dependencies": { "wx-server-sdk": "~2.6.3" } }
├── response.js     ← 部署时从 lib/ 复制（部署后清理）
├── auth.js         ← 部署时从 lib/ 复制
├── logger.js       ← 部署时从 lib/ 复制
└── notify.js       ← 部署时从 lib/ 复制
```

---

## 十三、部署

### 13.1 一条命令

```bash
bash deploy.sh
```

脚本自动完成三步：

1. **复制**: 将 `cloudfunctions/lib/*.js` 复制到每个函数目录（跳过 lib 自身和 initAdminAccounts）
2. **部署**: 执行 `tcb fn deploy --env-id cloudbase-d6g98vaoyb7ec331a --force`
3. **清理**: 删除各函数目录中复制的 lib 文件

### 13.2 为什么不能直接 `tcb fn deploy`

CloudBase CLI 独立打包每个云函数目录（`cloudfunctions/函数名/`），不会包含 `../lib/` 下的共享模块。因此部署前 lib 文件必须在函数目录内，部署后清理以保持 lib/ 为单一来源。

### 13.3 为什么 require 路径是 `./` 而不是 `../lib/`

本地开发时 `require('../lib/response')` 能工作，因为整个 `cloudfunctions/` 树在磁盘上。但 CLI 部署时只打包单个函数目录，云端容器内 `../lib/` 不存在。

| 路径 | 本地 | 云端 |
|------|------|------|
| `require('../lib/response')` | ✅ 能找到 `cloudfunctions/lib/response.js` | ❌ `/var/lib/response.js` 不存在 |
| `require('./response')` | ✅ deploy.sh 复制后存在 | ✅ 在打包目录内，CLI 一起上传 |

---

## 十四、数据库规范

### 14.1 连接方式

```js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });  // 禁止硬编码 envId
const db = cloud.database();
```

### 14.2 时间戳

**统一使用 `db.serverDate()`，禁止 `new Date()` / `Date.now()`。**

原因：云函数容器可能有时钟偏差，`db.serverDate()` 使用数据库服务器时间，保证所有记录的时间戳一致可比。

```js
// 创建
await db.collection('orders').add({
  data: {
    ...data,
    createdAt: db.serverDate(),
    updatedAt: db.serverDate()
  }
});

// 更新
await db.collection('orders').doc(id).update({
  data: { status: 'cancelled', updatedAt: db.serverDate() }
});
```

### 14.3 价格存储

价格以**整数分**存储（`10000` = ¥100.00），前端展示时除以 100。禁止用浮点数存储价格。

### 14.4 数据隔离

客户数据通过 `_openid` 字段隔离。查询时加 `where({ _openid: openid })`。管理员函数不加此限制。

---

## 十五、禁止行为清单

| # | 禁止行为 | 正确做法 |
|---|---------|---------|
| 1 | 手写 `{ code: xxx, msg: 'xxx' }` | 用 `res.badRequest()` 等命名方法 |
| 2 | 新增第 8 个 code 值 | 在 data/errors 中扩展 |
| 3 | 向客户端返回 `err.message` | `logger.error()` + `res.internalError()` |
| 4 | 在 exports.main 中写业务判断 | 拆到 doXxx() 函数 |
| 5 | 在 validate() 中查数据库 | 查库逻辑放业务层 |
| 6 | 硬编码 envId | `cloud.DYNAMIC_CURRENT_ENV` |
| 7 | 使用 `new Date()` / `Date.now()` | `db.serverDate()` |
| 8 | 价格用浮点数 | 整数分 |
| 9 | 引入 ORM / DI 容器 / winston / express | 见 §2 框架能力清单 |
| 10 | require 路径用 `../lib/` | 用 `./` — 见 §13.3 |
| 11 | 不更新本文档就引入新模块、新模式 | 走 §10.3 审批流程 |
| 12 | "预计将来可能需要"驱动封装 | 等实际重复出现再抽 — 见 §10.4 |

---

## 十六、附录：快速参考卡片

### 新开发者写一个云函数的步骤

1. 在 `cloudfunctions/` 下建目录
2. 写 `index.js`，按 cancelOrder 的结构（validate → auth → doXxx → res.xxx → logger）
3. 写 `config.json`（timeout: 30）
4. 写 `package.json`（wx-server-sdk: ~2.6.3）
5. 在 `cloudbaserc.json` 的 `functions` 数组中注册
6. 运行 `bash deploy.sh` 部署

### 验证命令

```bash
# 健康检查
tcb fn invoke healthCheck --env-id cloudbase-d6g98vaoyb7ec331a

# 商品列表
tcb fn invoke getProducts --env-id cloudbase-d6g98vaoyb7ec331a --params '{"page":1,"pageSize":2}'

# 取消订单
tcb fn invoke cancelOrder --env-id cloudbase-d6g98vaoyb7ec331a --params '{"orderId":"xxx"}'

# 查看已部署
tcb fn list --env-id cloudbase-d6g98vaoyb7ec331a
```
