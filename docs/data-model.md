# 数据模型文档

> 版本: 1.0 | 更新: 2026-06-18 | 数据库: CloudBase 文档数据库

---

## 集合总览

| 集合 | 权限 | 记录数预估 | 说明 |
|------|------|-----------|------|
| `products` | 所有用户可读 | ~2000 | 产品信息 |
| `orders` | 仅创建者可读写 | 持续增长 | 客户订单 |
| `admins` | 所有用户可读 | 3 | 管理员账号 |
| `addresses` | 仅创建者可读写 | 每用户数条 | 客户地址簿 |
| `customers` | 所有用户可读 | ~100 | 客户档案 |
| `customerPrices` | 所有用户可读 | 持续增长 | 客户专属定价 |
| `returnRequests` | 仅创建者可读写 | 持续增长 | 退换货申请 |
| `adminSubscriptions` | 所有用户可读 | 1-5 | 管理员订阅消息状态 |

---

## 1. products — 产品信息

```
权限: 所有用户可读, 仅管理员可写
索引: _id (自动), createdAt
```

| 字段 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| `_id` | string | 自动 | 文档 ID | `'abc123'` |
| `name` | string | 是 | 产品名称 | `'色丁精品缎面 2cm'` |
| `category` | string | 是 | 品类 | `'色丁'` / `'凉感丝'` / `'丝纹'` / `'全棉'` / `'圆盘'` / `'其他'` |
| `price` | integer | 是 | 单价（分） | `150` = ¥1.50 |
| `unit` | string | 是 | 单位 | `'米'` / `'卷'` / `'个'` / `'公斤'` / `'包'` |
| `status` | string | 是 | 库存状态 | `'sufficient'`(充足) / `'low'`(紧张) / `'out'`(缺货) |
| `stock` | integer | 否 | 库存数量 | `1000` |
| `description` | string | 否 | 产品描述 | `'高档色丁面料，宽度2cm'` |
| `image` | string | 否 | 云存储 fileID | `'cloud://xxx.jpg'` |
| `last_produced_at` | integer | 否 | 最近生产时间戳(ms) | `1718643200000` |
| `createdAt` | Date | 自动 | 创建时间 | `db.serverDate()` |
| `updatedAt` | Date | 自动 | 更新时间 | `db.serverDate()` |

**状态转换规则**：
```
sufficient ──→ low ──→ out
    ↑          │        │
    └── 补货 ──┘        │
         ↑              │
         └── 补货 ──────┘
```

---

## 2. orders — 客户订单

```
权限: 仅创建者可读写
索引: _id (自动), _openid, createdAt
```

| 字段 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| `_id` | string | 自动 | 文档 ID | `'abc123'` |
| `_openid` | string | 自动 | 创建者微信 openid（安全隔离关键字段） | `'oXXXX...'` |
| `customerName` | string | 是 | 客户姓名或公司名称 | `'温州服装厂'` |
| `phone` | string | 是 | 联系电话 | `'13800138001'` |
| `address` | string | 是 | 收货地址 | `'浙江省温州市鹿城区...'` |
| `items` | array | 是 | 订单商品列表 | 见下方 |
| `items[].productId` | string | 是 | 产品 ID | `'p001'` |
| `items[].name` | string | 是 | 产品名称（快照，防止产品被删后丢失信息） | `'色丁精品缎面'` |
| `items[].price` | integer | 是 | 下单时单价（分） | `150` |
| `items[].quantity` | integer | 是 | 数量 | `100` |
| `items[].unit` | string | 是 | 单位 | `'米'` |
| `totalAmount` | integer | 是 | 订单总金额（分） | `25000` = ¥250.00 |
| `discount` | number | 否 | 客户折扣 | `0.9` = 9折 |
| `deliveryMethod` | string | 是 | 拿货方式 | `'delivery'`(配送) / `'pickup'`(自取) / `'logistics'`(物流) |
| `status` | string | 自动 | 订单状态 | `'processing'`(处理中) / `'completed'`(已完成) / `'cancelled'`(已取消) |
| `payment_status` | string | 自动 | 付款状态 | `'unpaid'` / `'paid'` |
| `paid_amount` | integer | 自动 | 已付金额（分） | 初始为 `0`，标记付款后设为 `totalAmount` |
| `pickedUp` | boolean | 自动 | 是否已拿货（仅配送订单有意义） | `false` / `true` |
| `remark` | string | 否 | 客户备注 | `'急单，请尽快发货'` |
| `location` | object | 否 | 客户位置坐标 | `{ lat: 28.0185, lng: 120.6505 }` |
| `images` | array | 否 | 订单凭证图片 | `[{ fileID: 'cloud://...', uploadedAt: Date }]` |
| `returnRequest` | object | 否 | 退换货申请（嵌入副本） | 见 returnRequests 集合 |
| `createdAt` | Date | 自动 | 下单时间 | `db.serverDate()` |
| `updatedAt` | Date | 自动 | 更新时间 | `db.serverDate()` |

