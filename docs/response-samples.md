# 后端接口响应样例（全 11 场景）

> 版本: 1.0 | 更新: 2026-06-18

---

## 统一处理机制

**唯一处理文件**：`cloudfunctions/lib/response.js`

所有云函数通过 `require('../lib/response')` 引用此模块，调用对应方法构建返回值。
不存在第二个响应构建入口。任何云函数手写 `{ code: ..., msg: ... }` 都是违规。

**客户端消费入口**：每个 Page 的 try/catch 块中调用 `wx.cloud.callFunction`，
通过 `result.result.code` 判断结果。

---

## 成功场景（5 种）

### 场景 1：列表成功（有数据）

| 项 | 内容 |
|----|------|
| HTTP 对标 | 200 OK |
| 构建方法 | `res.list(list, total, page, pageSize)` |
| 处理文件 | `lib/response.js` → `list()` 函数 |
| 适用接口 | getProducts, getMyOrders, adminGetOrders, adminGetReturns, addressCRUD.list, customerCRUD.list |

```json
HTTP 200 OK
{
  "code": 0,
  "data": {
    "list": [
      { "_id": "abc", "name": "色丁精品缎面 2cm", "category": "色丁", "price": 150, "unit": "米", "status": "sufficient" },
      { "_id": "def", "name": "凉感丝包边条 3cm", "category": "凉感丝", "price": 200, "unit": "米", "status": "sufficient" }
    ],
    "total": 1250,
    "page": 1,
    "pageSize": 20
  }
}
```

客户端处理：
```js
const { list, total } = result.data;
this.setData({ items: list });
```

---

### 场景 2：详情对象成功

| 项 | 内容 |
|----|------|
| HTTP 对标 | 200 OK |
| 构建方法 | `res.record(data)` |
| 处理文件 | `lib/response.js` → `record()` 函数 |
| 适用接口 | adminLogin（返回管理员信息）, customerCRUD.getByPhone（返回单个客户） |

```json
HTTP 200 OK
{
  "code": 0,
  "data": {
    "record": {
      "_id": "abc",
      "username": "changzhang",
      "role": "manager",
      "nickname": "厂长",
      "lastLoginAt": "2026-06-18T14:32:05.123Z"
    }
  }
}
```

客户端处理：
```js
const { record } = result.data;
this.setData({ admin: record });
```

---

### 场景 3：创建成功

| 项 | 内容 |
|----|------|
| HTTP 对标 | 200 OK（CloudBase RPC 无 201 概念） |
| 构建方法 | `res.record(newData)` — 与详情共用 record，但 data 必须含 _id |
| 处理文件 | `lib/response.js` → `record()` 函数 |
| 适用接口 | submitOrder, adminAddProduct, addressCRUD.add |

```json
HTTP 200 OK
{
  "code": 0,
  "data": {
    "record": {
      "_id": "o123456",
      "customerName": "温州服装厂",
      "phone": "13800138001",
      "totalAmount": 25000,
      "status": "processing",
      "payment_status": "unpaid",
      "createdAt": "2026-06-18T14:32:05.123Z"
    }
  }
}
```

客户端处理：
```js
const { record } = result.data;
const orderId = record._id;  // 创建后的 ID 用于后续操作
```

---

### 场景 4：更新成功

| 项 | 内容 |
|----|------|
| HTTP 对标 | 200 OK |
| 构建方法 | `res.record(updatedData)` — 与详情共用 record，必须含 _id 和变更字段 |
| 处理文件 | `lib/response.js` → `record()` 函数 |
| 适用接口 | updateOrder, adminUpdateProduct, adminHandleReturn, adminUpdateOrderPrice |

```json
HTTP 200 OK
{
  "code": 0,
  "data": {
    "record": {
      "_id": "o123456",
      "status": "completed",
      "updatedAt": "2026-06-18T14:35:10.456Z"
    }
  }
}
```

客户端处理：
```js
const { record } = result.data;
// 用 record 更新本地列表中的对应项
```

---

### 场景 5：空列表

| 项 | 内容 |
|----|------|
| HTTP 对标 | 200 OK |
| 构建方法 | `res.list([], 0)` |
| 处理文件 | `lib/response.js` → `list()` 函数（list 参数为空数组，total 为 0） |
| 说明 | 空列表不是错误，total=0 表示没有匹配数据，客户端正常展示空状态 |

```json
HTTP 200 OK
{
  "code": 0,
  "data": {
    "list": [],
    "total": 0
  }
}
```

客户端处理：
```js
const { list, total } = result.data;
if (total === 0) {
  this.setData({ isEmpty: true });  // 显示"暂无数据"
}
```

---

## 失败场景（6 种）

### 场景 6：参数错误

| 项 | 内容 |
|----|------|
| HTTP 对标 | 400 Bad Request |
| 构建方法 | `res.badRequest(msg, errors?)` |
| 处理文件 | `lib/response.js` → `badRequest()` 函数 |
| 触发位置 | 云函数 exports.main 中 validate(event) 返回失败后 |
| 触发条件 | 入参缺失、格式非法、值不在允许范围 |

```json
HTTP 400 Bad Request
{
  "code": 400,
  "msg": "请填写完整信息并选择商品",
  "errors": {
    "customerName": "不能为空",
    "phone": "格式不正确",
    "items": "至少选择一件商品"
  }
}
```

客户端处理：
```js
if (result.code === 400) {
  wx.showToast({ title: result.msg, icon: "none" });
  // 如有 errors 字段，可逐字段在输入框旁标红
  if (result.errors) {
    this.setData({ formErrors: result.errors });
  }
}
```

---

### 场景 7：未登录

