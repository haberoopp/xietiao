# 温州斜条批发

> B2B 纺织品辅料（斜条/缎带/包边条）移动端订货工具 · 微信小程序

---

## 项目概览

| 项目 | 说明 |
|------|------|
| 类型 | 微信小程序 + CloudBase 云开发 |
| 语言 | JavaScript ES6+ |
| 后端 | CloudBase 云函数 (Node.js 18.15) |
| 数据库 | CloudBase 文档数据库 (7 个集合) |
| 用户角色 | 3 种管理员（厂长/送货员/仓库调货员）+ 匿名客户 |
| 文档 | [架构设计](docs/architecture-overview.md) · [数据模型](docs/data-model.md) · [API 参考](docs/api-reference.md) · [部署文档](docs/deployment.md) · [编码规范](docs/standards/) |

---

## 快速开始

### 前置条件

- [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)（最新稳定版）
- 微信小程序 AppID（在微信公众平台注册）
- Node.js ≥ 14（仅用于 CLI 部署云函数）

### 1. 克隆并打开项目

```bash
git clone <repo-url>
# 用微信开发者工具打开 E:\miniprogram 目录
# 导入时填写你的小程序 AppID
```

### 2. 配置云开发环境

1. 微信开发者工具 → 顶部菜单「云开发」→ 开通云开发
2. 创建环境（选择「按量付费」或「预付费」）
3. 记录环境 ID（格式如 `cloudbase-xxxxxxxxx`）

### 3. 修改环境 ID

编辑 `app.js` 第 26 行，将 `envId` 替换为你的环境 ID：

```js
// app.js
initCloud() {
  const envId = '你的环境ID';  // ← 改这里
  // ...
}
```

编辑 `cloudbaserc.json` 第 3 行：

```json
{
  "version": "2.0",
  "envId": "你的环境ID",     // ← 改这里
  ...
}
```

### 4. 创建数据库集合

在云开发控制台 → 数据库 → 创建以下 7 个集合：

| 集合名 | 权限 |
|--------|------|
| `products` | 所有用户可读，仅管理员可写 |
| `orders` | 仅创建者可读写 |
| `admins` | 所有用户可读 |
| `addresses` | 仅创建者可读写 |
| `customers` | 所有用户可读，仅管理员可写 |
| `returnRequests` | 仅创建者可读写 |
| `adminSubscriptions` | 所有用户可读 |

### 5. 部署云函数

```bash
# 安装 CloudBase CLI
npm install -g @cloudbase/cli

# 登录（浏览器设备码方式 — 微信创建的环境必须用此方式）
tcb login
# → 浏览器打开，扫码登录与小程序关联的腾讯云账号
# → 返回终端确认

# 部署所有云函数
cd E:/miniprogram
printf "y\n" | tcb fn deploy --force
```

### 6. 初始化管理员账号

```bash
tcb fn invoke initAdminAccounts
```

这将创建 3 个预置账号。也可在微信开发者工具中直接调用 `initAdminAccounts` 云函数。

### 7. 配置订阅消息模板（可选）

1. 登录微信公众平台 → 订阅消息 → 选用模板
2. 申请以下类型的模板（或使用已有模板）：
   - 订单状态变更
   - 付款状态变更
   - 退换货结果通知
   - 新订单通知
3. 将获取的模板 ID 更新到 `utils/constants.js` 的 `NOTIFY_TEMPLATES` 中
4. 同步更新 `cloudfunctions/lib/notify.js` 中的 `TEMPLATES`

### 8. 编译运行

微信开发者工具 → 点击「编译」→ 扫码预览

---

## 项目结构

```
├── app.js                     # 入口：云初始化 + 探活 + 降级
├── app.json                   # 路由 + tabBar 配置
├── cloudbaserc.json           # CLI 部署配置
│
├── pages/                     # 前端页面（10 个）
│   ├── index/                 #   首页 — 产品浏览
│   ├── cart/                  #   购物车
│   ├── checkout/              #   结算页
│   ├── orders/                #   我的订单
│   ├── address/               #   地址簿
│   └── admin/                 #   管理后台
│       ├── login/             #     登录
│       ├── dashboard/         #     仪表盘
│       ├── orders/            #     订单管理
│       ├── products/          #     产品管理
│       └── customers/         #     客户管理
│
├── cloudfunctions/            # 后端云函数（25 个）
│   ├── lib/                   #   共享模块
│   │   ├── response.js        #     统一响应
│   │   ├── logger.js          #     结构化日志
│   │   ├── auth.js            #     统一鉴权
│   │   └── notify.js          #     订阅消息
│   ├── healthCheck/           #   健康检查 ← 验证数据库连接
│   ├── getProducts/           #   产品列表
│   ├── submitOrder/           #   下单
│   ├── cancelOrder/           #   取消订单 ← 分层参考实现
│   └── ...                    #   其余 20 个
│
├── utils/                     # 前端工具
├── docs/                      # 架构与规范文档
└── images/                    # 图标资源
```

