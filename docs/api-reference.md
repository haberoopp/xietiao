# API 接口文档

> 版本: 1.0 | 更新: 2026-06-18 | 所有云函数通过 `wx.cloud.callFunction({ name, data })` 调用

---

## 通用约定

**请求**：`wx.cloud.callFunction({ name: '函数名', data: { ... } })`

**响应**：
```json
// 成功
{ "code": 0, "data": { ... } }

// 失败
{ "code": -1, "msg": "中文错误描述" }
{ "code": -2, "msg": "请先登录" }
{ "code": -3, "msg": "无权限" }
```

**鉴权**：
- 客户操作：自动通过 `wxContext.OPENID` + `_openid` 字段隔离
- 管理操作：验证 `admins` 表中 `lastLoginOpenid === OPENID && loggedIn === true`

---

## 一、客户侧云函数

### getProducts — 产品列表

```
调用方: 首页、管理产品页、仪表盘
鉴权: 无（公开）
```

**入参**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `category` | string | 否 | 品类筛选（`'色丁'` 等） |
| `keyword` | string | 否 | 名称模糊搜索 |
| `page` | integer | 否 | 页码，默认 1 |
| `pageSize` | integer | 否 | 每页数量，默认 20，上限 100 |

**出参**：
```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "_id": "abc123",
        "name": "色丁精品缎面 2cm",
        "category": "色丁",
        "price": 150,
        "unit": "米",
        "status": "sufficient",
        "stock": 1000,
        "description": "高档色丁面料...",
        "image": "cloud://xxx.jpg",
        "last_produced_at": 1718643200000,
        "createdAt": "2026-06-01T..."
      }
    ],
    "total": 1250
  }
}
```

---

### submitOrder — 客户下单

```
调用方: 结算页
鉴权: 自动绑定 _openid
```

**入参**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `customerName` | string | 是 | 客户名称或公司名 |
| `phone` | string | 是 | 联系电话 |
| `address` | string | 是 | 收货地址 |
| `items` | array | 是 | `[{ productId, name, price, quantity, unit }]` |
| `totalAmount` | integer | 是 | 订单总金额（分） |
| `deliveryMethod` | string | 否 | `'delivery'`(默认) / `'pickup'` / `'logistics'` |
| `remark` | string | 否 | 备注 |
| `location` | object | 否 | `{ lat, lng }` |
| `discount` | number | 否 | 折扣率 |

**出参**：`{ code: 0, data: { orderId: 'xxx' } }`

**错误**：`{ code: -1, msg: '请填写完整信息并选择商品' }`

**副作用**：客户端在成功后自动调用 `saveCurrentAddress` + `saveCustomer`（非阻塞）

---

### getMyOrders — 我的订单

```
调用方: 我的订单页
鉴权: 按 _openid 过滤
```

**入参**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `page` | integer | 否 | 默认 1 |
| `pageSize` | integer | 否 | 默认 100，上限 100 |

**出参**：
```json
{
  "code": 0,
  "data": {
    "list": [{ "_id": "o001", "customerName": "...", "items": [...], "status": "processing", ... }],
    "total": 42
  }
}
```

---

### updateOrder — 修改订单

```
调用方: 结算页（editOrder 模式）
鉴权: 验证 order._openid === OPENID
```

**入参**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `orderId` | string | 是 | 订单 ID |
| `customerName` | string | 否 | 修改后的客户名 |
| `phone` | string | 否 | 修改后的电话 |
| `address` | string | 否 | 修改后的地址 |
| `items` | array | 否 | 修改后的商品列表 |
| `totalAmount` | integer | 否 | 修改后的总金额（分） |
| `deliveryMethod` | string | 否 | 修改后的拿货方式 |
| `remark` | string | 否 | 修改后的备注 |
| `location` | object | 否 | 修改后的坐标 |

**出参**：`{ code: 0 }`

**错误**：`{ code: -1, msg: '订单不存在' }` / `{ code: -1, msg: '无权操作' }`

---

### cancelOrder — 取消订单

