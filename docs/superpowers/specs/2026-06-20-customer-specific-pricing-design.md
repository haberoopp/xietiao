# 客户专属定价功能设计文档

> 版本: 1.0 | 日期: 2026-06-20 | 状态: 待评审

---

## 一、需求背景

### 1.1 现状问题

当前系统通过 `customers.discount` 字段为每个客户设置统一折扣（如 0.85 = 85折），结算时对所有商品统一打折。这在实际批发场景中存在两个问题：

1. **粒度太粗**：大客户可能只在某几个产品上拿到低价（因为采购量大），不需要所有商品打折
2. **一刀切**：无法针对不同产品设置不同价格，缺乏灵活性

### 1.2 目标

- 移除统一折扣机制，改为 **客户 × 产品** 级别的专属定价
- 客户首次购买走零售价，管理员在后台为该客户针对特定产品设置专属价
- 客户再次购买同一产品时自动按专属价计算
- 未设专属价的产品继续走零售价

### 1.3 范围

| 包含 | 不包含 |
|------|--------|
| 新增 `customerPrices` 数据集合 | 阶梯价（按数量阶梯定价） |
| 新增 `customerPriceCRUD` 云函数 | 客户自主议价 |
| 新增后台定价管理页 | 价格变更历史记录 |
| 改造结算页价格匹配逻辑 | 批量导入专属价 |
| 移除旧 `discount` 机制 | 历史订单价格回溯 |

---

## 二、数据模型

### 2.1 新增集合：`customerPrices`

```
权限: 所有用户可读, 仅管理员可写（通过云函数控制）
索引: customerPhone(升序) + productId(升序) 联合唯一
```

| 字段 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| `_id` | string | 自动 | 文档 ID | `'cp001'` |
| `customerPhone` | string | 是 | 客户手机号，与 `customers.phone` 对应 | `'13800138001'` |
| `productId` | string | 是 | 产品 ID | `'p001'` |
| `productName` | string | 是 | 产品名称（冗余快照，便于后台列表显示） | `'色丁布 2cm'` |
| `customPrice` | integer | 是 | 专属单价（分） | `120` = ¥1.20 |
| `createdAt` | Date | 自动 | 创建时间 | `db.serverDate()` |
| `updatedAt` | Date | 自动 | 更新时间 | `db.serverDate()` |

**唯一性约束**：同一客户 + 同一产品只能有一条专属价记录。云函数内通过 `customerPhone + productId` 联合查询实现 upsert。

**删除语义**：管理员清空专属价输入框 → 删除该条记录，该客户该产品恢复走零售价。

### 2.2 修改集合：`customers`

**删除字段**：`discount`（number）

迁移处理：
- 新建的 `customerPrices` 独立存储，不自动从旧 `discount` 迁移
- 旧订单中 `discount` 字段保留不动（历史快照）

### 2.3 不变集合

| 集合 | 说明 |
|------|------|
| `products` | `price` 继续作为默认零售价，不做修改 |
| `orders` | `items[].price` 继续快照下单时的实际成交价，`discount` 字段保留（历史数据） |

---

## 三、云函数设计

### 3.1 新增：`customerPriceCRUD`

**接口层（`exports.main`）**：

```js
exports.main = async (event) => {
  const { action } = event;

  // getByPhone 是客户侧接口，不需要 admin 鉴权
  if (action === 'getByPhone') {
    return doGetByPhone(event);
  }

  // 其余操作为管理操作，需要 admin 鉴权
  const adminAuth = await auth.requireAdmin();
  if (!adminAuth.authorized) return adminAuth.response;

  switch (action) {
    case 'list':      return doList(event);
    case 'set':       return doSet(event);
    case 'batchSet':  return doBatchSet(event);
    case 'delete':    return doDelete(event);
    case 'batchDelete': return doBatchDelete(event);
    default:          return res.badRequest('未知操作');
  }
};
```