---

## 测试

### 验证数据库连接

```bash
tcb fn invoke healthCheck
```

预期输出：
```json
{
  "code": 0,
  "data": {
    "record": {
      "db": "ok",
      "collections": {
        "products": { "status": "ok", "count": 1250 },
        "orders": { "status": "ok", "count": 42 },
        ...
      },
      "uptime": 234
    }
  }
}
```

### 验证管理员登录

```bash
tcb fn invoke adminLogin --params '{"username":"changzhang","password":"123456"}'
```

预期输出包含 `"code": 0` 和 `"role": "manager"`。

### 测试产品列表

```bash
tcb fn invoke getProducts --params '{"page":1,"pageSize":5}'
```

预期输出包含 `"code": 0` 和 `"data": { "list": [...], "total": ... }`。

### 客户端测试

1. 微信开发者工具 → 编译 → 控制台查看探活结果
2. 看到 `✅ 云平台连接正常` 表示云函数和数据库均可用
3. 看到 `❌/⚠️` 则自动进入 Demo 模式（本地数据可正常操作）
4. 测试下单流程：浏览 → 加购 → 结算 → 提交 → 我的订单
5. 测试管理后台：底部 Tab「后台」→ 登录（`changzhang` / `123456`）

### 错误日志查看

在微信开发者工具控制台执行：

```js
console.table(wx.getStorageSync('_error_logs') || [])
```

---

## 管理员账号

| 账号 | 密码 | 角色 | 权限 |
|------|------|------|------|
| `changzhang` | `123456` | 厂长 (manager) | 全部：仪表盘、订单、产品、客户 |
| `songhuo` | `123456` | 送货员 (delivery) | 配送订单管理（必须上传凭证才能改状态） |
| `diaohuo` | `123456` | 仓库调货员 (warehouse) | 物流订单管理（必须上传凭证才能改状态） |

---

## 配置参考

| 配置文件 | 位置 | 用途 |
|---------|------|------|
| `app.json` | 根目录 | 页面路由、tabBar、窗口样式 |
| `project.config.json` | 根目录 | 微信开发者工具编译选项 |
| `cloudbaserc.json` | 根目录 | 云函数部署配置（函数名/超时/运行时） |
| `config.json` | 每个云函数目录 | 单个云函数的 timeout + permissions |
| `utils/constants.js` | utils/ | 产品分类、模板 ID、状态映射 |

---

## 文档索引

| 文档 | 说明 |
|------|------|
| [架构设计](docs/architecture-overview.md) | 14 章立项级文档：选型理由、分层架构、路由、API 响应、错误处理、日志、数据库、权限、模块拓展 |
| [数据模型](docs/data-model.md) | 7 个集合的完整 Schema |
| [API 参考](docs/api-reference.md) | 25 个云函数的入参/出参/错误码 |
| [部署文档](docs/deployment.md) | 环境配置、部署流程、回滚、常见问题 |
| [代码规范](docs/standards/coding-standards.md) | JS/WXML/WXSS 命名、风格、注释 |
| [API 响应标准](docs/standards/api-response.md) | 5 种成功 + 6 种失败场景 |
| [错误处理规范](docs/standards/error-handling.md) | 三层架构 + Toast 规范 |
| [日志规范](docs/standards/logging.md) | 三级结构化日志 |
| [模块拓展指南](docs/standards/module-extension.md) | 新增页面/云函数的完整步骤 |

---

## 常见问题

**Q: 部署报 `FUNCTION_NOT_FOUND`？**
该云函数从未创建过。在微信开发者工具中右键云函数目录 →「上传并部署」首次创建，之后即可用 CLI 部署。

**Q: 订阅消息 `errCode: 20001`？**
模板 ID 与环境不匹配。需在微信公众平台重新申请模板，更新 `constants.js` 和 `notify.js`。

**Q: 云函数超时？**
检查云函数目录下的 `config.json`，`timeout` 应设为 20-30 秒（默认仅 3 秒）。

**Q: 客户端一直显示 Demo 模式？**
检查 `app.js` 中 `envId` 是否正确，确认云函数已部署且在微信开发者工具中开通了云开发。
