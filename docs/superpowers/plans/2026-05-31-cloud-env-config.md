# 配置微信云开发环境 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将项目从演示模式切换到真实的微信云开发环境——配置 envId、部署 16 个云函数、创建 6 个数据库集合、预置管理员账号。

**Architecture:** 微信云开发使用 `cloud.DYNAMIC_CURRENT_ENV` 自动读取环境 ID，所有云函数已编写完毕。`app.js` 是唯一需要修改 envId 的位置。数据库集合通过微信开发者工具创建。管理员账号通过云函数 `adminLogin` 的密码哈希逻辑 (`pbkdf2`) 预置。

**Tech Stack:** 微信云开发（小程序·云开发）、Node.js 云函数、`wx-server-sdk`

---

## 前置条件（手动操作，不可自动化）

以下步骤需要用户在微信开发者工具中手动完成，无法通过代码自动化：

- **手动步骤 A：创建云开发环境**
  1. 打开微信开发者工具 → 顶部菜单「云开发」
  2. 如果没有开通云开发，按提示开通（需要小程序管理员扫码）
  3. 点击「新建环境」→ 环境名称如 `wenzhou-pifa`
  4. 选择「按量付费」或「预付费」→ 确认创建
  5. 等待环境初始化完成（约30秒）
  6. **记录环境 ID**（格式如 `wenzhou-pifa-xxx`），后续步骤需要用到

- **手动步骤 B：开通云开发数据库权限**
  1. 在云开发控制台 → 数据库 → 点击「开通」
  2. 选择与云函数相同的环境

---

### Task 1: 补齐缺失的云函数依赖文件

**Files:**
- Create: `miniprogram/cloudfunctions/adminLogout/package.json`
- Modify: `miniprogram/cloudfunctions/updateOrder/package.json`

云函数部署需要每个函数目录有 `package.json`。`adminLogout` 缺失该文件，`updateOrder` 缺少 `wx-server-sdk` 依赖。

- [ ] **Step 1: 创建 adminLogout/package.json**

```json
{
  "name": "adminLogout",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "~2.6.3"
  }
}
```

- [ ] **Step 2: 修复 updateOrder/package.json 缺少依赖**

将文件内容改为：

```json
{
  "name": "updateOrder",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "~2.6.3"
  }
}
```

- [ ] **Step 3: 提交**

```bash
git add miniprogram/cloudfunctions/adminLogout/package.json miniprogram/cloudfunctions/updateOrder/package.json
git commit -m "fix: add missing package.json for adminLogout, add wx-server-sdk dep for updateOrder"
```

---

### Task 2: 配置真实 envId

**Files:**
- Modify: `miniprogram/app.js:10`

将占位符 `'your-env-id'` 替换为用户在手动步骤 A 中获取的真实环境 ID。

- [ ] **Step 1: 询问用户 envId**

向用户确认：**"你的云开发环境 ID 是什么？（在微信开发者工具 → 云开发控制台 → 设置 → 环境ID 可查看，格式类似 `wenzhou-pifa-abc123`）"**

记录用户的 envId，后续步骤用 `<ENV_ID>` 表示。

- [ ] **Step 2: 更新 app.js 中的 envId**

将 `E:/miniprogram/app.js` 第 10 行：
```javascript
const envId = 'your-env-id';
```
替换为：
```javascript
const envId = '<ENV_ID>';
```

- [ ] **Step 3: 提交**

```bash
git add miniprogram/app.js
git commit -m "feat: configure real cloud env ID"
```

---

### Task 3: 创建数据库集合

**工具：** 微信开发者工具 → 云开发控制台 → 数据库

小程序页面端代码包含 `demoMode` 分支，此时切换到云开发模式后需要数据库集合存在才能正常运行。需创建 6 个集合：

- [ ] **Step 1: 创建 `products` 集合**

在云开发控制台 → 数据库 → 点击「添加集合」→ 输入 `products` → 确定。

**权限设置：** 所有用户可读（`read: true`），仅管理员可写（通过云函数校验，权限设为「仅创建者可写」或使用自定义安全规则）。

最小安全规则：
```json
{
  "read": true,
  "write": "doc._openid == auth.openid"
}
```

由于产品管理通过云函数（带管理员鉴权），write 规则可以设为 `false` 强制所有写入走云函数：
```json
{
  "read": true,
  "write": false
}
```

- [ ] **Step 2: 创建 `orders` 集合**

添加集合 → `orders`

**安全规则：**
```json
{
  "read": "doc._openid == auth.openid",
  "write": false
}
```

- [ ] **Step 3: 创建 `admins` 集合**

添加集合 → `admins`

**安全规则（仅管理员自身 + 云函数可访问）：**
```json
{
  "read": false,
  "write": false
}
```

- [ ] **Step 4: 创建 `customers` 集合**

添加集合 → `customers`

**安全规则：**
```json
{
  "read": false,
  "write": false
}
```

- [ ] **Step 5: 创建 `addresses` 集合**

添加集合 → `addresses`

**安全规则：**
```json
{
  "read": "doc._openid == auth.openid",
  "write": false
}
```

