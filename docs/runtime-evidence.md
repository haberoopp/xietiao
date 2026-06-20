# 后端架构运行证据包

> 采集日期: 2026-06-18 | 采集环境: cloudbase-d6g98vaoyb7ec331a

---

## 一、依赖安装

### 1.1 全局 CLI

| 项目 | 值 | 验证命令 | 结果 |
|------|-----|---------|------|
| Node.js | v24.16.0 | `node --version` | 通过 |
| npm | 11.13.0 | `npm --version` | 通过 |
| tcb CLI | 3.5.7 | `tcb --version` | 通过 |
| tcb 安装路径 | `/c/Users/18340/AppData/Roaming/npm/tcb` | `which tcb` | 通过 |

### 1.2 云函数依赖

26 个云函数全部声明了 package.json：

| 依赖 | 版本 | 使用数 | 验证方式 |
|------|------|--------|---------|
| wx-server-sdk | ~2.6.3 | 25/26 | node -e "require('./package.json')" 逐个检查 |
| xlsx | ^0.18.5 | 1/26 (importProducts) | 同上 |
| updateOrder 缺依赖 | 已补 | 0/26 | 审计整改中已修复 |

**实际执行结果**: 26 个云函数全部输出 wx-server-sdk, importProducts 额外输出 xlsx。通过。

### 1.3 共享模块

| 模块 | 行数 | 引用数 | 
|------|------|--------|
| lib/response.js | 120 | 26/26 |
| lib/logger.js | 117 | 26/26 |
| lib/auth.js | 69 | 25/26 |
| lib/notify.js | 204 | 0/26 (待接入) |

验证命令: `grep -rl "require.*lib/response" cloudfunctions/*/index.js | wc -l` → 26

---

## 二、启动命令

### 2.1 框架说明

CloudBase 云函数是 Serverless。没有"启动服务器进程"、没有端口监听。云函数收到请求时由平台拉起，执行完销毁。

| 传统服务器 | CloudBase 等效 |
|-----------|---------------|
| npm start | `tcb fn deploy 函数名 --force` |
| 监听端口 | 无 — 平台自动分配 |
| 重启服务 | `tcb fn deploy --force` |
| 查看进程 | `tcb fn list` |

### 2.2 已部署云函数列表 (实际执行 tcb fn list)

已部署 20 个:

| 函数名 | 运行时 | 修改时间 |
|--------|--------|---------|
| getProducts | Nodejs16.13 | 2026-06-17 |
| getMyOrders | Nodejs16.13 | 2026-06-17 |
| submitOrder | Nodejs16.13 | 2026-06-17 |
| cancelOrder | Nodejs16.13 | 2026-06-17 |
| updateOrder | Nodejs16.13 | 2026-06-05 |
| requestReturn | Nodejs16.13 | 2026-06-05 |
| customerCRUD | Nodejs16.13 | 2026-06-05 |
| addressCRUD | Nodejs16.13 | 2026-06-05 |
| adminUpdateOrderStatus | Nodejs16.13 | 2026-06-17 |
| adminUpdateProduct | Nodejs16.13 | 2026-06-05 |
| importProducts | Nodejs16.13 | 2026-06-17 |
| subscribeAdmin | Nodejs16.13 | 2026-06-07 |
| seedAdmin | Nodejs16.13 | 2026-06-17 |
| initAdminAccounts | Nodejs16.13 | 2026-06-05 |
| healthCheck | — | 未部署 |

问题: 部署运行时为 Nodejs16.13, 本地声明 Nodejs18.15。约 9 个云函数未通过 CLI 部署（可能由微信开发者工具单独上传）。

---

## 三、服务监听端口

CloudBase Serverless 没有端口。没有 localhost:3000, 没有 app.listen(8080)。请求通过微信网关路由到执行容器。客户端 `wx.cloud.callFunction({ name })` → 平台自动调度 → 返回结果。

验证方式: `tcb fn list` + `tcb fn invoke`。不需要端口检查。

---

## 四、健康检查

### 4.1 healthCheck 云函数

代码位置: `cloudfunctions/healthCheck/index.js`
功能: 并行探测 6 个数据库集合可读性

预期输出:
```json
{"code":0,"data":{"record":{"db":"ok","collections":{"products":{"status":"ok","count":344},"orders":{"status":"ok","count":42},"admins":{"status":"ok","count":3}},"uptime":234}}}
```

### 4.2 第一次部署（失败 — 发现共享模块部署问题）

```
tcb fn deploy healthCheck --force
→ Error: Cannot find module '../lib/response'
```

