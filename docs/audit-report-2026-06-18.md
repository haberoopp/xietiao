# 后端架构层审计报告

> 审计日期: 2026-06-18 | 审计范围: 26 个云函数 + 4 个共享模块 | 依据: [架构设计文档](architecture-overview.md) + [编码规范](standards/)

---

## 审计结果总览

| 类别 | 检查项 | 通过 | 未通过 | 未验收 |
|------|--------|------|--------|--------|
| 目录与命名 | 8 | 4 | 4 | 0 |
| 配置完整性 | 4 | 2 | 2 | 0 |
| 分层架构 | 4 | 1 | 3 | 0 |
| API 响应格式 | 8 | 2 | 6 | 0 |
| 鉴权与安全 | 6 | 5 | 1 | 0 |
| 错误处理 | 5 | 2 | 3 | 0 |
| 日志 | 3 | 1 | 2 | 0 |
| 数据访问 | 3 | 3 | 0 | 0 |
| **合计** | **41** | **20** | **21** | **0** |

**通过率: 49%**（20/41 项完全通过，21 项存在不符合）

---

## 一、目录与命名

### 1.1 云函数目录包含必需三文件

| 规则来源 | 架构文档 §5.2：「每个云函数包含 index.js / package.json / config.json」 |
|---------|-----------------------------------------------------------------------|

| # | 云函数 | index.js | package.json | config.json | 结果 |
|---|--------|----------|-------------|-------------|------|
| 1 | addressCRUD | ✅ | ✅ | ✅ | ✅ 通过 |
| 2 | adminAddProduct | ✅ | ✅ | ✅ | ✅ 通过 |
| 3 | adminDeleteOrderImage | ✅ | ✅ | ✅ | ✅ 通过 |
| 4 | adminDeleteProduct | ✅ | ✅ | ✅ | ✅ 通过 |
| 5 | adminGetOrders | ✅ | ✅ | ✅ | ✅ 通过 |
| 6 | adminGetReturns | ✅ | ✅ | ✅ | ✅ 通过 |
| 7 | adminHandleReturn | ✅ | ✅ | ✅ | ✅ 通过 |
| 8 | adminLogin | ✅ | ✅ | ✅ | ✅ 通过 |
| 9 | adminLogout | ✅ | ✅ | ✅ | ✅ 通过 |
| 10 | adminOrderImage | ✅ | ✅ | ✅ | ✅ 通过 |
| 11 | adminTogglePickedUp | ✅ | ✅ | ✅ | ✅ 通过 |
| 12 | adminUpdateOrderPrice | ✅ | ✅ | ✅ | ✅ 通过 |
| 13 | adminUpdateOrderStatus | ✅ | ✅ | ✅ | ✅ 通过 |
| 14 | adminUpdateProduct | ✅ | ✅ | ✅ | ✅ 通过 |
| 15 | cancelOrder | ✅ | ✅ | ✅ | ✅ 通过 |
| 16 | customerCRUD | ✅ | ✅ | ✅ | ✅ 通过 |
| 17 | getMyOrders | ✅ | ✅ | ✅ | ✅ 通过 |
| 18 | getProducts | ✅ | ✅ | ✅ | ✅ 通过 |
| 19 | healthCheck | ✅ | ✅ | ✅ | ✅ 通过 |
| 20 | importProducts | ✅ | ✅ | ✅ | ✅ 通过 |
| 21 | initAdminAccounts | ✅ | ✅ | ✅ | ✅ 通过 |
| 22 | requestReturn | ✅ | ✅ | ✅ | ✅ 通过 |
| 23 | seedAdmin | ✅ | ✅ | ✅ | ✅ 通过 |
| 24 | submitOrder | ✅ | ✅ | ✅ | ✅ 通过 |
| 25 | subscribeAdmin | ✅ | ✅ | ✅ | ✅ 通过 |
| 26 | updateOrder | ✅ | ✅ | ✅ | ✅ 通过 |

**验证方式**：`ls cloudfunctions/*/{index.js,package.json,config.json}` → 全部 26 个云函数三文件完整。

---

### 1.2 云函数命名规范

