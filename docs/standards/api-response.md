# API 接口返回标准

> 版本: 2.0 | 更新: 2026-06-18 | 对标 HTTP 语义

---

## 一、设计原则

云函数与客户端之间不是 HTTP 协议，但返回 `code` 值**对标 HTTP 状态码语义**，让任何开发者一眼看懂。

**code 值全集（7 个，禁止新增）**：

| code | HTTP 对标 | 语义 | 触发条件 |
|------|----------|------|---------|
| `0` | 200 | 成功 | 所有正常返回 |
| `400` | 400 | 参数错误 | 客户端传参不合法 |
| `401` | 401 | 未登录 | 无法获取用户身份 |
| `403` | 403 | 无权限 | 用户已识别但权限不足 |
| `404` | 404 | 不存在 | 查/改/删的目标不存在 |
| `409` | 409 | 状态冲突 | 业务状态不允许当前操作 |
| `500` | 500 | 系统异常 | 服务端未预期错误 |

---

## 二、成功场景

### 2.1 列表 `res.list(list, total, page?, pageSize?)`

**适用**：`getProducts`、`getMyOrders`、`adminGetOrders`、`adminGetReturns`

```json
{
  "code": 0,
  "data": {
    "list": [{ "_id": "abc", "name": "色丁精品缎面" }],
    "total": 1250,
    "page": 1,
    "pageSize": 20
  }
}
```

- `list`：数组，可为空 `[]`
- `total`：符合查询条件的总记录数（不是当前页条数）
- `page` / `pageSize`：入参有分页参数时回显

**空列表**：
```json
{ "code": 0, "data": { "list": [], "total": 0 } }
```

### 2.2 对象 `res.record(data)`

**适用**：详情查询、创建后返回、更新后返回

```json
{
  "code": 0,
  "data": {
    "record": { "_id": "abc", "username": "changzhang", "role": "manager" }
  }
}
```

- `record`：单条数据，可为 `null`（查不到但不视为错误）

**创建后返回**：必须包含 `_id` 和所有写入字段。
**更新后返回**：必须包含 `_id` 和变更字段。

### 2.3 无数据 `res.ok()`

**适用**：删除、登出、切换状态、标记已拿货等纯操作

```json
{ "code": 0 }
```

不含 `data` 字段。

---

## 三、失败场景

### 3.1 参数错误 — code: 400

```json
{
  "code": 400,
  "msg": "请填写完整信息并选择商品",
  "errors": {
    "customerName": "不能为空",
    "phone": "格式不正确"
  }
}
```

- `msg`：用户可读中文摘要（可直接用于 Toast）
- `errors`：可选，逐字段明细

### 3.2 未登录 — code: 401

```json
{ "code": 401, "msg": "请先登录" }
```

触发：`cloud.getWXContext().OPENID` 返回空。

### 3.3 无权限 — code: 403

```json
{ "code": 403, "msg": "无管理员权限" }
```

触发：`admins` 表中找不到匹配的登录态。

### 3.4 资源不存在 — code: 404

```json
{ "code": 404, "msg": "订单不存在" }
```

触发：`db.collection().doc(id).get()` 返回空。与 403 的区别：404 是"目标不存在"，403 是"目标存在但你无权访问"。

### 3.5 状态冲突 — code: 409

```json
{ "code": 409, "msg": "订单已完成，无法取消。如需退换货请申请退换货" }
```

触发：已完成订单不能取消、已有退换货不能重复申请、被拒 2 次不可再申请。

### 3.6 系统异常 — code: 500

```json
{ "code": 500, "msg": "操作失败，请稍后重试" }
```

触发：所有 `catch(err)` 未预期错误。msg 固定为通用中文提示，不暴露 `err.message`。

---

## 四、构建方式

```js
const res = require('../lib/response');

// 成功
return res.list(rows, total, page, pageSize);    // 列表
return res.record(data);                          // 对象
return res.ok();                                  // 无数据

// 失败
return res.badRequest('请填写完整信息', { name: '不能为空' });
return res.unauthorized();
return res.forbidden('无管理员权限');
return res.notFound('订单不存在');
return res.conflict('订单已完成，无法取消');
return res.internalError();
```

---

## 五、客户端消费

```js
const { result } = await wx.cloud.callFunction({ name: 'xxx', data: {} });

// 先判断 code
if (!result || result.code !== 0) {
  const msg = (result && result.msg) || '操作失败';
  wx.showToast({ title: msg, icon: 'none' });

  // 按 code 细化处理
  if (result && result.code === 401) {
    // 引导重新授权
  } else if (result && result.code === 403) {
    wx.switchTab({ url: '/pages/admin/login/login' });
  }
  return;
}

// 列表
const { list, total } = result.data;
// 对象
const { record } = result.data;
```

---

## 六、迁移指南（旧 code → 新 code）

| 旧 code | 新 code | 说明 |
|---------|---------|------|
| `-1` (参数错误) | `400` | 语义更明确 |
| `-2` (未登录) | `401` | 对接 HTTP 标准 |
| `-3` (无权限) | `403` | 对接 HTTP 标准 |
| `-1` (状态冲突) | `409` | 从 -1 中拆分出来 |
| `-1` (系统异常) | `500` | 从 -1 中拆分出来 |

**历史代码兼容**：旧的 `response.js` 中的 `success()`/`fail()`/`unauthorized()`/`forbidden()` 方法已移除。新云函数使用新 API。已有云函数可逐步迁移，不强制一次性改完。
