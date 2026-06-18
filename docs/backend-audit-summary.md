# 后端架构验收报告

> 验收日期: 2026-06-18 | 环境: cloudbase-d6g98vaoyb7ec331a

---

## 一、验收结果

| # | 验收项 | 是否通过 | 证据位置 |
|---|--------|---------|---------|
| 1 | 响应格式标准化 (lib/response.js) | ✅ 通过（本地）<br>❌ 未通过（云端） | 本地: `cloudfunctions/lib/response.js`，25/26 index.js 引用<br>云端: 部署后 `Cannot find module '../lib/response'` |
| 2 | HTTP语义错误码 (0/400/401/403/404/409/500) | ✅ 通过（本地）<br>❌ 未通过（云端） | 本地: 0 个文件使用旧 -1/-2/-3<br>云端: cancelOrder/getProducts 直接报模块缺失错误 |
| 3 | 鉴权模块 (lib/auth.js) | ✅ 通过（本地）<br>❌ 未通过（云端） | 本地: `cloudfunctions/lib/auth.js`，25/26 index.js 引用<br>云端: 同#1原因，函数无法启动 |
| 4 | 日志模块 (lib/logger.js) | ✅ 通过（本地）<br>❌ 未验证（云端） | 本地: `cloudfunctions/lib/logger.js`，25/26 index.js 引用<br>云端: 函数未成功部署，无日志可查 |
| 5 | 分层架构 (三层模式) | ⚠️ 部分通过 | cancelOrder 是唯一参考实现: `cloudfunctions/cancelOrder/index.js`<br>其余 25 个使用 switch-router 或内联模式 |
| 6 | config.json timeout | ✅ 通过 | 26/26 已声明: `grep -l '"timeout"' cloudfunctions/*/config.json` → 26 |
| 7 | package.json 依赖完整性 | ✅ 通过 | 26/26 声明 `wx-server-sdk: ~2.6.3` |
| 8 | 数据库连接 | ✅ 通过 | `tcb fn invoke healthCheck`: 208ms, 6/6 集合正常 |
| 9 | 健康检查 | ✅ 通过 | `tcb fn invoke healthCheck` → `code:0`, `db:"ok"`, 全部集合可读写 |
| 10 | 共享模块可部署性 | ❌ 未通过 | `tcb fn invoke cancelOrder` → `Cannot find module '../lib/response'` |
| 11 | 错误消息不泄露 | ❌ 未通过（本地） | `cloudfunctions/healthCheck/index.js:18`: `.catch(e => ({ message: e.message }))`<br>`cloudfunctions/importProducts/index.js:75`: `err.message` 直接入结果数组 |
| 12 | 部署覆盖率 | ❌ 未通过 | 仅 healthCheck 成功部署。其余 25 个函数部署后无法运行 |
| 13 | 运行时一致性 | ❌ 未通过 | `tcb fn list` 显示已部署函数为 Nodejs16.13，本地 cloudbaserc.json 声明 Nodejs18.15 |
| 14 | returnRequests 集合 | ✅ 通过 | healthCheck 返回 `returnRequests: { status:"ok", count:0 }`，集合已存在 |
| 15 | deploy.sh 方案有效性 | ❌ 未通过 | deploy.sh 复制了 lib 文件到函数目录，但 index.js 仍 `require('../lib/xxx')`，路径未改为 `require('./xxx')` |

---

## 二、阻塞级问题详情

### P0: 25 个云函数部署后完全不可用

**现象**:
```
tcb fn invoke cancelOrder → Cannot find module '../lib/response'
tcb fn invoke getProducts → Cannot find module '../lib/response'
```

**根因**: CloudBase CLI 独立打包每个云函数目录，不会包含 `../lib/` 路径。本地代码使用 `require('../lib/response')`，部署后 `../lib/` 不存在，函数启动即崩溃。

**之前能运行的旧版本已被覆盖**: getProducts 旧版返回 `code:0` 和 344 条产品（见 `docs/runtime-evidence.md` §4.5），现在已不可用。

### P1: 分层架构覆盖率不足

cancelOrder 是唯一完整的三层实现。其余 25 个函数未拆分 `validate()` / `doXxx()`，不满足架构文档 `architecture-overview.md` §6.8 的要求。

### P2: 内部错误消息泄露（2 处）

| 文件 | 行号 | 泄露方式 |
|------|------|---------|
| `cloudfunctions/healthCheck/index.js` | 18 | `e.message` 放入 errors 数组返回客户端 |
| `cloudfunctions/importProducts/index.js` | 75, 77 | `err.message` / `reason.message` 放入 results.errors 返回 |

---

## 三、是否影响进入业务开发

**影响。P0 问题阻断所有业务功能。**

具体影响:
- 小程序端调用任意云函数（除 healthCheck）均返回 `statusCode:443` 模块缺失错误
- 用户登录、商品浏览、下单、管理后台全部不可用
- 此前已部署的旧版（能工作但错误码不规范）已被覆盖

必须修复 P0 才能开始业务开发。

---

## 四、修复方案（最小改动）

**修复 P0（1 步）**:

将所有云函数 index.js 中的 `require('../lib/xxx')` 改为 `require('./xxx')`，使路径与 CLI 打包行为一致。deploy.sh 已负责在部署前复制 lib 文件到函数目录，复制后 `./response.js` 存在，require 即可正确解析。

涉及文件: 25 个 cloudfunctions/*/index.js（healthCheck 除外，它已经独立）。

```bash
# 批量替换
cd E:/miniprogram
for d in cloudfunctions/*/; do
  name=$(basename "$d")
  [ "$name" = "lib" ] && continue
  [ "$name" = "healthCheck" ] && continue
  sed -i "s|require('\.\./lib/|require('./|g" "$d/index.js"
  echo "$name: done"
done
```

**修复 P2（2 处）**:

1. healthCheck/index.js 行18: `.catch(e => ({ name, status: 'error' }))` — 移除 `message: e.message`
2. importProducts/index.js 行75,77: `err.message` → 固定文案 `'导入失败'`

修复后执行 `bash deploy.sh` 部署全部函数。

---

## 五、结论

**当前后端架构不可以开始写业务功能。**

原因: P0 阻塞 — 25/26 云函数部署后因模块路径问题无法启动。本地代码质量（响应格式、错误码、鉴权、日志、依赖管理）已通过验收，但部署链路断裂，所有业务功能在云端不可用。

修复 P0 后（约 5 分钟操作），后端架构可以开始承载业务功能开发。