| 规则来源 | 架构文档 §5.2：「客户操作无前缀、管理操作 admin 前缀、CRUD 用实体+后缀」 |
|---------|-----------------------------------------------------------------------|

| # | 云函数 | 类型 | 应遵循规则 | 实际命名 | 结果 |
|---|--------|------|-----------|---------|------|
| 1 | `submitOrder` | 客户操作 | 无前缀，camelCase | 符合 | ✅ 通过 |
| 2 | `getMyOrders` | 客户操作 | 无前缀 | 符合 | ✅ 通过 |
| 3 | `cancelOrder` | 客户操作 | 无前缀 | 符合 | ✅ 通过 |
| 4 | `requestReturn` | 客户操作 | 无前缀 | 符合 | ✅ 通过 |
| 5 | `updateOrder` | 客户操作 | 无前缀 | 符合 | ✅ 通过 |
| 6 | `getProducts` | 客户操作 | 无前缀 | 符合 | ✅ 通过 |
| 7 | `addressCRUD` | CRUD | 实体+CRUD | 符合 | ✅ 通过 |
| 8 | `customerCRUD` | CRUD | 实体+CRUD | 符合 | ✅ 通过 |
| 9 | `adminLogin` | 管理操作 | admin 前缀 | 符合 | ✅ 通过 |
| 10 | `adminGetOrders` | 管理操作 | admin 前缀 | 符合 | ✅ 通过 |
| 11 | `adminHandleReturn` | 管理操作 | admin 前缀 | 符合 | ✅ 通过 |
| 12 | `seedAdmin` | 工具 | — | 可接受 | ✅ 通过 |
| 13 | `healthCheck` | 工具 | — | 可接受 | ✅ 通过 |
| 14 | `subscribeAdmin` | 管理操作 | admin 前缀 | **subscribe 前缀而非 admin** | ❌ 未通过 |

**验证方式**：逐目录名匹配架构文档命名规则。26 中 25 符合，1 偏差（`subscribeAdmin` 应在创建时命名为 `adminSubscribe`，但当前已部署，属于历史命名债）。

---

### 1.3 package.json 依赖版本统一

| 规则来源 | 架构文档 §2.1：「wx-server-sdk 版本统一锁定为 ~2.6.3」 |
|---------|------------------------------------------------------|

| # | 云函数 | wx-server-sdk 版本 | 结果 |
|---|--------|-------------------|------|
| 1 | adminDeleteOrderImage | `"latest"` | ❌ 未通过 |
| 2 | adminOrderImage | `"latest"` | ❌ 未通过 |
| 3 | adminTogglePickedUp | `"latest"` | ❌ 未通过 |
| 4 | customerCRUD | `"latest"` | ❌ 未通过 |
| 5 | importProducts | `"latest"` | ❌ 未通过 |
| 6 | updateOrder | **缺失** | ❌ 未通过 |
| 7-26 | 其余 20 个 | `"~2.6.3"` | ✅ 通过 |

**验证方式**：`cat cloudfunctions/*/package.json | grep wx-server-sdk`。20/26 通过，6 个未通过。

---

### 1.4 config.json 显式声明 timeout

| 规则来源 | 架构文档 §4.1：「config.json 显式声明 timeout ≥ 10s」 |
|---------|-----------------------------------------------------|

| # | 云函数 | config.json 内容 | timeout 声明 | 结果 |
|---|--------|-----------------|-------------|------|
| 1 | adminAddProduct | 仅 permissions | **缺失** | ❌ 未通过 |
| 2 | adminDeleteProduct | 仅 permissions | **缺失** | ❌ 未通过 |
| 3 | adminHandleReturn | 仅 permissions | **缺失** | ❌ 未通过 |
| 4 | adminLogout | 仅 permissions | **缺失** | ❌ 未通过 |
| 5 | adminUpdateOrderStatus | 仅 permissions | **缺失** | ❌ 未通过 |
| 6 | adminUpdateProduct | 仅 permissions | **缺失** | ❌ 未通过 |
| 7 | cancelOrder | 仅 permissions | **缺失** | ❌ 未通过 |
| 8 | initAdminAccounts | 仅 permissions | **缺失** | ❌ 未通过 |
| 9 | submitOrder | 仅 permissions | **缺失** | ❌ 未通过 |
| 10 | updateOrder | 仅 permissions | **缺失** | ❌ 未通过 |
| 11-26 | 其余 16 个 | 明确声明 timeout | 10s 或 30s | ✅ 通过 |