- [ ] **Step 6: 创建 `returnRequests` 集合**

添加集合 → `returnRequests`

**安全规则：**
```json
{
  "read": false,
  "write": false
}
```

---

### Task 4: 预置管理员账号

**Files:**
- Create: `miniprogram/cloudfunctions/seedAdmin/index.js`
- Create: `miniprogram/cloudfunctions/seedAdmin/package.json`
- Create: `miniprogram/cloudfunctions/seedAdmin/config.json`

需要在 `admins` 集合中插入 3 个管理员账号（厂长/送货员/仓库调货员），密码使用与 `adminLogin` 云函数相同的 pbkdf2 哈希算法。

- [ ] **Step 1: 创建 seedAdmin 云函数**

`miniprogram/cloudfunctions/seedAdmin/package.json`：
```json
{
  "name": "seedAdmin",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "~2.6.3"
  }
}
```

`miniprogram/cloudfunctions/seedAdmin/config.json`：
```json
{
  "permissions": {
    "openapi": []
  }
}
```

`miniprogram/cloudfunctions/seedAdmin/index.js`：
```javascript
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const crypto = require('crypto');

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

function generateSalt() {
  return crypto.randomBytes(32).toString('hex');
}

const ACCOUNTS = [
  { username: 'changzhang', password: '123456', role: 'manager', nickname: '厂长' },
  { username: 'songhuo', password: '123456', role: 'delivery', nickname: '送货员' },
  { username: 'diaohuo', password: '123456', role: 'warehouse', nickname: '仓库调货员' },
];

exports.main = async () => {
  const results = [];
  for (const account of ACCOUNTS) {
    // 检查是否已存在
    const existing = await db.collection('admins')
      .where({ username: account.username })
      .get();

    if (existing.data.length > 0) {
      results.push({ username: account.username, status: 'skipped', reason: 'already exists' });
      continue;
    }

    const salt = generateSalt();
    const passwordHash = hashPassword(account.password, salt);

    await db.collection('admins').add({
      data: {
        username: account.username,
        passwordHash,
        salt,
        role: account.role,
        nickname: account.nickname,
        failedAttempts: 0,
        lockedUntil: null,
        loggedIn: false,
        lastLoginOpenid: null,
        lastLoginAt: null,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });
    results.push({ username: account.username, status: 'created' });
  }
  return { code: 0, data: results };
};
```

- [ ] **Step 2: 部署 seedAdmin 并运行一次**

在微信开发者工具中：
1. 右键点击 `cloudfunctions/seedAdmin` → 「上传并部署：云端安装依赖」
2. 部署完成后，右键 → 「云端测试」→ 输入 `{}` → 执行
3. 确认返回 `code: 0` 且 3 个账号状态为 `created`

- [ ] **Step 3: 运行完成后删除 seedAdmin 云函数**

在云开发控制台 → 云函数 → 找到 `seedAdmin` → 删除。此函数仅用于一次性初始化，不应留在生产环境中。

或保留作为重置密码的工具，按需决定。

---

### Task 5: 部署全部业务云函数

**Files（16个云函数，全部已存在）:**
- `cloudfunctions/addressCRUD/`
- `cloudfunctions/adminAddProduct/`
- `cloudfunctions/adminDeleteOrderImage/`
- `cloudfunctions/adminDeleteProduct/`
- `cloudfunctions/adminGetOrders/`
- `cloudfunctions/adminGetReturns/`
- `cloudfunctions/adminHandleReturn/`
- `cloudfunctions/adminLogin/`
- `cloudfunctions/adminLogout/`
- `cloudfunctions/adminOrderImage/`
- `cloudfunctions/adminTogglePickedUp/`
- `cloudfunctions/adminUpdateOrderPrice/`
- `cloudfunctions/adminUpdateOrderStatus/`
- `cloudfunctions/adminUpdateProduct/`
- `cloudfunctions/cancelOrder/`
- `cloudfunctions/customerCRUD/`
- `cloudfunctions/getMyOrders/`
- `cloudfunctions/getProducts/`
- `cloudfunctions/importProducts/`
- `cloudfunctions/requestReturn/`
- `cloudfunctions/submitOrder/`
- `cloudfunctions/updateOrder/`

（注：共 22 个目录，其中 `lib/` 是共享模块不算云函数，`seedAdmin/` 是 Task 4 创建的）

- [ ] **Step 1: 逐个部署每个云函数**

在微信开发者工具中，对每个云函数目录右键 → 「上传并部署：云端安装依赖」。

**推荐顺序**（不强制，但按依赖关系排列更方便测试）：
1. 基础服务：`getProducts`, `adminLogin`, `adminLogout`
2. 订单相关：`submitOrder`, `getMyOrders`, `cancelOrder`, `updateOrder`
3. 管理操作：`adminGetOrders`, `adminUpdateOrderStatus`, `adminUpdateOrderPrice`, `adminTogglePickedUp`, `adminOrderImage`, `adminDeleteOrderImage`
4. 产品管理：`adminAddProduct`, `adminUpdateProduct`, `adminDeleteProduct`, `importProducts`
5. 退换货：`requestReturn`, `adminGetReturns`, `adminHandleReturn`
6. 其他：`addressCRUD`, `customerCRUD`