| 操作 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `list` | `page`, `pageSize`, `customerPhone?`, `keyword?` | 分页列表 | 后台管理页加载。支持按客户手机号筛选、产品名搜索 |
| `set` | `customerPhone`, `productId`, `productName`, `customPrice` | ok | 单条新增/更新（upsert） |
| `batchSet` | `customerPhones[]`, `productIds[]`, `customPrice` | `{ updated }` | 批量设置：遍历 phone × productId 笛卡尔积，逐条 upsert |
| `delete` | `customerPhone`, `productId` | ok | 删除单条（清空专属价时调用） |
| `batchDelete` | `entries: [{customerPhone, productId}]` | `{ deleted }` | 批量删除 |
| `getByPhone` | `phone` | `{ list }` | **客户侧接口**：取某客户所有专属价，结算时使用。不需要 admin 鉴权 |

**`getByPhone` 鉴权说明**：此操作为客户结算页调用，不在 admin 鉴权分支内。通过 `requireOpenid()` 校验调用者身份即可（也可不校验，因为仅返回价格映射表不涉及写操作）。

**`batchSet` 逻辑**：
```
输入: customerPhones: ['138...', '139...'], productIds: ['p001', 'p002'], customPrice: 120
结果: 生成 2×2=4 条记录，逐条 upsert
```

### 3.2 不变云函数

| 云函数 | 说明 |
|--------|------|
| `getProducts` | 不变。返回零售价，客户专属价在结算端叠加 |
| `submitOrder` | 不变。`items[].price` 由结算端传入（已解析为最终价格） |
| `customerCRUD` | 需小改：`add`/`update` 移除 `discount` 字段处理；`upsert` 移除 `discount: 1.0` 初始化 |
| `adminUpdateOrderPrice` | 不变（继续支持单订单总价覆写） |

---

## 四、前端改造

### 4.1 结算页（`pages/checkout/checkout.js`）

**改造点**：`matchCustomer()` 和 `formatItems()` 方法。

**新流程**：
```
1. 用户输入手机号（≥11位）
2. matchCustomer(phone):
   a. 调 customerCRUD.getByPhone → 取客户信息（不再使用 discount）
   b. 调 customerPriceCRUD.getByPhone → 取专属价列表 [{productId, customPrice}]
   c. 构建 Map: productId → customPrice
3. formatItems(items):
   a. 遍历每个商品：
      - 如果 Map 中有该 productId → 使用 customPrice
      - 否则 → 使用 item.price（零售价）
   b. 计算 subtotal = resolvedPrice × quantity
4. calcTotal() 汇总
```

**移除**：`customerDiscount` data 字段及相关逻辑。

**订单提交时**：
- `items[].price` 传入已解析的最终价格（专属价或零售价），不再传 `discount` 字段
- `totalAmount` 基于解析后的价格计算

### 4.2 客户管理页（`pages/admin/customers/customers.js`）

**改造点**：
- 表单中移除 `discount` 滑块 / 输入框
- 客户列表移除折扣显示（`discountLabel`）
- `formatCustomers()` 去掉 `discountLabel` 计算
- 新增/编辑客户时不再传入 `discount`

### 4.3 客户管理模板（`pages/admin/customers/customers.wxml`）

- 删除折扣相关 UI 控件（slider、显示标签）

### 4.4 新增：专属定价管理页（`pages/admin/pricing/`）

#### 页面结构

上下两个可折叠/可滚动区域：

- **上半区 — 客户选择区**：搜索框 + 客户多选列表
- **下半区 — 产品定价区**：搜索框 + 批量操作栏 + 产品列表（含专属价输入框） + 保存按钮

#### 数据流

```
onShow():
  1. 并行加载客户列表（customerCRUD.list）和产品列表（getProducts，全量）
  2. 缓存为本地变量 _customers 和 _products

onSelectCustomer():
  3. 调用 customerPriceCRUD.list({ customerPhone: selectedPhones[] })
  4. 将返回的专属价映射为 Map: "phone::productId" → customPrice
  5. 渲染产品列表，已设专属价的显示绿色输入框

onSave():
  6. 对比当前输入值与初始值，diff 出新增/修改/删除
  7. 分别调 batchSet / batchDelete
  8. Toast 提示保存数量
```

#### 交互细节