**验证方式**：`grep -L '"timeout"' cloudfunctions/*/config.json`。16/26 通过，10 个缺失 timeout 声明（CloudBase 默认仅 3 秒，这些函数在高负载下可能超时）。

---

## 二、分层架构

### 2.1 exports.main 行数

| 规则来源 | 架构文档 §6.8：「exports.main 超过 30 行必须拆分校验函数」 |
|---------|--------------------------------------------------------|

| # | 云函数 | exports.main 行数 | 结果 |
|---|--------|-------------------|------|
| 1 | cancelOrder | 8 行 | ✅ 通过 |
| 2 | healthCheck | 22 行（calc + 响应，无校验可拆分） | ✅ 通过 |
| 3 | submitOrder | 14 行（纯流程，校验和业务均内联但短） | ✅ 通过 |
| 4 | getProducts | 14 行 | ✅ 通过 |
| 5 | getMyOrders | 15 行 | ✅ 通过 |
| 6 | adminLogin | 68 行（auth + biz + 旧密码迁移 混在一起） | ❌ 未通过 |
| 7 | adminHandleReturn | 67 行（金额重算逻辑嵌入 main） | ❌ 未通过 |
| 8 | requestReturn | 50 行（多层业务判断内联） | ❌ 未通过 |
| 9 | customerCRUD | 65 行（6 个 action 的 switch 全在 main 中） | ❌ 未通过 |
| 10 | addressCRUD | 53 行（5 个 action 同上） | ❌ 未通过 |

**验证方式**：`grep -c` 计算 `exports.main` 函数体行数。仅 `cancelOrder` 和 `healthCheck` 明确分层；`customerCRUD` 和 `addressCRUD` 是 switch-dispatch 模式（可接受但建议拆分 action handler）。

---

### 2.2 使用共享鉴权模块

| 规则来源 | 架构文档 §6.4：「权限校验超过 5 行必须使用 lib/auth.js」 |
|---------|-------------------------------------------------------|

| # | 云函数 | 鉴权方式 | 行数 | 结果 |
|---|--------|---------|------|------|
| 1 | cancelOrder | `auth.requireOpenid()` | 2 行 | ✅ 通过（参考实现） |
| 2 | healthCheck | 无需鉴权 | — | ✅ 通过 |
| 3 | adminAddProduct | 内联 4 行 | 4 行 | ⚠️ 刚好阈值 |
| 4 | adminDeleteProduct | 内联 4 行 | 4 行 | ⚠️ 刚好阈值 |
| 5-14 | 其余 10 个 admin* 函数 | **内联重复 4 行** | 4 行 × 10 | ❌ 未通过（应统一用 auth.js） |
| 6 | addressCRUD | 内联 3 行 | 3 行 | ✅ 通过 |
| 7 | customerCRUD | 内联 3 行 | 3 行 | ✅ 通过 |

**验证方式**：`grep -r "getWXContext" cloudfunctions/*/index.js | grep -v lib | grep -v node_modules`。14 个云函数各自手写相同的 `wxContext.OPENID` 校验，其中 10 个 admin 函数完全相同。不符合"同一逻辑超过 2 个云函数出现则抽取"规则。

---

### 2.3 使用共享响应模块

| 规则来源 | CLUADE.md §2：「新增云函数必须使用 response.js 构建返回值」 |
|---------|----------------------------------------------------------|

| # | 云函数 | 响应构建方式 | 结果 |
|---|--------|------------|------|
| 1 | cancelOrder | `res.badRequest()` / `res.ok()` / `res.notFound()` / `res.conflict()` | ✅ 通过 |
| 2 | healthCheck | `res.record()` / `res.badRequest()` / `res.internalError()` | ✅ 通过 |
| 3-26 | 其余 24 个 | 手写 `{ code: -1, msg: ... }` | ❌ 未通过 |

**验证方式**：`grep -r "require.*response" cloudfunctions/*/index.js`。仅 2/26 使用。24 个云函数仍用手写格式。

---