**状态流转**：
```
processing ──→ completed ──→ (退换货通过后回退) ──→ processing
    │               │
    └── cancelled   └── (退换货拒绝) 保持 completed
```

---

## 3. admins — 管理员账号

```
权限: 所有用户可读, 仅管理员可写
索引: _id (自动), username (手动创建，唯一)
```

| 字段 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| `_id` | string | 自动 | 文档 ID | `'abc123'` |
| `username` | string | 是 | 登录账号（唯一） | `'changzhang'` |
| `passwordHash` | string | 是 | PBKDF2-SHA512 哈希 | `'a1b2c3...'` |
| `salt` | string | 是 | PBKDF2 盐值（32字节随机hex） | `'d4e5f6...'` |
| `password` | string | 否 | 旧版明文密码（迁移后由 `db.command.remove()` 删除） | — |
| `role` | string | 是 | 角色 | `'manager'` / `'delivery'` / `'warehouse'` |
| `nickname` | string | 否 | 显示名称 | `'厂长'` / `'送货员'` / `'仓库调货员'` |
| `failedAttempts` | integer | 自动 | 连续登录失败次数 | `0` |
| `lockedUntil` | integer | 否 | 锁定到期时间戳(ms)，5次失败后锁定15分钟 | `1718643200000` |
| `loggedIn` | boolean | 自动 | 是否已登录 | `true` / `false` |
| `lastLoginOpenid` | string | 否 | 最近一次登录的微信 openid | `'oXXXX...'` |
| `lastLoginAt` | Date | 否 | 最近登录时间 | `db.serverDate()` |
| `createdAt` | Date | 自动 | 创建时间 | `db.serverDate()` |
| `updatedAt` | Date | 自动 | 更新时间 | `db.serverDate()` |

**密码哈希算法**：
```
PBKDF2-SHA512, 10000 iterations, 64 bytes output → hex
盐: crypto.randomBytes(32).toString('hex')
```

**预置账号**（通过 `seedAdmin` / `initAdminAccounts` 创建）：
```
changzhang / 123456  →  manager  (厂长)
songhuo    / 123456  →  delivery (送货员)
diaohuo    / 123456  →  warehouse(仓库调货员)
```

---

## 4. addresses — 客户地址簿

```
权限: 仅创建者可读写
索引: _id (自动), _openid
```

| 字段 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| `_id` | string | 自动 | 文档 ID | `'abc123'` |
| `_openid` | string | 自动 | 创建者微信 openid | `'oXXXX...'` |
| `name` | string | 是 | 收货人姓名 | `'陈大明'` |
| `phone` | string | 是 | 联系电话 | `'13900139002'` |
| `address` | string | 是 | 地址（省市区+街道） | `'浙江省温州市瓯海区梧田街道月乐西街58号'` |
| `addressDetail` | string | 否 | 门牌号等详细地址 | `'3号楼201室'` |
| `isDefault` | boolean | 自动 | 是否默认地址（每个用户只有一个默认） | `true` / `false` |
| `location` | object | 否 | 坐标 | `{ lat: 28.0045, lng: 120.5619 }` |
| `createdAt` | Date | 自动 | 创建时间 | `db.serverDate()` |
| `updatedAt` | Date | 自动 | 更新时间 | `db.serverDate()` |

**默认地址逻辑**：第一个地址自动设为默认；设置新默认时自动取消旧默认；删除默认时自动将第一个地址设为默认。

---

## 5. customers — 客户档案

```
权限: 所有用户可读, 仅管理员可写
索引: _id (自动), phone (手动创建，唯一)
```

| 字段 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| `_id` | string | 自动 | 文档 ID | `'c001'` |
| `name` | string | 是 | 客户名称 | `'温州服装厂'` |
| `phone` | string | 是 | 手机号（唯一） | `'13800138001'` |
| `totalOrders` | integer | 自动 | 累计订单数 | `3` |
| `totalAmount` | integer | 自动 | 累计消费金额（分） | `25500` |
| `debt` | integer | 否 | 欠款（分，仅 demo 模式客户端计算） | `15000` |
| `createdAt` | Date | 自动 | 创建时间 | `db.serverDate()` |
| `updatedAt` | Date | 自动 | 更新时间 | `db.serverDate()` |

**自动更新机制**：每次下单后通过 `customerCRUD.upsert` 自动创建或累计订单数和金额。

---

## 6. customerPrices — 客户专属定价

