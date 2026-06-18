# CLAUDE.md — 温州斜条批发 项目宪法

> 本文件是项目的最高行为准则。所有代码修改、架构决策、依赖变更必须遵守本宪法。
>
> **后端开发权威参考**：[后端架构实施真源文档](docs/backend-implementation-spec.md) — 框架能力复用、路由、参数校验、HTTP 状态码、错误处理、日志、分层架构、自定义封装审批。本文档与该文档冲突时，以该文档为准。
>
> **后端开发强制规则**：
> 1. 修改任何后端代码前，**必须先读取** `docs/backend-implementation-spec.md`，确认当前改动不违反任何规则。
> 2. 新增或修改后端功能前，**必须确认**：目录责任（§十二）、接口响应规则（§四）、错误处理规则（§五）、复用边界（§二、§十）。
> 3. 以下变更**必须说明原因，并同步更新** `docs/backend-implementation-spec.md`：
>    - 目录结构调整
>    - 接口响应规则变更（新增 code 值、修改返回格式）
>    - 错误处理规则变更
>    - 复用边界调整（新增 lib 模块、引入第三方依赖替代框架能力）
>    - 框架更换或运行时升级
>    - 新增关键依赖（npm package）

---

## 一、语言与框架约束

### 1.1 语言工程规范（JavaScript ES6+）

- `const` 优先，`let` 允许，`var` 禁止。
- 函数不超过 60 行，超标必须拆分。
- 命名：文件 kebab-case，云函数 camelCase，常量 UPPER_SNAKE_CASE。
- 详见 [coding-standards.md](docs/standards/coding-standards.md)

### 1.2 框架最佳实践

**CloudBase 云函数**：
- 环境 ID 用 `cloud.DYNAMIC_CURRENT_ENV`，不硬编码。
- 时间字段用 `db.serverDate()`，不用 `new Date()` 或 `Date.now()`。
- `config.json` 显式声明 `timeout` ≥ 10s。
- `package.json` 显式声明所有依赖。
- 查询必须分页，`limit` 不超过 100。

**微信小程序前端**：
- `setData` 合并为一次调用，不在循环中多次调用。
- 所有云函数调用必须有 demo 模式降级分支。
- Tab 页面用 `wx.switchTab`，非 Tab 用 `wx.navigateTo`。

**安全**：
- 客户数据必须绑定和过滤 `_openid`。
- 管理操作必须验证 `admins` 表登录态。
- 客户端 Toast 不暴露内部错误（`err.message`）。

---

## 二、优先复用框架能力

**必须优先使用框架内置能力，禁止引入外部库替代框架已有功能**：

| 需求 | 使用框架能力 | 禁止 |
|------|-------------|------|
| 微信登录/openid | `cloud.getWXContext().OPENID` | 自建 OAuth |
| 订阅消息推送 | `cloud.openapi.subscribeMessage.send` | 自建 HTTP 请求 |
| 数据库时间戳 | `db.serverDate()` | `new Date()` |
| 文件上传 | `wx.cloud.uploadFile` | 第三方 CDK SDK |
| 云函数部署 | `tcb fn deploy` | 手动右键上传 |
| 价格计算 | 整数（分）+ `Math.round()` | 浮点数运算 |

**已经可用的共享模块**（云函数中 `require` 即可，不要重复造轮子）：
- `cloudfunctions/lib/response.js` — 统一响应：`res.list()` / `res.record()` / `res.ok()` / `res.badRequest()` / `res.unauthorized()` / `res.forbidden()` / `res.notFound()` / `res.conflict()` / `res.internalError()`
- `cloudfunctions/lib/auth.js` — 统一鉴权：`auth.requireOpenid()` / `auth.requireAdmin()` (25 个云函数使用)
- `cloudfunctions/lib/logger.js` — 结构化日志：`logger.info()` / `logger.warn()` / `logger.error()` (26 个云函数使用)
- `cloudfunctions/lib/notify.js` — 订阅消息模板（待接入，当前未使用）

### 2.2 自定义封装原则

**每个 lib/ 下的封装模块必须满足以下全部条件**：

1. 能说清楚解决什么问题（一句话）
2. 被至少 1 个云函数实际引用
3. 问题已在架构文档中说明

**不满足条件的模块**：不在架构文档中列为"当前使用的共享模块"，标记为"待接入"。如果有人要使用它，先满足上述 3 条件再改标记。

**禁止提前封装**：不能在"预计将来可能需要"时提前创建封装模块。先让代码重复出现（2 次以上），再抽取——而不是猜测将来会重复而提前抽。

### 2.1 分层架构（强制）

云函数必须按三层拆分，不把所有逻辑堆在 `exports.main`：