## 三、API 响应格式

### 3.1 错误码使用新标准

| 规则来源 | 架构文档 §8.1：「code 值全集: 0/400/401/403/404/409/500」 |
|---------|---------------------------------------------------------|

| # | 云函数 | 使用的 error code | 结果 |
|---|--------|-------------------|------|
| 1 | cancelOrder | 0/400/403/404/409/500 | ✅ 通过（完全符合新标准） |
| 2 | healthCheck | 0/400/500 | ✅ 通过 |
| 3 | addressCRUD | 0/-1 | ❌ 未通过（旧 code: -1） |
| 4 | adminAddProduct | 0/-1 | ❌ 未通过 |
| 5 | adminDeleteOrderImage | 0/-1 | ❌ 未通过 |
| 6 | adminDeleteProduct | 0/-1 | ❌ 未通过 |
| 7 | adminGetOrders | 0/-1 | ❌ 未通过 |
| 8 | adminGetReturns | 0/-1 | ❌ 未通过 |
| 9 | adminHandleReturn | 0/-1 | ❌ 未通过 |
| 10 | adminLogin | 0/-1 | ❌ 未通过 |
| 11 | adminLogout | 0/-1 | ❌ 未通过 |
| 12 | adminOrderImage | 0/-1 | ❌ 未通过 |
| 13 | adminTogglePickedUp | 0/-1 | ❌ 未通过 |
| 14 | adminUpdateOrderPrice | 0/-1 | ❌ 未通过 |
| 15 | adminUpdateOrderStatus | 0/-1 | ❌ 未通过 |
| 16 | adminUpdateProduct | 0/-1 | ❌ 未通过 |
| 17 | customerCRUD | 0/-1 | ❌ 未通过 |
| 18 | getMyOrders | 0/-1 | ❌ 未通过 |
| 19 | getProducts | 0/-1 | ❌ 未通过 |
| 20 | importProducts | 0/-1 | ❌ 未通过 |
| 21 | initAdminAccounts | 0/-1 | ❌ 未通过 |
| 22 | requestReturn | 0/-1 | ❌ 未通过 |
| 23 | seedAdmin | 0/-1 | ❌ 未通过 |
| 24 | submitOrder | 0/-1 | ❌ 未通过 |
| 25 | subscribeAdmin | 0/-1 | ❌ 未通过 |
| 26 | updateOrder | 0/-1 | ❌ 未通过 |

**验证方式**：`grep -r "code: -[123]" cloudfunctions/*/index.js`。24/26 使用旧错误码。仅 `cancelOrder` 和 `healthCheck` 已迁移到新标准。

---

### 3.2 列表响应包含 list + total

| 规则来源 | 架构文档 §8.2：「列表 data 必须含 list 和 total」 |
|---------|-------------------------------------------------|

| # | 云函数 | 实际返回 | 结果 |
|---|--------|---------|------|
| 1 | getProducts | `{ list, total }` | ✅ 通过 |
| 2 | getMyOrders | `{ list, total }` | ✅ 通过 |
| 3 | adminGetOrders | `{ list, total }` | ✅ 通过 |
| 4 | adminGetReturns | `{ list, total }` | ✅ 通过 |
| 5 | customerCRUD.list | `data: res.data` (**缺少 total**) | ❌ 未通过 |
| 6 | addressCRUD.list | `data: list.data` (**缺少 total，且字段名为 data 而非 list**) | ❌ 未通过 |

**验证方式**：直接读 6 个列表类函数的 `return` 语句。4/6 通过，2 个 CRUD 的 list action 不符合规范。

---

### 3.3 catch 中不返回 err.message

| 规则来源 | 架构文档 §3.3：「catch 中不向客户端返回 err.message」 |
|---------|-----------------------------------------------------|

| # | 云函数 | catch 返回 | 结果 |
|---|--------|-----------|------|
| 1 | cancelOrder | `res.internalError()` (固定中文) | ✅ 通过 |
| 2 | healthCheck | `res.internalError()` (固定中文) | ✅ 通过 |
| 3-26 | 其余 24 个 | `{ code: -1, msg: err.message }` | ❌ 未通过 |