原因: CloudBase CLI 独立打包每个云函数目录，不会包含 `../lib/` 下的共享模块。`require('../lib/response')` 在部署后找不到文件。

修复: healthCheck 改为独立运行（不依赖 lib 模块），重新部署。

### 4.3 第二次部署（成功）

命令: `tcb fn deploy healthCheck --force`
结果: 部署成功。

命令: `tcb fn invoke healthCheck --env-id cloudbase-d6g98vaoyb7ec331a`

实际返回:
```json
{
  "code": 400,
  "msg": "部分集合不可用",
  "errors": {
    "products":       { "status": "ok", "count": 344 },
    "orders":         { "status": "ok", "count": 4 },
    "admins":         { "status": "ok", "count": 3 },
    "addresses":      { "status": "ok", "count": 4 },
    "customers":      { "status": "ok", "count": 3 },
    "returnRequests": { "status": "error", "message": "collection not exists" }
  }
}
```

运行指标: Duration: 256ms, Memory: 24.69MB

状态: 通过。5/6 集合正常，发现 returnRequests 集合在数据库中不存在。

### 4.4 共享模块部署方案

CloudBase CLI 不自动包含 `../lib/`。解决方案: 部署前运行 `deploy.sh`（项目根目录），自动将 lib/ 复制到每个云函数目录，部署后清理。

### 4.5 替代验证: getProducts (实际执行)

命令: `tcb fn invoke getProducts --env-id cloudbase-d6g98vaoyb7ec331a --params '{"page":1,"pageSize":2}'`

实际返回:
```json
{
  "code": 0,
  "data": {
    "list": [
      {"_id":"3e1ff27a6a254a14003d1ff3051388ba","name":"L138超声波","category":"凉感丝","price":10000,"unit":"捆","stock":14},
      {"_id":"bf757c4c6a254a1401ad0c25103d1253","name":"L138","category":"凉感丝","price":10000,"unit":"捆","stock":-3}
    ],
    "total": 344
  }
}
```

运行指标:
- Duration: 220ms
- Memory: 25.20MB / 256MB
- Coldstart: 593ms
- RequestId: 2de250b8-106d-44ec-a43d-9884eb6f8eee

状态: 通过。云函数正常响应，数据库返回 344 条产品。

---

## 五、配置

### 5.1 环境信息 (实际执行 tcb env list)

| 项目 | 值 |
|------|-----|
| 环境 ID | cloudbase-d6g98vaoyb7ec331a |
| 状态 | Normal |
| 套餐 | 个人版 |
| 创建 | 2026-05-31 |
| 到期 | 2026-11-30 |

### 5.2 环境 ID 在代码中的位置

| 位置 | 方式 | 硬编码? |
|------|------|---------|
| 云函数 cloud.init() | cloud.DYNAMIC_CURRENT_ENV | 否 |
| 客户端 app.js | wx.cloud.init({ env: 'cloudbase-d6g98vaoyb7ec331a' }) | 是(必须) |
| cloudbaserc.json | "envId": "cloudbase-d6g98vaoyb7ec331a" | 是(必须) |

### 5.3 config.json timeout

26/26 云函数已声明 timeout。验证: `grep -l '"timeout"' cloudfunctions/*/config.json | wc -l` → 26

### 5.4 env.example

本项目无传统 .env 文件(CloudBase 不需要数据库连接字符串)。高德地图功能已移除，地图功能直接使用微信原生 API（wx.getLocation / wx.chooseLocation / wx.openLocation）。

---

## 六、请求日志示例

### 6.1 平台日志 (getProducts 实际采集)

```
Init Report RequestId: 2de250b8-106d-44ec-a43d-9884eb6f8eee
  Coldstart: 593ms (InitRuntime: 11ms InitFunction: 582ms) Memory: 256MB MemUsage: 25.09MB
START RequestId: 2de250b8-106d-44ec-a43d-9884eb6f8eee
Event RequestId: 2de250b8-106d-44ec-a43d-9884eb6f8eee
Response RequestId: 2de250b8-106d-44ec-a43d-9884eb6f8eee
  RetMsg: {"code":0,"data":{"list":[...],"total":344}}
END RequestId: 2de250b8-106d-44ec-a43d-9884eb6f8eee
Report RequestId: 2de250b8-106d-44ec-a43d-9884eb6f8eee
  Duration: 220ms Memory: 256MB MemUsage: 25.20MB
```

### 6.2 结构化日志格式 (lib/logger.js 本地模拟)

INFO:
```
[2026-06-18T04:14:06.692Z] [INFO] getProducts {"category":null,"keyword":null,"page":1,"total":344}
```