| 层 | 框架对应 | 职责 | 禁止 |
|---|---------|------|------|
| **接口层** | `exports.main` | 提取 event → 调校验 → 调业务 → `return res.xxx()` | 写业务判断、直接操作数据库 |
| **业务层** | 独立 `doXxx` 函数 | 接收已验证数据，写业务规则，调用 `db` | 访问 `event`/`wxContext`，直接 `return res` |
| **数据层** | `db.collection('xxx')` | CloudBase SDK 内置，不需要额外封装 | 在 `db` 之上包 Repository 类 |

**拆分阈值**：
- `exports.main` 超过 30 行 → 必须拆分校验函数
- 权限校验超过 5 行 → 必须用 `lib/auth.js`
- 业务判断超过 3 个 if → 必须抽取 `doXxx`
- 同一逻辑在 2 个以上云函数出现 → 必须抽取到共享模块

**校验函数位置**：`exports.main` 内第一个步骤，在权限校验之前。只做字段检查，不查数据库。需要查库的校验归入业务层。

---

## 三、变更审批规则

以下变更**必须先说明原因，获得确认后才能执行**。所有后端相关变更**必须同步更新** `docs/backend-implementation-spec.md`：

| 变更类型 | 需要说明的内容 | 更新真源文档 |
|---------|--------------|------------|
| 新增 npm 依赖 | 为什么框架能力无法满足？有无更轻的替代？对部署包体积的影响？ | §二 框架能力清单 |
| 调整目录结构 | 为什么当前目录规范不适用？影响的文件数量？ | §十二 目录结构 |
| 新增/修改接口响应规则 | 为什么现有 7 个 code 值不够用？新规则的语义和触发条件？ | §四 响应格式规范 |
| 新增/修改错误处理规则 | 为什么现有三层保护不够？新规则覆盖什么场景？ | §五 错误处理 |
| 新增 lib 共享模块 | 满足 §十 三个审批条件了吗？解决什么问题？被谁引用？ | §十 已有封装清单 |
| 引入第三方库替代框架能力 | **原则上不批准。** 必须证明框架能力确实无法满足。 | §二 框架能力清单 |
| 更换框架/运行时 | **除非有硬性技术原因（如平台 EOL），否则不批准。** 迁移成本？涉及文件数？替代方案成熟度？ | 全文 |
| 修改数据库集合结构 | 新增/删除/重命名字段的原因？是否影响现有查询？是否需要数据迁移脚本？ | §一 数据库 |
| 修改 `app.json` 页面路由 | 新增或调整 tabBar 的原因？ | `docs/architecture-overview.md` |

---

## 四、文档更新义务

**以下变更必须同步更新对应的架构设计文档**：

| 变更 | 必须更新的文档 |
|------|--------------|
| 新增云函数 | `docs/api-reference.md` — 添加接口定义 |
| 新增数据库集合 | `docs/data-model.md` — 添加 Schema |
| 新增/修改字段 | `docs/data-model.md` — 更新对应集合的字段表 |
| 新增页面 | `docs/project-structure.md`（若目录有变）、`app.json` 注册 |
| 修改安全策略 | `docs/architecture-overview.md` — 更新安全模型 |
| 新增依赖 | `docs/architecture-overview.md` — 更新技术决策表 |
| 修改部署流程 | `docs/deployment.md` — 更新对应步骤 |
| 修改代码规范 | `docs/standards/` 下对应文件 |

更新文档时：
1. 修改日期和版本号
2. 保持文档格式与现有风格一致（表格、字段描述模式）
3. 在变更说明中标注改动原因

---

## 五、代码修改流程

```
1. 查文档 — 先读 docs/ 下相关文档，理解现有设计意图
2. 说明原因 — 如果修改触及变更审批规则（第三节），先说明原因
3. 修改代码 — 遵守语言规范（第一节）和框架最佳实践（第二节）
4. 更新文档 — 根据文档更新义务（第四节）更新架构文档
5. 部署 — 修改了云函数代码就必须自动部署，跑 bash deploy.sh（并行部署全部）
```

**部署强制规则**：
- 任何云函数代码（index.js / lib/）被修改后，**必须立即**执行 `bash deploy.sh`
- deploy.sh 已内置并行部署（26 个函数同时上传），不要逐个部署
- 部署完成后验证：`tcb fn invoke healthCheck --env-id cloudbase-d6g98vaoyb7ec331a`

---

## 六、禁止事项

1. ❌ 云函数中硬编码环境 ID
2. ❌ 客户端 `wx.cloud.init` 中用 `Date.now()` 构造时间字段
3. ❌ 在循环中调用 `setData`
4. ❌ 全量 `.get()` 无分页
5. ❌ catch 块中向客户端返回 `err.message`
6. ❌ 定价相关计算使用浮点数（`0.1 + 0.2`）
7. ❌ 新增管理操作不验证 admin 登录态
8. ❌ 跳过文档更新直接提交代码
9. ❌ 不经说明原因直接新增 npm 依赖