```
调用方: 我的订单页
鉴权: 验证 order._openid === OPENID
```

**入参**：`{ orderId: 'xxx' }`

**出参**：`{ code: 0 }`

**错误**：
| msg | 条件 |
|-----|------|
| `'订单已完成，无法取消。如需退换货请申请退换货'` | status === 'completed' |
| `'订单已取消'` | status === 'cancelled' |
| `'该订单已有退换货申请，无法取消'` | returnRequest 存在 |
| `'无权操作'` | _openid 不匹配 |

---

### requestReturn — 申请退换货

```
调用方: 我的订单页 → 退换货表单
鉴权: 验证 order._openid === OPENID
```

**入参**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `orderId` | string | 是 | 订单 ID |
| `type` | string | 是 | `'return'` / `'exchange'` |
| `reason` | string | 否 | 申请原因 |
| `items` | array | 是 | `[{ productId, name, price, quantity, unit }]` — 退回商品 |
| `exchangeItems` | array | 否 | `[{ productId, name, price, quantity, unit }]` — 换购商品（仅换货） |

**出参**：`{ code: 0 }`

**错误**：
| msg | 条件 |
|-----|------|
| `'订单未完成，无法申请退换货'` | status !== 'completed' |
| `'已有退换货申请在处理中'` | 已有 pending 申请 |
| `'该订单退换货已完成，无法再次申请'` | 已有 approved/completed 申请 |
| `'退换货申请已被拒绝2次，无法再次申请'` | rejectionCount >= 2 |

**副作用**：同时写入 `returnRequests` 集合 + 更新 `orders.returnRequest` 嵌入字段

---

### addressCRUD — 地址簿管理

```
调用方: 地址页、结算页
鉴权: 所有操作按 _openid 隔离
```

**入参**（按 action）：
| action | 参数 | 说明 |
|--------|------|------|
| `list` | — | 查当前用户所有地址 |
| `add` | `name, phone, address, addressDetail?, location?` | 新增地址 |
| `update` | `addressId, name?, phone?, address?, addressDetail?, location?` | 修改地址 |
| `delete` | `addressId` | 删除地址 |
| `setDefault` | `addressId` | 设为默认地址 |

**出参**：
- `list`: `{ code: 0, data: [...] }`
- `add`: `{ code: 0, data: { _id, ... } }`
- 其他: `{ code: 0 }`

---

### customerCRUD — 客户管理

```
调用方: 结算页（匹配折扣）、管理后台客户页
鉴权: list/add/update/delete 需 admin 鉴权; getByPhone 和 upsert 无需鉴权
```

**入参**（按 action）：
| action | 参数 | 鉴权 | 说明 |
|--------|------|------|------|
| `list` | — | admin | 查所有客户 |
| `getByPhone` | `phone` | 无 | 根据手机号查单个客户（结算页折扣匹配） |
| `add` | `name, phone, discount` | admin | 新增客户 |
| `update` | `customerId, name?, phone?, discount?` | admin | 修改客户 |
| `delete` | `customerId` | admin | 删除客户 |
| `upsert` | `name, phone, orderAmount` | 无 | 下单后自动录入/更新（累加 totalOrders + totalAmount） |

---

## 二、管理侧云函数

### adminLogin — 管理员登录

```
调用方: 管理登录页
鉴权: 无需（但需验证密码）
```

**入参**：`{ username: 'changzhang', password: '123456' }`

**出参**：
```json
{
  "code": 0,
  "data": {
    "adminId": "xxx",
    "username": "changzhang",
    "role": "manager",
    "nickname": "厂长"
  }
}
```

**错误**：
| msg | 条件 |
|-----|------|
| `'账号或密码错误'` | 用户名不存在或密码不匹配 |
| `'账号已锁定，请N分钟后再试'` | 5次失败后锁定15分钟 |

**安全机制**：PBKDF2-SHA512 哈希验证、5次失败锁定15分钟、自动迁移旧版明文密码

---

### adminLogout — 管理员登出