**特别注意 `importProducts`：** 该云函数依赖 `xlsx` npm 包，部署时必须选择「云端安装依赖」（不要选「上传所有文件」）。

- [ ] **Step 2: 提交（记录 envId 后的完整状态）**

```bash
git add -A
git commit -m "chore: complete cloud function deployment-ready state"
```

---

### Task 6: 验证云环境连通性

部署完成后需验证小程序能正常从演示模式切换到云开发模式。

- [ ] **Step 1: 启动小程序并查看控制台**

1. 在微信开发者工具中点击「编译」
2. 打开 Console 面板，查看日志输出
3. **期望输出：** `云开发已连接`（说明 `getProducts` 云函数调用成功）
4. 如果输出 `云函数未部署，使用演示模式`，说明有云函数未部署或部署失败

- [ ] **Step 2: 验证产品列表加载**

1. 在首页查看产品列表 — 因为没有产品数据，应显示空状态「暂无产品」
2. 下拉刷新 — 不应报错

- [ ] **Step 3: 测试管理员登录**

1. 切换到「后台」tab
2. 输入账号 `changzhang` / 密码 `123456`
3. 点击登录
4. **期望结果：** 登录成功，自动跳转到管理订单页
5. 退出登录：点击页面底部「退出登录」

- [ ] **Step 4: 测试完整下单流程**

1. 首先在后台 → 产品管理 → 添加一个测试产品
2. 回到首页 → 找到该产品 → 点击加入购物车
3. 悬浮购物车点击「去结算」
4. 填写客户信息 → 提交订单
5. 切换到「我的订单」tab → 确认订单出现
6. 切换到后台 → 确认订单出现在管理列表中

---

### Task 7: 导入演示数据（可选）

如果希望保留原演示模式中 12 个产品的数据作为初始数据：

- [ ] **Step 1: 通过后台 CSV 导入**

1. 创建一个 CSV 文件 `products.csv`，内容如下（UTF-8 with BOM）：

```
名称,分类,单价,单位,库存,描述
色丁精品缎面 2cm,色丁,1.50,米,1000,高档色丁面料，宽度2cm，光泽亮丽
色丁格子斜条 1.5cm,色丁,0.80,米,2000,色丁材质格子纹，宽度1.5cm
凉感丝包边条 3cm,凉感丝,2.00,米,800,凉感丝面料，凉爽透气，宽度3cm
凉感丝斜条 2.5cm,凉感丝,1.80,米,1200,凉感丝人字纹，宽度2.5cm
丝纹缎面条 5cm,丝纹,0.60,米,500,丝纹纹理面料，宽度5cm
丝纹仿真丝条 4cm,丝纹,1.20,米,900,仿真丝处理丝纹面料，宽度4cm
全棉斜纹包边条 2cm,全棉,0.50,米,3000,100%全棉材质，柔软亲肤，宽度2cm
全棉本白条 1.5cm,全棉,0.35,米,2500,全棉本白，宽度1.5cm，基础款
圆盘花边缎带 15mm,圆盘,0.90,米,600,圆盘花边设计，直径15mm
圆盘刺绣缎带,圆盘,1.20,米,400,圆盘刺绣花纹，精致工艺
弹性松紧带 1cm,其他,0.35,米,5000,高弹力松紧带，宽度1cm
蕾丝花边条 0.8cm,其他,0.45,米,3500,精致蕾丝花边，宽度0.8cm
```

2. 将文件通过微信发送到「文件传输助手」
3. 在后台 → 产品管理 → 点击「导入」→ 选择「导入CSV文件」→ 从聊天记录选择 `products.csv`

- [ ] **Step 2: 确认导入完成**

导入后确认首页 12 个产品全部显示，分类筛选正常。

---

### 总结：环境结构一览

| 资源 | 数量 | 备注 |
|------|------|------|
| 云函数 | 22 个 | 16 个业务 + 1 个 seedAdmin(用完删) + lib(共享) + 2 个配置目录 |
| 数据库集合 | 6 个 | products, orders, admins, customers, addresses, returnRequests |
| 管理员账号 | 3 个 | changzhang/123456(厂长), songhuo/123456(送货), diaohuo/123456(调货) |
| 产品数据 | 12 个 | 通过 CSV 导入（可选） |

**数据库集合 Schema 参考：**

| 集合 | 关键字段 | 说明 |
|--------|---------------|---------|
| `products` | name, category, price(分), unit, stock, status, image | 产品目录 |
| `orders` | customerName, phone, address, items[], totalAmount, status, deliveryMethod, _openid | 订单 |
| `admins` | username, passwordHash, salt, role, loggedIn | 管理员 |
| `customers` | name, phone, discount, totalOrders, totalAmount | 客户 |
| `addresses` | name, phone, address, _openid, isDefault | 收货地址 |
| `returnRequests` | orderId, _openid, type, items[], status, rejectionCount | 退换货申请 |
