# 温州斜条批发 — Web管理后台设计文档

> 版本: 1.0 | 日期: 2026-06-20 | 状态: 待审核

---

## 一、项目背景

温州斜条批发已有微信小程序（CloudBase云开发），小程序内置管理后台可在手机上完成基础管理操作。但手机端存在屏幕小、批量操作不便、无法打印、缺少图表分析等限制，需要一个独立的Web管理后台。

**Web端定位**：桌面端效率工具，与小程序共享同一CloudBase数据库，鉴权体系独立。

---

## 二、技术选型

| 项 | 选型 | 说明 |
|----|------|------|
| 前端框架 | Vue 3 + Element Plus Admin | 基于 element-plus 的后台模板 |
| 图表 | ECharts 5 | 仪表盘可视化 |
| HTTP客户端 | axios | 调用CloudBase HTTP云函数 |
| 后端 | CloudBase 云函数（HTTP触发器） | 与小程序共享数据库，新增web专用云函数 |
| 鉴权 | JWT（jsonwebtoken） | 登录后签发token，后续请求Header携带 |
| 数据库 | CloudBase 文档数据库 | 复用现有8个集合，新增2个集合 |
| 部署 | CloudBase 静态托管 | web打包后上传到CloudBase静态站点 |

### 2.1 鉴权方案

```
小程序端鉴权（现有，不动）：
  用户登录 → cloud.getWXContext().OPENID → admins.lastLoginOpenid → 通过

Web端鉴权（新增）：
  用户登录 → POST /adminLoginWeb → 验证用户名密码 → 签发JWT → 前端存localStorage
  后续请求 → Authorization: Bearer <jwt> → 云函数校验JWT → 通过
```

### 2.2 云函数策略

- **小程序云函数（25个）：不动**，继续通过 `wx.cloud.callFunction` 调用
- **Web云函数（新增）**：在 `cloudfunctions/` 下新建，开启HTTP触发器，web端通过HTTPS调用
- 两边共享同一个CloudBase数据库，数据实时互通

---

## 三、功能模块

### 3.1 仪表盘

| 区块 | 内容 | 数据来源 |
|------|------|---------|
| 概览卡片 | 今日订单数、今日销售额、待处理数、未收款(元)、缺货SKU数 | `orders` + `products` 集合 |
| 日期切换 | 今天 / 近7天 / 近30天 | 前端过滤 `createdAt` |
| 趋势图 | ECharts折线图：近7天每日订单量+销售额双轴 | `orders` 按天聚合 |
| 品类饼图 | 销售额按品类（色丁/凉感丝/丝纹/全棉等）占比 | `orders.items` 关联 `products.category` |
| 产品排行 | Top10产品销量柱状图 + 列表 | 同上聚合排序 |
| 客户排行 | Top10客户消费额柱状图 + 列表 | `orders` 按 `phone` 聚合 |
| 缺货预警 | 库存状态为 `out` / `low` 的产品列表，标红色 | `products` 集合 |

### 3.2 订单管理

| 功能 | 说明 |
|------|------|
| 订单列表 | 分页表格：订单号、客户名、电话、商品摘要、金额、状态、付款状态、拿货方式、时间 |
| 筛选 | 按状态（处理中/已完成/已取消）、付款状态、拿货方式、日期范围筛选 |
| 搜索 | 按客户名、手机号模糊搜索 |
| 订单详情 | 抽屉/弹窗：完整商品列表、金额明细、客户信息、凭证图片、退换货信息 |
| 改订单状态 | processing → completed / cancelled |
| 改订单价格 | 弹窗修改 totalAmount |
| 批量改状态 | 勾选多单 → 批量标记已完成/已取消 |
| 上传凭证 | 图片上传（送货单/签收单等） |
| 切换已拿货 | pickedUp 状态切换 |
| 退换货审核 | 审核退换货申请：通过/拒绝/标记完成 |
| Excel导出 | 导出当前筛选结果为Excel |
| 打印发货单 | 选中订单 → 浏览器打印（含客户信息、商品列表、金额） |

### 3.3 产品管理

| 功能 | 说明 |
|------|------|
| 产品列表 | 分页表格：图片、名称、分类、单价、单位、库存、状态 |
| 搜索 | 按名称、分类模糊搜索 |
| 新增/编辑 | 表单弹窗：名称、分类、单价、单位、库存、状态、描述、图片（支持多张） |
| 删除 | 单品删除 / 批量勾选删除 |
| 批量编辑 | 勾选多产品 → 批量改分类/单位/状态 |
| Excel导入 | CSV或Excel文件上传导入（复用现有 `importProducts`） |
| Excel导出 | 导出当前筛选结果为Excel |
| 库存预警 | `out` / `low` 状态行标红，顶部统计数 |
| 图片管理 | 多张图片，支持预览和删除 |