| 项 | 内容 |
|----|------|
| HTTP 对标 | 401 Unauthorized |
| 构建方法 | `res.unauthorized()` |
| 处理文件 | `lib/response.js` → `unauthorized()` 函数 |
| 触发位置 | `lib/auth.js` → `requireOpenid()` 中 OPENID 为空 |
| 触发条件 | 用户未授权微信登录、或微信会话过期 |

```json
HTTP 401 Unauthorized
{
  "code": 401,
  "msg": "请先登录"
}
```

客户端处理：
```js
if (result.code === 401) {
  wx.showToast({ title: "请先登录", icon: "none" });
  // 引导用户重新授权
  wx.switchTab({ url: "/pages/admin/login/login" });
}
```

---

### 场景 8：无权限

| 项 | 内容 |
|----|------|
| HTTP 对标 | 403 Forbidden |
| 构建方法 | `res.forbidden(msg?)` |
| 处理文件 | `lib/response.js` → `forbidden()` 函数 |
| 触发位置 | `lib/auth.js` → `requireAdmin()` 中 admins 表无匹配 |
| 触发条件 | 用户已登录但无管理员身份、或登录态已过期 |

```json
HTTP 403 Forbidden
{
  "code": 403,
  "msg": "无管理员权限"
}
```

客户端处理：
```js
if (result.code === 403) {
  wx.showToast({ title: result.msg, icon: "none" });
  wx.switchTab({ url: "/pages/admin/login/login" });
}
```

---

### 场景 9：资源不存在

| 项 | 内容 |
|----|------|
| HTTP 对标 | 404 Not Found |
| 构建方法 | `res.notFound(msg)` |
| 处理文件 | `lib/response.js` → `notFound()` 函数 |
| 触发位置 | 云函数 exports.main 中 doXxx() 返回 success:false 且 error 为"不存在"时 |
| 触发条件 | db.collection().doc(id).get() 返回空 |

```json
HTTP 404 Not Found
{
  "code": 404,
  "msg": "订单不存在"
}
```

客户端处理：
```js
if (result.code === 404) {
  wx.showToast({ title: result.msg, icon: "none" });
  wx.navigateBack();  // 返回上一页
}
```

---

### 场景 10：状态冲突

| 项 | 内容 |
|----|------|
| HTTP 对标 | 409 Conflict |
| 构建方法 | `res.conflict(msg)` |
| 处理文件 | `lib/response.js` → `conflict()` 函数 |
| 触发位置 | 云函数 exports.main 中 doXxx() 返回 success:false，error 为业务规则阻止 |
| 触发条件 | 订单已完成不能取消、已有退换货不能重复申请、被拒2次不能再次申请 |

```json
HTTP 409 Conflict
{
  "code": 409,
  "msg": "订单已完成，无法取消。如需退换货请申请退换货"
}
```

客户端处理：
```js
if (result.code === 409) {
  wx.showToast({ title: result.msg, icon: "none" });
  // 不重试，不跳转，仅提示
}
```

---

### 场景 11：系统异常

| 项 | 内容 |
|----|------|
| HTTP 对标 | 500 Internal Server Error |
| 构建方法 | `res.internalError()` |
| 处理文件 | `lib/response.js` → `internalError()` 函数 |
| 触发位置 | 云函数 exports.main 的 catch(err) 块 |
| 触发条件 | 数据库写入失败、网络超时、SDK 异常等所有未预期错误 |
| 关键约束 | msg 固定为通用中文提示，原始错误通过 logger.error() 记录，不暴露给客户端 |

```json
HTTP 500 Internal Server Error
{
  "code": 500,
  "msg": "操作失败，请稍后重试"
}
```

客户端处理：
```js
if (result.code === 500) {
  wx.showToast({ title: result.msg, icon: "none" });
  // 可提供重试按钮
  this.setData({ showRetry: true });
}
```

---

## 11 场景速查总表

| # | 场景 | code | 构建方法 | 处理文件 |
|---|------|------|---------|---------|
| 1 | 列表成功 | 0 | res.list(list,total,page,pageSize) | lib/response.js |
| 2 | 详情对象 | 0 | res.record(data) | lib/response.js |
| 3 | 创建成功 | 0 | res.record(newData) | lib/response.js |
| 4 | 更新成功 | 0 | res.record(updatedData) | lib/response.js |
| 5 | 空列表 | 0 | res.list([], 0) | lib/response.js |
| 6 | 参数错误 | 400 | res.badRequest(msg,errors?) | lib/response.js |
| 7 | 未登录 | 401 | res.unauthorized() | lib/response.js |
| 8 | 无权限 | 403 | res.forbidden(msg?) | lib/response.js |
| 9 | 资源不存在 | 404 | res.notFound(msg) | lib/response.js |
| 10 | 状态冲突 | 409 | res.conflict(msg) | lib/response.js |
| 11 | 系统异常 | 500 | res.internalError() | lib/response.js |

---

## 统一处理机制

所有 11 种场景的 JSON 结构由同一个文件产生：cloudfunctions/lib/response.js

云函数中严禁手写 { code: ..., msg: ... }，必须通过 res.xxx() 方法构建。

调用链：
  云函数 exports.main
    -> res.list() / res.record() / res.ok()           (成功)
    -> res.badRequest() / res.unauthorized() / ...    (失败)
    -> logger.info() / logger.error()                 (日志)
    -> auth.requireOpenid() / auth.requireAdmin()     (鉴权，失败时返回 401/403)

客户端统一消费：
  const { result } = await wx.cloud.callFunction({ name, data });
  if (!result || result.code !== 0) { /* 按 code 分发处理 */ return; }
  const { list, total } = result.data;  // 列表
  const { record } = result.data;       // 对象

注意：CloudBase RPC 不是 HTTP，code 值对标 HTTP 语义仅为开发者体验。
