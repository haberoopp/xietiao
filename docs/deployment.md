# 部署文档

> 版本: 1.0 | 更新: 2026-06-18

---

## 1. 环境信息

| 项目 | 值 |
|------|-----|
| 环境 ID | `cloudbase-d6g98vaoyb7ec331a` |
| 环境类型 | 微信云开发（通过微信开发者工具创建） |
| 计费模式 | 按量付费 |
| 区域 | 上海（`ap-shanghai`） |
| 小程序 AppID | `wxd3563090dd0a78f0` |

**注意**：当前只有一个环境（生产环境）。无独立的 staging/testing 环境。

---

## 2. 部署工具

| 工具 | 版本 | 用途 |
|------|------|------|
| CloudBase CLI (`tcb`) | 3.5.7 | 云函数部署 |
| 微信开发者工具 | 最新稳定版 | 小程序预览/上传/发布 |
| Node.js | 18.15 | 云函数运行时 |

---

## 3. 前置条件

### 3.1 一次性配置（已完成，记录备查）

```bash
# 1. 安装 tcb CLI
npm install -g @cloudbase/cli

# 2. 登录（浏览器设备码方式 — 微信创建的环境必须用此方式）
tcb login
# → 浏览器打开 https://cloud.tencent.com/ 扫码登录
# → 选择与微信小程序关联的腾讯云账号
# → 设备码确认

# 3. 验证登录
tcb env list
# 应显示 cloudbase-d6g98vaoyb7ec331a
```

**为什么不能用 API Key**：微信开发者工具创建的云环境（`cloudbase-*`）与腾讯云 CAM 账号体系不完全打通。API Key（SecretId/SecretKey）无法操作此类环境，必须使用浏览器设备码登录。

### 3.2 配置文件

`cloudbaserc.json` 位于项目根目录，列出所有需要部署的云函数及配置。**每次新增云函数后必须更新此文件。**

---

## 4. 部署流程

### 4.1 部署单个云函数

```bash
cd E:/miniprogram
tcb fn deploy 函数名 --force
```

示例：
```bash
tcb fn deploy submitOrder --force
tcb fn deploy getProducts --force
```

### 4.2 部署所有云函数

```bash
cd E:/miniprogram
printf "y\n" | tcb fn deploy --force
```

`printf "y\n"` 用于自动确认覆盖已存在的云函数。

### 4.3 部署后验证

```bash
# 列出已部署的云函数
tcb fn list

# 测试云函数连通性
tcb fn invoke getProducts --params '{"page":1,"pageSize":1}'
```

预期输出包含 `"code":0`。

---

## 5. 当前云函数清单（25 个）

### 需部署的函数（在 cloudbaserc.json 中注册）

| 函数名 | 超时 | 运行时 | 依赖 |
|--------|------|--------|------|
| `submitOrder` | 30s | Nodejs18.15 | wx-server-sdk |
| `getMyOrders` | 30s | Nodejs18.15 | wx-server-sdk |
| `adminGetReturns` | 30s | Nodejs18.15 | wx-server-sdk |
| `importProducts` | 30s | Nodejs18.15 | wx-server-sdk, xlsx |
| `adminOrderImage` | 30s | Nodejs18.15 | wx-server-sdk |
| `seedAdmin` | 30s | Nodejs18.15 | wx-server-sdk |
| `getProducts` | 30s | Nodejs18.15 | wx-server-sdk |
| `adminUpdateOrderStatus` | 30s | Nodejs18.15 | wx-server-sdk |
| `adminHandleReturn` | 30s | Nodejs18.15 | wx-server-sdk |
| `cancelOrder` | 30s | Nodejs18.15 | wx-server-sdk |

### 其余云函数（通过微信开发者工具上传或待加入 cloudbaserc.json）

| 函数名 | 说明 |
|--------|------|
| `adminLogin` | 管理员登录 |
| `adminLogout` | 管理员登出 |
| `adminGetOrders` | 订单列表（管理） |
| `adminAddProduct` | 添加产品 |
| `adminUpdateProduct` | 更新产品 |
| `adminDeleteProduct` | 删除产品 |
| `adminDeleteOrderImage` | 删除订单图片 |
| `adminTogglePickedUp` | 切换已拿货 |
| `adminUpdateOrderPrice` | 改订单金额 |
| `addressCRUD` | 地址簿 CRUD |
| `customerCRUD` | 客户 CRUD |
| `initAdminAccounts` | 初始化管理员 |
| `requestReturn` | 申请退换货 |
| `subscribeAdmin` | 管理员订阅消息 |
| `updateOrder` | 修改订单 |

---

## 6. 数据库部署

### 6.1 集合创建

7 个集合需在**微信开发者工具 → 云开发控制台 → 数据库**中手动创建：

| 集合名 | 权限 | 索引建议 |
|--------|------|---------|
| `products` | 所有用户可读，仅管理员可写 | `category`, `createdAt` |
| `orders` | 仅创建者可读写 | `_openid`, `createdAt`, `status` |
| `admins` | 所有用户可读 | `username`（唯一） |
| `addresses` | 仅创建者可读写 | `_openid` |
| `customers` | 所有用户可读，仅管理员可写 | `phone`（唯一） |
| `returnRequests` | 仅创建者可读写 | `_openid`, `orderId`, `createdAt` |
| `adminSubscriptions` | 所有用户可读 | `_openid` |

### 6.2 初始化种子数据

部署完成后执行：

```bash
tcb fn invoke seedAdmin
```

将创建 3 个预置管理员账号。也可通过微信开发者工具直接调用 `seedAdmin` 云函数。

---

## 7. 回滚

CloudBase 不支持云函数版本回滚。回滚策略是**从 git 恢复旧版本代码 → 重新部署**：

```bash
# 1. 查看历史提交
git log --oneline

# 2. 恢复特定云函数到历史版本
git checkout <commit-hash> -- cloudfunctions/函数名/

# 3. 重新部署
tcb fn deploy 函数名 --force

# 4. 提交回滚
git add cloudfunctions/函数名/
git commit -m "rollback 函数名 to <commit-hash>"
```

---

## 8. 常见问题

### Q: 部署报 `FUNCTION_NOT_FOUND`

该云函数从未创建过。通过微信开发者工具手动创建一次（右键 → 上传并部署），之后就可以用 CLI 部署。

### Q: 部署报 `ResourceUnavailable.ResourceExist`

`printf "y\n"` 没生效或云函数被锁定。在微信开发者工具中手动删除云函数后重试。

### Q: `tcb login` 后 `env list` 为空

浏览器登录的腾讯云账号与微信小程序关联的账号不一致。确认登录时选择的账号是小程序管理员的账号。

### Q: 云函数超时

检查 `config.json` 中 `timeout` 设置。默认 3 秒远超不够，本项目的云函数均设为 30 秒。

### Q: 订阅消息 `errCode: 20001`

模板 ID 与当前环境不匹配。需在微信公众平台 → 订阅消息 → 重新申请模板，更新到 `utils/constants.js` 和所有 `notify.js` 中。

---

## 9. 发布到微信

```bash
# 1. 部署所有云函数（如上述步骤）
# 2. 在微信开发者工具中：
#    → 编译 → 预览（扫码测试）→ 上传
# 3. 登录微信公众平台 mp.weixin.qq.com：
#    → 版本管理 → 选择刚上传的版本 → 提交审核
# 4. 审核通过后 → 发布
```

**注意**：小程序端的 `envId` 硬编码在 `app.js` 中（`cloudbase-d6g98vaoyb7ec331a`），如需切换环境需修改此值并重新上传小程序。