### 3.4 客户管理

| 功能 | 说明 |
|------|------|
| 客户列表 | 分页表格：名称、手机号、累计订单数、累计消费、欠款 |
| 搜索 | 按名称、手机号搜索 |
| 新增/编辑 | 表单弹窗 |
| 客户详情 | 独立页面：基本信息 + 消费历史(订单列表) + 欠款明细 + 专属定价一览 |
| Excel导入 | 批量导入客户 |
| Excel导出 | 导出客户列表 |

### 3.5 专属定价

| 功能 | 说明 |
|------|------|
| 定价列表 | 表格：客户、产品、标准价、专属价、差价 |
| 筛选 | 按客户手机号、产品名筛选 |
| 新增/编辑 | 选择客户 + 选择产品 → 输入专属价（元） |
| 批量Excel导入 | 上传Excel同时设置多个客户多个产品价格 |
| 批量删除 | 勾选多条删除 |
| 价格变动记录 | 专属价修改历史（谁、什么时候、从多少改到多少）|

### 3.6 财务管理

| 功能 | 说明 |
|------|------|
| 应收总览 | 卡片：总应收、已收、未收、逾期笔数 |
| 欠款列表 | 表格：客户、订单号、订单金额、已付、未付、下单日期 |
| 收款登记 | 对某订单录入收款金额，可部分收款 |
| 收款记录 | 收款历史列表 |
| 日收入统计 | 按天汇总实收金额 |
| 月收入统计 | 按月汇总，ECharts柱状图 |

### 3.7 管理员管理

| 功能 | 说明 |
|------|------|
| 管理员列表 | 表格：用户名、昵称、角色、状态、最后登录时间 |
| 新增管理员 | 输入用户名、密码、昵称、角色 |
| 编辑 | 修改昵称、角色 |
| 禁用/启用 | 禁用的账号无法登录 |
| 修改密码 | 输入旧密码+新密码 |

### 3.8 操作日志

| 功能 | 说明 |
|------|------|
| 日志列表 | 表格：时间、操作人、操作类型、目标对象、详情 |
| 筛选 | 按操作人、操作类型、日期范围筛选 |

**记录的操作类型**：
- 订单：改状态、改价格、删除
- 产品：新增、编辑、删除
- 定价：修改专属价
- 财务：收款登记
- 管理员：新增、禁用、改密码

### 3.9 系统设置

| 功能 | 说明 |
|------|------|
| 产品分类管理 | 表格：分类名称、产品数量。增删改分类名 |

---

## 四、数据库新增集合

### 4.1 operationLogs — 操作日志

| 字段 | 类型 | 说明 |
|------|------|------|
| `_id` | string | 自动 |
| `operator` | string | 操作人用户名 |
| `action` | string | 操作类型：`order.status` / `order.price` / `product.create` / `product.update` / `product.delete` / `pricing.set` / `payment.record` / `admin.create` / `admin.disable` / `admin.password` |
| `target` | string | 操作对象标识（如订单号、产品名） |
| `detail` | string | 操作详情（如"订单状态改为已完成"、"单价从1.50改为1.20"） |
| `createdAt` | Date | 操作时间 |

### 4.2 priceHistory — 定价变动记录

| 字段 | 类型 | 说明 |
|------|------|------|
| `_id` | string | 自动 |
| `customerPhone` | string | 客户手机号 |
| `productId` | string | 产品ID |
| `oldPrice` | integer | 旧价格（分） |
| `newPrice` | integer | 新价格（分） |
| `operator` | string | 操作人用户名 |
| `createdAt` | Date | 变动时间 |

### 4.3 现有集合新增字段

**admins**：
- `status`: `'active'` / `'disabled'` — 账号状态（默认active）
- `createdBy`: string — 创建者用户名

**products**：
- `images`: string[] — 多张图片fileID数组（兼容现有单张`image`字段）

---

## 五、Web专用云函数（新增）

所有以下云函数均开启**HTTP触发器**，路径前缀 `/api/admin/`。