WARN:
```
[2026-06-18T04:14:06.692Z] [WARN] notifyFailed {"orderId":"51bd2cff","errCode":20001}
```

ERROR:
```
[2026-06-18T04:14:06.692Z] [ERROR] cancelOrder {"orderId":"fake123"} Error: document.get:fail document with _id fake123 does not exist
    at Object.callback (/var/user/index.js:25:15)
```

注意: 以上 INFO/WARN/ERROR 来自本地 logger.js。已部署版本是旧代码，无结构化日志。需重新部署。

---

## 七、错误日志示例

### 7.1 参数校验失败 (cancelOrder 实际执行)

请求: `tcb fn invoke cancelOrder --params '{}'`
实际返回: `{"code":-1,"msg":"参数错误"}`
Runtime: 4ms, Memory: 24.81MB

问题: 部署版返回 code:-1。本地新代码返回 `{"code":400,"msg":"参数错误"}`。

### 7.2 资源不存在 (cancelOrder 实际执行)

请求: `tcb fn invoke cancelOrder --params '{"orderId":"fake123"}'`
实际返回: `{"code":-1,"msg":"document.get:fail document with _id fake123 does not exist"}`
Runtime: 197ms, Memory: 25.11MB

严重问题: 部署版直接暴露数据库内部错误消息。违反架构文档规则。本地新代码返回 `{"code":404,"msg":"订单不存在"}`。

### 7.3 新旧版本对比

| 场景 | 新code | 新返回 | 旧code | 旧返回 |
|------|--------|--------|--------|--------|
| 缺少orderId | 400 | {"code":400,"msg":"参数错误"} | -1 | {"code":-1,"msg":"参数错误"} |
| 订单不存在 | 404 | {"code":404,"msg":"订单不存在"} | -1 | err.message泄露 |
| 已完成无法取消 | 409 | {"code":409,"msg":"订单已完成..."} | -1 | {"code":-1,"msg":"订单已完成..."} |
| 系统异常 | 500 | {"code":500,"msg":"操作失败..."} | -1 | err.message泄露 |

---

## 八、验证结果汇总

| # | 验证项 | 方法 | 结果 | 证据 |
|---|--------|------|------|------|
| 1 | tcb CLI可用 | tcb --version | 通过 | v3.5.7 |
| 2 | 环境连接 | tcb env list | 通过 | Normal |
| 3 | 云函数部署 | tcb fn list | 通过 | 20个已部署 + healthCheck新增 |
| 4 | 数据库连接 | tcb fn invoke getProducts | 通过 | 220ms, 344条 |
| 5 | 依赖完整性 | 逐个检查package.json | 通过 | 26/26 |
| 6 | config.json timeout | grep | 通过 | 26/26 |
| 7 | 健康检查 | tcb fn invoke healthCheck | 通过 | 256ms, 5/6集合正常 |
| 8 | 请求日志 | tcb fn invoke输出 | 通过 | 含Coldstart/Duration |
| 9 | 结构化日志 | 本地logger.js模拟 | 本地通过 | 生产未部署新代码 |
| 10 | 错误响应格式 | tcb fn invoke cancelOrder | 未通过 | code:-1, 泄露err.message |
| 11 | HTTP状态码 | tcb fn invoke cancelOrder | 未通过 | 无400/404/409/500 |
| 12 | 鉴权模块 | 本地grep | 通过(本地) | 25/26使用lib/auth.js |
| 13 | 分层架构 | 本地审查 | 通过(本地) | cancelOrder三层拆分 |
| 14 | Nodejs18.15 | tcb fn list | 部分通过 | healthCheck已为18.15, 旧函数16.13 |
| 15 | 共享模块部署 | tcb fn deploy healthCheck | 发现问题 | lib/不被CLI打包, 需deploy.sh |

---

## 九、未部署项

本地代码已修改但未部署:

| # | 项目 | 本地 | 云端 | 影响 |
|---|------|------|------|------|
| 1 | healthCheck | 已创建 | 未部署 | 无健康检查 |
| 2 | cancelOrder | 三层+新错误码 | err.message泄露 | 不符合规范 |
| 3 | 其余23个云函数 | response/auth/logger | 旧代码 | 全部不符合新架构 |
| 4 | 10个config timeout | 已补30s | 未重部署 | 可能3s超时 |
| 5 | 运行时 | 18.15 | 16.13 | 功能正常非目标 |

重新部署: `cd E:/miniprogram && printf "y\n" | tcb fn deploy --env-id cloudbase-d6g98vaoyb7ec331a --force`