```
权限: 所有用户可读, 仅管理员可写（通过云函数控制）
索引: customerPhone + productId 联合唯一（应用层保证）
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

**唯一性约束**：同一 `customerPhone + productId` 只能有一条记录，云函数内通过 update-first-then-insert 保证。

**定价优先级**：结算时优先使用 `customerPrices.customPrice`，未设专属价的产品走 `products.price`（零售价）。

---

## 7. returnRequests — 退换货申请

```
权限: 仅创建者可读写
索引: _id (自动), _openid, orderId, createdAt
```

| 字段 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| `_id` | string | 自动 | 退换货申请 ID | `'rr001'` |
| `_openid` | string | 自动 | 申请人微信 openid | `'oXXXX...'` |
| `orderId` | string | 是 | 关联订单 ID | `'o001'` |
| `type` | string | 是 | 类型 | `'return'`(退货) / `'exchange'`(换货) |
| `reason` | string | 否 | 申请原因 | `'尺寸不合适'` |
| `items` | array | 是 | 退回的商品列表 | `[{ productId, name, price, quantity, unit }]` |
| `exchangeItems` | array | 否 | 换购的商品列表（仅换货时有值） | `[{ productId, name, price, quantity, unit }]` |
| `rejectionCount` | integer | 自动 | 被拒绝次数（初始为上次拒绝次数，累加） | `0` / `1` / `2` |
| `isRetry` | boolean | 自动 | 是否为重新申请（被拒后再次提交） | `false` / `true` |
| `status` | string | 自动 | 处理状态 | `'pending'`(待处理) / `'approved'`(已通过) / `'rejected'`(已拒绝) / `'completed'`(已完成) |
| `createdAt` | Date | 自动 | 申请时间 | `db.serverDate()` |
| `updatedAt` | Date | 自动 | 更新时间 | `db.serverDate()` |

**业务约束**：
- 只有 `status === 'completed'` 的订单可申请退换货
- 已有 `pending` 申请时不可重复申请
- 被拒绝 ≥ 2 次后不可再申请
- 申请通过后订单 `status` 回退为 `processing`

**金额重算逻辑（通过/换货时）**：
```
退货: totalAmount = totalAmount - sum(退货商品价格 × 折扣 × 数量)
换货: totalAmount = totalAmount + (sum(换购商品价格 × 折扣 × 数量) - sum(退货商品价格 × 折扣 × 数量))
```
所有价格计算使用 `Math.round()` 确保整数结果，`Math.max(0, ...)` 防止负数。

---

## 8. adminSubscriptions — 管理员订阅消息

```
权限: 所有用户可读
索引: _id (自动), _openid
```

| 字段 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| `_id` | string | 自动 | 文档 ID | `'abc123'` |
| `_openid` | string | 自动 | 管理员微信 openid | `'oXXXX...'` |
| `subscribed` | boolean | 是 | 是否已订阅 | `true` / `false` |
| `categories` | array | 是 | 订阅的消息类型 | `['new_order', 'status_change', 'cancelled', 'return']` |
| `createdAt` | Date | 自动 | 创建时间 | `db.serverDate()` |
| `updatedAt` | Date | 自动 | 更新时间 | `db.serverDate()` |

**订阅触发**：管理员在后台点击"开启订单通知"按钮 → 微信原生订阅弹窗 → 同意后调用 `subscribeAdmin` 云函数写入本集合。`notify.js` 的 `getSubscribers()` 读取本集合获取推送目标列表。

---

## 数据关系图

```
products ─────────────────────┐
  _id                          │
                               │ items[].productId
                               ▼
admins                       orders ────────────── returnRequests
  _id         鉴权             _id ◄── orderId ──── _id
  username ──→ adminLogin      _openid               _openid
  role                         customerName          type
  loggedIn                     phone                 status
  lastLoginOpenid              address               items
                               totalAmount           exchangeItems
addresses                      status
  _openid                      payment_status
  name ──→ checkout 自动填充    images[]
  phone                        returnRequest ── 嵌入副本
  address
                               customers
                                 phone ◄── checkout 匹配专属价
                                 totalOrders
                                 totalAmount ←── upsert 自动累计

                               customerPrices
                                 customerPhone ◄── customers.phone
                                 productId ◄── products._id
                                 customPrice ──→ checkout 结算时优先使用
```

**嵌入 vs 引用策略**：
- `orders.items[]` — **嵌入快照**：产品名、价格在下单时写入，后续产品被删/改价不影响历史订单
- `orders.returnRequest` — **嵌入副本**：在 `requestReturn` 云函数中同时写入 `orders` 和 `returnRequests` 两处，方便订单列表直接显示退换货状态
- `returnRequests.orderId` — **引用 ID**：`adminGetReturns` 通过 `_.in(orderIds)` 批量关联订单信息