| 云函数 | 方法 | 路径 | 说明 |
|--------|------|------|------|
| `adminLoginWeb` | POST | `/api/admin/login` | 登录，返回JWT |
| `adminLogoutWeb` | POST | `/api/admin/logout` | 登出 |
| `adminGetDashboard` | GET | `/api/admin/dashboard` | 仪表盘数据 |
| `adminGetOrders` | GET | `/api/admin/orders` | 订单列表（分页+筛选） |
| `adminGetOrderDetail` | GET | `/api/admin/orders/:id` | 订单详情 |
| `adminUpdateOrder` | PUT | `/api/admin/orders/:id` | 改订单 |
| `adminBatchUpdateOrders` | POST | `/api/admin/orders/batch` | 批量改状态 |
| `adminExportOrders` | GET | `/api/admin/orders/export` | 导出Excel |
| `adminGetProducts` | GET | `/api/admin/products` | 产品列表 |
| `adminSaveProduct` | POST/PUT | `/api/admin/products` | 新增/编辑产品 |
| `adminBatchProducts` | POST | `/api/admin/products/batch` | 批量操作 |
| `adminExportProducts` | GET | `/api/admin/products/export` | 导出Excel |
| `adminImportProducts` | POST | `/api/admin/products/import` | 导入Excel |
| `adminGetCustomers` | GET | `/api/admin/customers` | 客户列表 |
| `adminGetCustomerDetail` | GET | `/api/admin/customers/:phone` | 客户详情 |
| `adminSaveCustomer` | POST/PUT | `/api/admin/customers` | 新增/编辑客户 |
| `adminImportCustomers` | POST | `/api/admin/customers/import` | 导入客户Excel |
| `adminExportCustomers` | GET | `/api/admin/customers/export` | 导出客户Excel |
| `adminGetPrices` | GET | `/api/admin/prices` | 定价列表 |
| `adminSetPrice` | POST/PUT | `/api/admin/prices` | 设置专属价 |
| `adminBatchPrices` | POST | `/api/admin/prices/batch` | 批量操作定价 |
| `adminImportPrices` | POST | `/api/admin/prices/import` | 导入定价Excel |
| `adminGetFinance` | GET | `/api/admin/finance` | 财务总览+欠款列表 |
| `adminRecordPayment` | POST | `/api/admin/finance/payment` | 收款登记 |
| `adminGetPaymentHistory` | GET | `/api/admin/finance/payments` | 收款记录 |
| `adminGetAdmins` | GET | `/api/admin/admins` | 管理员列表 |
| `adminSaveAdmin` | POST/PUT | `/api/admin/admins` | 新增/编辑管理员 |
| `adminChangePassword` | PUT | `/api/admin/admins/password` | 修改密码 |
| `adminGetLogs` | GET | `/api/admin/logs` | 操作日志 |
| `adminGetSettings` | GET | `/api/admin/settings` | 系统设置 |
| `adminSaveSettings` | PUT | `/api/admin/settings` | 保存设置 |

---

## 六、前端路由结构

```
/admin
  /login              — 登录页
  /dashboard          — 仪表盘
  /orders             — 订单列表
  /orders/:id         — 订单详情（弹窗/抽屉方式也可以）
  /products           — 产品列表
  /customers          — 客户列表
  /customers/:phone   — 客户详情
  /pricing            — 专属定价
  /finance            — 财务管理
  /admins             — 管理员管理
  /logs               — 操作日志
  /settings           — 系统设置
```

---

## 七、权限设计

| 角色 | 仪表盘 | 订单 | 产品 | 客户 | 定价 | 财务 | 管理员 | 日志 | 设置 |
|------|--------|------|------|------|------|------|--------|------|------|
| 厂长(manager) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 送货员(delivery) | ❌ | ✅(仅配送) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 仓库调货员(warehouse) | ❌ | ✅(仅物流) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

- 厂长：全部权限
- 送货员：只能看 `deliveryMethod === 'delivery'` 的订单，可上传凭证、切换已拿货
- 仓库调货员：只能看 `deliveryMethod === 'logistics'` 的订单，可上传凭证

---

## 八、待确认项

1. **打印发货单模板**：具体格式？（公司抬头、备注区、印章位等）→ 可先用简单表格打印，后续按需调整
2. **收款是否支持部分收款**：目前设计支持部分收款，如不需要可简化为全额收款

---

## 九、不包含的内容（本期不做）

- 小程序端功能修改
- 微信订阅消息从web端管理（需要微信相关能力，仍在手机端操作）
- 生产管理（生产批次、排产）
- 供应商管理
- 多语言
- 移动端适配（web端专为桌面设计）