| 功能 | 行为 |
|------|------|
| 客户搜索 | 实时过滤客户列表（名称/手机号），搜索后多选状态保留 |
| 客户多选 | 勾选多个客户后，下方显示这些客户合并的专属价；同一产品多个客户有不同价时，输入框显示为空白并加占位提示"多个价格" |
| 产品搜索 | 实时过滤产品列表（名称/分类） |
| 全选产品 | 勾选当前筛选结果中的所有产品 |
| 反选产品 | 反转当前筛选结果中的勾选状态 |
| 批量改价 | 弹出输入框 → 填入金额 → 确认 → 所有选中产品的专属价输入框同步更新 |
| 单行改价 | 直接在输入框中修改，带绿色边框标识已设 |
| 清空专属价 | 输入框留空 → 保存时自动调用 delete |
| 保存 | diff 后批量提交，Toast 显示"已保存 X 条，已删除 Y 条" |

#### 多客户价格冲突处理

当选中的多个客户对同一产品已有不同的专属价时，该产品输入框显示空白，placeholder 显示「多个价格」。用户手动输入后统一覆盖。

### 4.5 路由注册

在 `app.json` 的 `pages` 数组中注册：
```json
"pages/admin/pricing/pricing"
```

---

## 五、部署与迁移

### 5.1 部署步骤

1. 部署新云函数 `customerPriceCRUD`（`bash deploy.sh`）
2. 部署修改后的 `customerCRUD`
3. 创建 `customerPrices` 数据库集合
4. 上传前端代码

### 5.2 数据迁移

- `customers` 集合中 `discount` 字段不自动迁移到 `customerPrices`
- 管理员在新管理页中手动为需要的客户设置专属价
- 旧 `discount` 字段保留在数据库中，不影响新逻辑（代码不再读取）

### 5.3 回滚方案

如遇问题，恢复步骤：
1. 回退 `checkout.js` 到旧版（使用 `discount` 逻辑）
2. 回退 `customerCRUD` 到旧版
3. 隐藏 `customerPriceCRUD` 云函数
4. `customerPrices` 集合保留不动（不造成数据丢失）

---

## 六、安全与性能

### 6.1 安全

| 操作 | 鉴权方式 |
|------|---------|
| `customerPriceCRUD.list/set/batchSet/delete/batchDelete` | `auth.requireAdmin()` |
| `customerPriceCRUD.getByPhone` | 无需 admin，仅查询价格映射表 |

### 6.2 性能

- **产品列表加载**：已有缓存机制（`cache_admin_products`），定价页复用
- **专属价查询**：`getByPhone` 按 `customerPhone` 查询，数据量小（每客户通常几十条以内），无需分页
- **批量保存**：`batchSet` 在云函数内逐条 upsert（CloudBase 不支持批量 upsert），每次批量操作通常不超过几十条，在 10s timeout 内完成
- **结算页**：增加一次 `getByPhone` 调用（与现有 `customerCRUD.getByPhone` 并行），不增加用户感知延迟

---

## 七、文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `cloudfunctions/customerPriceCRUD/index.js` | 新增 | 专属价 CRUD 云函数 |
| `cloudfunctions/customerPriceCRUD/config.json` | 新增 | timeout: 10s |
| `cloudfunctions/customerPriceCRUD/package.json` | 新增 | 依赖声明 |
| `cloudfunctions/customerCRUD/index.js` | 修改 | 移除 discount 字段处理 |
| `pages/admin/pricing/pricing.js` | 新增 | 定价管理页逻辑 |
| `pages/admin/pricing/pricing.wxml` | 新增 | 定价管理页模板 |
| `pages/admin/pricing/pricing.wxss` | 新增 | 定价管理页样式 |
| `pages/admin/pricing/pricing.json` | 新增 | 页配置 |
| `pages/checkout/checkout.js` | 修改 | 移除 discount，接入专属价 |
| `pages/admin/customers/customers.js` | 修改 | 移除 discount 相关逻辑 |
| `pages/admin/customers/customers.wxml` | 修改 | 移除 discount 相关 UI |
| `app.json` | 修改 | 注册新页面路由 |
| `docs/data-model.md` | 修改 | 更新 customers 集合字段，新增 customerPrices 集合 |
| `docs/api-reference.md` | 修改 | 新增 customerPriceCRUD 接口定义 |