```
调用方: 管理订单页 → 退出登录
鉴权: 通过 OPENID
```

**入参**：无

**出参**：`{ code: 0 }`

**副作用**：将 `admins` 表中当前用户的 `loggedIn` 设为 `false`

---

### adminGetOrders — 订单列表

```
调用方: 管理订单页
鉴权: admin
```

**入参**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `status` | string | 否 | 筛选状态 `'processing'` / `'completed'` / `'cancelled'` |
| `page` | integer | 否 | 默认 1 |
| `pageSize` | integer | 否 | 默认 50 |

**出参**：`{ code: 0, data: { list: [...], total: 250 } }`

---

### adminGetReturns — 退换货列表

```
调用方: 管理订单页 → 退换货 Tab
鉴权: admin
```

**入参**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `status` | string | 否 | `'pending'` / `'approved'` / `'rejected'` / `'completed'` |
| `page` | integer | 否 | 默认 1 |
| `pageSize` | integer | 否 | 默认 50，上限 100 |

**出参**：
```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "_id": "rr001",
        "orderId": "o001",
        "type": "return",
        "reason": "尺寸不合适",
        "items": [...],
        "status": "pending",
        "rejectionCount": 0,
        "orderInfo": { "customerName": "...", "totalAmount": 25000, ... }
      }
    ],
    "total": 15
  }
}
```

---

### adminUpdateOrderStatus — 改订单状态

```
调用方: 管理订单页 → 状态切换
鉴权: admin
```

**入参**：`{ orderId: 'xxx', status: 'processing' | 'completed' | 'cancelled' }`

**出参**：`{ code: 0 }`

**副作用**：可触发订阅消息通知（客户订单状态变更）

---

### adminUpdateOrderPrice — 改订单金额

```
调用方: 管理订单页 → 改价弹窗
鉴权: admin
```

**入参**：`{ orderId: 'xxx', totalAmount: 25500 }` （totalAmount 单位：分）

**出参**：`{ code: 0 }`

---

### adminHandleReturn — 处理退换货

```
调用方: 管理订单页 → 退换货审核
鉴权: admin
```

**入参**：`{ requestId: 'rr001', action: 'approve' | 'reject' | 'complete' }`

**出参**：`{ code: 0 }`

**副作用**：
- 更新 `returnRequests` 状态
- 更新 `orders.returnRequest.status`
- approve 时：订单 status 回退为 processing，**按折扣自动重算金额**
- reject 时：累加 rejectionCount

**金额重算规则**：
```
approve + return:  totalAmount = max(0, totalAmount - sum(退货商品 × 折扣 × 数量))
approve + exchange: totalAmount = max(0, totalAmount + sum(换购商品 × 折扣 × 数量) - sum(退货商品 × 折扣 × 数量))
```

---

### adminAddProduct — 添加产品

```
调用方: 管理产品页
鉴权: admin
```

**入参**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 是 | 产品名称 |
| `category` | string | 是 | 品类 |
| `price` | number | 是 | 单价（元，云函数内部 ×100 转分） |
| `unit` | string | 是 | 单位 |
| `stock` | integer | 否 | 库存数量 |
| `description` | string | 否 | 描述 |
| `image` | string | 否 | 云存储 fileID |

**出参**：`{ code: 0, data: { _id: 'xxx' } }`

---

### adminUpdateProduct — 更新产品

```
调用方: 管理产品页、订单页（标记紧张）
鉴权: admin
```

**入参**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `productId` | string | 是 | 产品 ID |
| 其他字段 | — | 否 | 同 adminAddProduct，按需传入 |

**出参**：`{ code: 0 }`

---

### adminDeleteProduct — 删除产品

```
调用方: 管理产品页
鉴权: admin
```

**入参**：`{ productId: 'xxx' }`

**出参**：`{ code: 0 }`

---

### adminOrderImage — 上传订单图片

```
调用方: 管理订单页 → 上传凭证
鉴权: admin
```

**入参**：`{ orderId: 'xxx', fileID: 'cloud://xxx.jpg' }`

