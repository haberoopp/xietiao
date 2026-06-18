# 最小模块演练 — adminGetOrderDetail（管理员查看单个订单详情）

> 目的：用最小功能演示完整文件清单、调用路径、分层安排

---

## 一、功能说明

管理员点击订单列表中的某个订单，看到完整信息。当前有 adminGetOrders（列表），没有详情查询。此演练新增 adminGetOrderDetail。

---

## 二、需要新增或修改的文件（共 5 个）

| # | 动作 | 文件 | 职责 |
|---|------|------|------|
| 1 | 新增 | cloudfunctions/adminGetOrderDetail/index.js | 接口层 + 校验层 + 业务层 |
| 2 | 新增 | cloudfunctions/adminGetOrderDetail/package.json | 声明依赖 |
| 3 | 新增 | cloudfunctions/adminGetOrderDetail/config.json | 声明 timeout |
| 4 | 修改 | cloudbaserc.json | 注册新云函数 |
| 5 | 修改 | docs/api-reference.md | 记录接口文档 |

不需要修改（复用共享模块）：
- lib/response.js — res.record() / res.badRequest() / res.notFound() / res.internalError()
- lib/auth.js — auth.requireAdmin()
- lib/logger.js — logger.info() / logger.error()

---

## 三、调用路径（请求从哪进入，经过哪些层）

```
客户端 admin/orders/orders.js
  wx.cloud.callFunction({ name: "adminGetOrderDetail", data: { orderId } })
    |
    |  微信 RPC 通道（不是 HTTP，没有 URL 路径）
    v
云函数 cloudfunctions/adminGetOrderDetail/index.js

exports.main = async (event) => {                    <-- 接口层（请求入口）
  try {
    // 第 1 步：参数校验
    const v = validate(event);                       <-- 校验层
    if (!v.valid) return res.badRequest(v.error);

    // 第 2 步：权限校验
    const r = await auth.requireAdmin();             <-- 权限层（lib/auth.js）
    if (!r.authorized) return r.response;            // 401 或 403

    // 第 3 步：业务逻辑
    const biz = await doGetOrderDetail(v.orderId);    <-- 业务层 + 数据层
    if (!biz.success) return res.notFound(biz.error);

    // 第 4 步：记日志 + 返回
    logger.info("adminGetOrderDetail",                <-- 日志层（lib/logger.js）
      { orderId: v.orderId });
    return res.record(biz.order);                    <-- 响应层（lib/response.js）

  } catch (err) {
    logger.error("adminGetOrderDetail", err,          <-- 统一错误处理
      { orderId: event.orderId });
    return res.internalError();                     // 500
  }
};

// === 以下两函数定义在 exports.main 之后 ===

function validate(event) {                           <-- 校验层
  if (!event.orderId) return { valid: false, error: "缺少订单ID" };
  return { valid: true, orderId: event.orderId };
}

async function doGetOrderDetail(orderId) {            <-- 业务层 + 数据层
  const result = await db.collection("orders").doc(orderId).get();
  if (!result.data) return { success: false, error: "订单不存在" };
  return { success: true, order: result.data };
}
```

---

## 四、各层职责对应表

| 层 | 函数 | 所在文件 | 做什么 | 不做什么 |
|----|------|---------|--------|---------|
| 请求入口 | exports.main | index.js | 接收 event，调度各层，return res.xxx() | 不写业务判断，不直接操作 db |
| 参数校验 | validate(event) | index.js（main下方） | 检查字段存在 + 类型 | 不查数据库 |
| 权限校验 | auth.requireAdmin() | lib/auth.js（共享） | 验证 OPENID + admins 表 | 不写业务规则 |
| 业务规则 | doGetOrderDetail(id) | index.js（main下方） | 查 db，判断存在性 | 不访问 event/wxContext，不直接 return res |
| 数据访问 | db.collection().doc().get() | 在 doGetOrderDetail 内 | 读 orders 表 | — |
| 统一响应 | res.record() 等 4 个方法 | lib/response.js（共享） | 构建标准 JSON | — |
| 统一错误 | catch 块内 | index.js | 记日志 + 返回中文提示 | 不返回 err.message |
| 日志 | logger.info/error | lib/logger.js（共享） | 结构化输出 | — |

---

## 五、对照架构文档逐项验证（19 条全部通过）

| 架构文档规则 | 对应章节 | 结果 |
|------------|---------|------|
| 云函数目录含 index+package+config 三文件 | §5.2 | ✅ |
| cloudbaserc.json 注册 | §7.4 | ✅ |
| exports.main 不超过 30 行 | §6.8 | ✅（本例约 12 行） |
| 校验函数定义在 main 之后 | §6.3 | ✅ |
| 校验函数不查数据库 | §6.3 | ✅ |
| 权限校验用 lib/auth.js | §6.4 | ✅ |
| 业务函数不访问 event/wxContext | §6.5 | ✅ |
| 业务函数不直接 return res | §6.5 | ✅ |
| 数据层不额外封装 Repository | §6.6 | ✅ |
| 单对象用 res.record() | §8.3 | ✅ |
| 参数错误用 res.badRequest() | §8.7 | ✅ |
| 不存在用 res.notFound() | §8.10 | ✅ |
| 系统异常用 res.internalError() | §8.12 | ✅ |
| catch 不向客户端返回 err.message | §9.2 | ✅ |
| 关键操作记 logger.info | §10.1 | ✅ |
| catch 记 logger.error | §10.1 | ✅ |
| 环境 ID 用 DYNAMIC_CURRENT_ENV | §4.1 | ✅ |
| 依赖版本锁定 ~2.6.3（不用 latest） | §2.1 | ✅ |
| config.json timeout 显式声明 >= 10s | §4.1 | ✅ |

---

## 六、与旧写法的对比

旧写法把参数校验、权限校验、业务判断、数据库访问全部堆在 exports.main 里：

- 错误码是旧版 -1（应为 400/404/500）
- 权限校验 4 行代码在 14 个 admin 云函数中一模一样（重复 14 遍）
- catch 块暴露 err.message 给客户端（用户看到英文错误）
- 没有日志记录（出问题只能靠猜）
- 四个职责（校验/鉴权/业务/响应）堆在同一个函数里

新写法：

- exports.main 只做调度（12 行），具体活分给 validate / auth / doGetOrderDetail
- 权限规则改一处（lib/auth.js），所有云函数自动生效
- 错误返回中文提示 + 原始错误记日志
- 每个关键操作都有日志可查
- 响应格式统一走 lib/response.js，所有云函数一致

---

## 七、新增功能文件清单模板（以后照此执行）

```
新增功能：_______________

[ ] cloudfunctions/{函数名}/index.js       — 接口层 + 校验层 + 业务层
[ ] cloudfunctions/{函数名}/package.json    — { "dependencies": { "wx-server-sdk": "~2.6.3" } }
[ ] cloudfunctions/{函数名}/config.json     — { "timeout": 30 }
[ ] cloudbaserc.json                        — 注册新函数到 functions 数组
[ ] docs/api-reference.md                   — 添加入参/出参/错误码

不需要动（复用）：
[ ] lib/response.js    [ ] lib/auth.js    [ ] lib/logger.js    [ ] lib/notify.js
```