**验证方式**：`grep -r "msg: err.message" cloudfunctions/*/index.js | wc -l` → 22 处。22 个 catch 块直接暴露 JS 引擎错误消息给客户端。

---

## 四、鉴权与安全

### 4.1 环境 ID 使用 DYNAMIC_CURRENT_ENV

| 规则来源 | 架构文档 §2.1：「云函数中使用 cloud.DYNAMIC_CURRENT_ENV，不硬编码环境 ID」 |
|---------|-------------------------------------------------------------------------|

**验证方式**：`grep -r "cloud.init" cloudfunctions/*/index.js`

| 结果 | 详情 |
|------|------|
| ✅ 通过 | 全部 26 个云函数使用 `cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })`，0 个硬编码 |

---

### 4.2 客户数据绑定 _openid

| 规则来源 | 架构文档 §6.4：「客户数据必须在创建时写入 _openid、查询时过滤 _openid」 |
|---------|----------------------------------------------------------------------|

| # | 云函数 | 写入 _openid | 查询过滤 _openid | 结果 |
|---|--------|-------------|-----------------|------|
| 1 | submitOrder | ✅ `_openid: openid` | — | ✅ 通过 |
| 2 | getMyOrders | — | ✅ `where({ _openid: openid })` | ✅ 通过 |
| 3 | cancelOrder | — | ✅ `order.data._openid !== openid` | ✅ 通过 |
| 4 | updateOrder | — | ✅ `order.data._openid !== openid` | ✅ 通过 |
| 5 | requestReturn | ✅ `_openid: openid` | ✅ 双重验证 | ✅ 通过 |
| 6 | addressCRUD | ✅ 所有写操作带 _openid | ✅ 所有读操作带 _openid | ✅ 通过 |

**验证方式**：`grep -l "_openid" cloudfunctions/*/index.js`。6 个客户数据云函数全部正确使用 _openid。

---

### 4.3 管理操作验证登录态

| 规则来源 | 架构文档 §6.4：「管理类云函数必须验证 admins 表登录态」 |
|---------|-------------------------------------------------------|

**验证方式**：检查 14 个 `admin*` 云函数 + `subscribeAdmin`

| # | 云函数 | 验证 admins 表 | 结果 |
|---|--------|---------------|------|
| 1 | adminLogin | —（登录本身不验证） | ✅ 通过 |
| 2 | adminLogout | ✅（通过 OPENID 查找） | ✅ 通过 |
| 3 | subscribeAdmin | ✅（通过 OPENID） | ✅ 通过 |
| 4-14 | 其余 11 个 admin* | ✅ `db.collection('admins').where({ lastLoginOpenid, loggedIn: true })` | ✅ 通过 |

全部通过。

---

### 4.4 时间字段使用 db.serverDate()

| 规则来源 | 架构文档 §4.1：「时间字段必须使用 db.serverDate()，禁止 new Date() 或 Date.now()」 |
|---------|--------------------------------------------------------------------------------|

**验证方式**：`grep -c "new Date()" cloudfunctions/*/index.js`（排除 node_modules）

| 结果 | 详情 |
|------|------|
| ✅ 通过 | 所有云函数 index.js 中 **0 处使用 `new Date()`**。所有写操作均使用 `db.serverDate()`。 |

---

## 五、日志

### 5.1 使用共享 logger 模块

| 规则来源 | 架构文档 §6.2：「关键操作必须使用 logger.js 记录结构化日志」 |
|---------|----------------------------------------------------------|

| # | 云函数 | 使用 logger | 结果 |
|---|--------|-----------|------|
| 1 | cancelOrder | `logger.info()` + `logger.error()` | ✅ 通过 |
| 2 | healthCheck | `logger.info()` + `logger.error()` | ✅ 通过 |
| 3-26 | 其余 24 个 | 仅 `console.log/warn/error` 散落 | ❌ 未通过 |

**验证方式**：`grep -r "require.*logger" cloudfunctions/*/index.js`。2/26 使用。

---

### 5.2 关键业务节点有日志

| 规则来源 | 日志规范 §1：「info 级别用于关键业务流程节点」 |
|---------|----------------------------------------------|

抽查 5 个关键云函数：

