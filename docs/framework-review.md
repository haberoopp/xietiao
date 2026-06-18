# 框架复用与封装边界审查

> 审查日期: 2026-06-18 | 审查范围: 26 个云函数 + 4 个 lib 模块

---

## 一、直接复用框架的能力（未做任何封装）

以下 22 项能力全部由 CloudBase SDK 直接提供，项目中每个云函数直接调用，没有经过任何中间层封装：

| 类别 | 框架 API | 使用场景 | 封装了没 |
|------|---------|---------|---------|
| 环境识别 | cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) | 每个云函数开头 | 没封装，直接用 |
| 用户身份 | cloud.getWXContext().OPENID | 鉴权时获取用户 openid | 没封装，直接用 |
| 数据库-增 | db.collection("x").add({ data }) | 创建订单、产品、地址等 | 没封装，直接用 |
| 数据库-删 | db.collection("x").doc(id).remove() | 删除产品、地址等 | 没封装，直接用 |
| 数据库-改 | db.collection("x").doc(id).update({ data }) | 更新订单状态、产品字段 | 没封装，直接用 |
| 数据库-查 | db.collection("x").where(q).get() | 查询列表 | 没封装，直接用 |
| 数据库-计数 | db.collection("x").where(q).count() | 分页时查总数 | 没封装，直接用 |
| 数据库-分页 | .skip(n).limit(m) | 所有列表类查询 | 没封装，直接用 |
| 数据库-排序 | .orderBy("createdAt", "desc") | 按时间倒序 | 没封装，直接用 |
| 数据库-原子增减 | db.command.inc(n) | customerCRUD 累加订单数/金额 | 没封装，直接用 |
| 数据库-数组追加 | db.command.push([item]) | adminOrderImage 追加图片 | 没封装，直接用 |
| 数据库-字段删除 | db.command.remove() | adminLogin 删除旧明文密码 | 没封装，直接用 |
| 数据库-批量查询 | db.command.in(ids) | adminGetReturns 批量关联订单 | 没封装，直接用 |
| 数据库-服务端时间 | db.serverDate() | 所有 createdAt/updatedAt | 没封装，直接用 |
| 数据库-正则搜索 | db.RegExp({ regexp, options: "i" }) | getProducts 名称模糊搜索 | 没封装，直接用 |
| 文件-上传 | cloud.uploadFile({ cloudPath, filePath }) | 客户端上传产品图/凭证图 | 没封装，直接用 |
| 文件-下载 | cloud.downloadFile({ fileID }) | importProducts 下载 Excel | 没封装，直接用 |
| 文件-删除 | cloud.deleteFile({ fileList }) | importProducts 清理临时文件 | 没封装，直接用 |
| 消息-发送 | cloud.openapi.subscribeMessage.send({ ... }) | notify.js 内调用 | 没封装，直接用 |
| 客户端调用 | wx.cloud.callFunction({ name, data }) | 所有页面调用云函数 | 没封装，直接用 |
| 客户端上传 | wx.cloud.uploadFile({ cloudPath, filePath }) | 产品图/凭证图上传 | 没封装，直接用 |
| Debug 输出 | console.log / console.warn / console.error | 临时调试 | 没封装，直接用 |

**结论：Framework 层完全没有被二次封装。db.collection() 之上没有 Repository 类，cloud.callFunction 之上没有 HTTPClient 类，console 之上没有 Logger 接口。**

---

## 二、项目自定义封装（4 个 lib 模块）

所有自定义封装集中在 cloudfunctions/lib/ 目录，共 4 个文件。

### 2.1 response.js — 统一响应封装（120 行）

**解决的问题**：
- 禁止云函数手写 { code: ..., msg: ... }。如果每个函数自己拼 JSON，26 个函数会有 26 种不同的写法
- code 值对标 HTTP 语义（0/400/401/403/404/409/500），不用记"我们项目 -1 是什么意思"
- 如果去掉：每个云函数自己 return { code: -1, msg: "xxx" }，错误码不统一，新成员不知道用哪个 code

**是否是提前封装**：不是。这是所有后端项目的第一层抽象——统一返回格式。即使只有 3 个云函数也应该有。

---

### 2.2 auth.js — 统一鉴权封装（69 行）