**出参**：`{ code: 0, data: { fileID, uploadedAt } }`

**副作用**：通过 `db.command.push()` 追加到 `orders.images[]`

---

### adminDeleteOrderImage — 删除订单图片

```
调用方: 管理订单页 → 删除凭证
鉴权: admin
```

**入参**：`{ orderId: 'xxx', imageIndex: 0 }`

**出参**：`{ code: 0 }`

**副作用**：尝试通过 `cloud.deleteFile()` 删除云存储文件（失败不影响数据库删除）

---

### adminTogglePickedUp — 切换已拿货状态

```
调用方: 管理订单页 → 已拿货/未拿货切换
鉴权: admin
```

**入参**：`{ orderId: 'xxx' }`

**出参**：`{ code: 0, data: { pickedUp: true | false } }`

---

### subscribeAdmin — 管理员订阅消息

```
调用方: 管理订单页 → 开启通知
鉴权: 通过 OPENID
```

**入参**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `action` | string | 是 | `'subscribe'` / `'unsubscribe'` |
| `categories` | array | 否 | `['new_order', 'status_change', 'cancelled', 'return']` |

**出参**：`{ code: 0 }`

**副作用**：subscribe 时删除旧记录后重新插入（保证每个 openid 只有一条）

---

## 三、工具类云函数

### importProducts — Excel 批量导入

```
调用方: 管理产品页 → 导入 Excel
鉴权: admin
```

**入参**：`{ fileID: 'cloud://temp/import_xxx.xlsx' }`

**出参**：
```json
{
  "code": 0,
  "data": {
    "success": 150,
    "errors": [{ "row": 5, "msg": "名称为空" }]
  }
}
```

**处理流程**：下载文件 → xlsx 解析 → 按批次（20个/批）并行写入 → 清理临时文件

**支持的表头**（中文或英文均可）：
`名称/name`, `分类/category`, `单价(元)/单价/price`, `单位/unit`, `库存/stock`, `描述/description`

---

### seedAdmin / initAdminAccounts — 种子账号

```
调用方: 手动（仅首次部署或环境重建时）
鉴权: 无
```

**入参**：无

**出参**：
```json
{
  "code": 0,
  "data": [
    { "username": "changzhang", "status": "created" | "skipped" },
    { "username": "songhuo", "status": "created" | "skipped" },
    { "username": "diaohuo", "status": "created" | "skipped" }
  ]
}
```

**副作用**：创建 3 个预置管理员账号（已存在则跳过）

---

## 四、通知模块（内部调用，非客户端直接调用）

### notify.sendToCustomer(db, order, type, extra)

在以下云函数内部调用：`submitOrder`、`adminUpdateOrderStatus`、`adminHandleReturn`、`cancelOrder`

| type | 模板 | 触发时机 |
|------|------|---------|
| `STATUS_CHANGE` | 订单状态变更 | 管理员改订单状态 |
| `PAYMENT_CHANGE` | 付款状态变更 | 管理员改付款状态 |
| `RETURN_RESULT` | 退换货结果 | 管理员处理退换货 |

### notify.sendToAdmins(db, type, order, extra)

| type | 模板 | 触发时机 |
|------|------|---------|
| `NEW_ORDER` | 新订单通知 | 客户下单 |
| `STATUS_CHANGE` | 订单状态变更 | — |
| `ORDER_CANCELLED` | 订单取消通知 | 客户取消订单 |
| `RETURN` | 退换货通知 | 客户申请退换货 |

---

## 五、错误码速查

| code | 含义 | 客户端处理 |
|------|------|-----------|
| `0` | 成功 | 正常消费 `data` |
| `-1` | 业务错误 | `wx.showToast({ title: msg, icon: 'none' })` |
| `-2` | 未登录 | 跳转登录页 |
| `-3` | 无权限 | `wx.showToast({ title: '无权限', icon: 'none' })` |
| 网络异常 | `catch(err)` | `wx.showToast({ title: '网络错误，请检查网络后重试', icon: 'none' })` |