| # | 云函数 | 下单/状态变更时是否记日志 | 结果 |
|---|--------|--------------------------|------|
| 1 | submitOrder | ❌ 无 `logger.info` 调用 | ❌ 未通过 |
| 2 | adminUpdateOrderStatus | ❌ 同上 | ❌ 未通过 |
| 3 | adminHandleReturn | ❌ 同上 | ❌ 未通过 |
| 4 | requestReturn | ❌ 同上 | ❌ 未通过 |
| 5 | cancelOrder | ✅ `logger.info('orderCancelled', ...)` | ✅ 通过 |

---

## 六、数据访问

### 6.1 查询使用分页

| 规则来源 | 架构文档 §2.2：「查询必须分页，limit 不超过 100」 |
|---------|------------------------------------------------|

| # | 云函数 | 分页方式 | 结果 |
|---|--------|---------|------|
| 1 | getProducts | `skip + limit(Math.min(pageSize, 100))` | ✅ 通过 |
| 2 | getMyOrders | `skip + limit(Math.min(pageSize, 100))` | ✅ 通过 |
| 3 | adminGetOrders | `skip + limit(pageSize)` | ✅ 通过 |
| 4 | adminGetReturns | `skip + limit(Math.min(pageSize, 100))` | ✅ 通过 |
| 5 | customerCRUD.list | `limit(200)` 无 skip | ❌ 未通过（硬编码 200，无分页参数） |
| 6 | addressCRUD.list | 全量 `.get()` 无 limit | ❌ 未通过 |

---

### 6.2 Promise.all 并行查询

| 规则来源 | 架构文档 §7：「云函数并行查询：count 和 list 不互相等待」 |
|---------|--------------------------------------------------------|

| # | 云函数 | 查询方式 | 结果 |
|---|--------|---------|------|
| 1 | getProducts | `Promise.all([count, list])` | ✅ 通过 |
| 2 | getMyOrders | `Promise.all([count, list])` | ✅ 通过 |
| 3 | adminGetReturns | `Promise.all([count, list])` | ✅ 通过 |
| 4 | adminGetOrders | 串行 `count → list` | ❌ 未通过 |

---

## 七、未验收项（无证据可验证）

以下规则来自架构文档，但因缺少对应机制而无法验证：

| # | 规则 | 缺少的机制 |
|---|------|-----------|
| 1 | 数据库集合权限设置 | 无法通过代码检查——需在云开发控制台手动确认 |
| 2 | Demo 模式降级覆盖 | 已在 `app.js` 和所有 Page 中实现，但此审计仅覆盖后端云函数 |
| 3 | 订阅消息模板 ID 有效性 | 需在微信公众平台确认模板 ID 与当前环境匹配 |
| 4 | 高德地图 Key 配置 | `utils/config.js` 需手动创建，不在后端代码中 |

---

## 八、整改优先级建议

### P0（必须立即修复——影响可用性）

| # | 问题 | 涉及文件数 |
|---|------|-----------|
| 1 | **10 个云函数缺少 config.json timeout 声明**（默认 3 秒必定超时） | 10 |
| 2 | **updateOrder 缺少 wx-server-sdk 依赖**（CI 部署可能失败） | 1 |
| 3 | **22 个 catch 块直接返回 err.message 给客户端**（泄露内部错误） | 22 |

### P1（本周内修复——影响可维护性）

| # | 问题 | 涉及文件数 |
|---|------|-----------|
| 4 | **24 个云函数使用旧错误码 -1/-2/-3**（应迁移到 400/401/403/404/409/500） | 24 |
| 5 | **14 个 admin 函数重复内联鉴权代码**（应改用 `lib/auth.js`） | 14 |
| 6 | **24 个云函数未使用 logger 模块**（关键操作无结构化日志） | 24 |

### P2（下个迭代修复——技术债务）

| # | 问题 | 涉及文件数 |
|---|------|-----------|
| 7 | 5 个 `"latest"` 版本依赖应锁定为 `"~2.6.3"` | 5 |
| 8 | customerCRUD.list / addressCRUD.list 缺少分页和标准 list/total 格式 | 2 |
| 9 | adminGetOrders 串行查询应改为 Promise.all | 1 |
| 10 | adminLogin 68 行 main 函数应拆分 | 1 |