**解决的问题**：
- 14 个 admin 云函数每人都手写 4 行相同的鉴权代码（getWXContext + admins 表查询）
- 如果鉴权规则要改（比如增加 IP 白名单、增加二次验证），不封装就要改 14 个文件
- 如果去掉：14 个云函数各写各的鉴权。改一条鉴权规则 = 改 14 个文件 = 容易漏

**是否是提前封装**：不是。项目有 14 个 admin 函数时，统一鉴权是必须的——不封装反而是在复制粘贴代码。

---

### 2.3 logger.js — 统一日志封装（117 行）

**解决的问题**：
- 将 console.log/warn/error 包装为结构化格式：[ISO时间] [级别] 事件名 {上下文} 错误堆栈
- 内置 safeStringify：防止循环引用、500 字符截断
- 如果去掉：每个云函数自己 console.log 打日志——有的打 JSON、有的不打、有的打一半。排查问题时日志不可靠

**是否是提前封装**：轻微的提前封装。console.log 本身就能工作。logger.js 的核心价值是统一格式（方便 grep）和 safeStringify（防止打日志本身报错）。一个 117 行的薄封装是合理代价。

---

### 2.4 notify.js — 订阅消息封装（204 行）

**解决的问题**：
- 封装订阅消息模板 ID 映射和字段填充逻辑
- 提供 sendToCustomer() 和 sendToAdmins() 两个语义化入口
- 内部处理 truncate（微信限制 20 字符）、formatMoney（分转元）、itemsSummary

**严重问题——未作为共享模块使用**：

notify.js 在 lib/ 下有一份（正确），但 submitOrder、cancelOrder、adminUpdateOrderStatus、adminHandleReturn 这四个云函数各自在本地目录下也有一份完全相同的 notify.js 副本。

现状：
  lib/notify.js                           ← 共享模块，0 个云函数引用
  submitOrder/notify.js                   ← 本地副本（与 lib 内容相同）
  cancelOrder/notify.js                   ← 本地副本（与 lib 内容相同）
  adminUpdateOrderStatus/notify.js        ← 本地副本（与 lib 内容相同）
  adminHandleReturn/notify.js             ← 本地副本（与 lib 内容相同）

这意味着模板 ID 变更时需要改 5 个文件。应当删除 4 个本地副本，改为 require("../lib/notify")。

**是否是提前封装**：notify.js 本身不是提前封装——204 行封装微信订阅消息的模板和数据格式化是合理的。但 **4 个本地副本的存在说明它实际上没有发挥共享模块的作用**。

---

## 三、封装审视：是否存在"为了显得专业而提前封装"

逐项判断：

| 封装 | 存在理由 | 是否为了显得专业 | 判断依据 |
|------|---------|----------------|---------|
| response.js | 26 个云函数需要统一返回格式 | 否 | 哪怕只有 3 个云函数，统一 code 值也是基本要求 |
| auth.js | 14 个 admin 函数重复 4 行鉴权代码 | 否 | 重复代码超过 2 处就必须抽取——这是消除重复，不是过度抽象 |
| logger.js | 统一日志格式，方便 grep 排查 | 轻微 | 117 行薄封装是合理代价。但如果团队只有 1 人且从不 grep 日志，console.log 也够用 |
| notify.js | 封装模板 ID 和微信字段限制 | 否 | 204 行处理 truncate/formatMoney/模板映射，手写更易出错 |
| 数据库 Repository 层 | **不存在** | — | 没有为了"像 Spring"而包一层无意义的 UserRepository |
| HTTP 中间件链 | **不存在** | — | 没有为了"像 Express"而自建 req/res/next 中间件 |
| 依赖注入/IoC | **不存在** | — | 没有为了"企业级"而引入 awilix 或 inversify |
| DTO/Entity 转换层 | **不存在** | — | 没有为了"分层严格"而把 db 返回的 JSON 又转成 class |
| ORM | **不存在** | — | 没有引入 Prisma/TypeORM，db.collection() 就是数据层 |
| 配置中心/环境变量管理 | **不存在** | — | 没有为了"12-factor app"而引入 dotenv 或配置服务 |

**结论：项目中 0 处"为了显得专业而提前封装"。**

4 个 lib 模块的存在理由全部是基于实际需求：重复代码消除（auth）、统一格式（response/logger）、微信 SDK 复杂性的薄封装（notify）。

同时，9 种常见的"过度封装"在本项目中全部不存在——没有 ORM、没有 IoC、没有 Repository、没有中间件链。**封装边界恰好停在收益递减的临界点之前。**
