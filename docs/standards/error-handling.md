# 错误处理规范

## 三层错误处理架构

```
┌─────────────────────────────────────────┐
│  Layer 3: 全局兜底                       │
│  app.js → wx.onError / onUnhandledRejection │
│  → 写入 _error_logs (Storage)             │
├─────────────────────────────────────────┤
│  Layer 2: 客户端 try/catch               │
│  每个 Page 方法 → catch → Toast + return  │
├─────────────────────────────────────────┤
│  Layer 1: 云函数 try/catch               │
│  exports.main → catch → { code: -1, msg } │
└─────────────────────────────────────────┘
```

## Layer 1：云函数错误处理

**规则**：每个云函数的 `exports.main` 主体逻辑必须在 try/catch 内。

```js
// ✅ 标准模板
const res = require('../lib/response');
const logger = require('../lib/logger');

exports.main = async (event) => {
  try {
    // 1. 鉴权
    const wxContext = cloud.getWXContext();
    if (!wxContext.OPENID) return res.unauthorized();

    // 2. 参数校验
    const { orderId } = event;
    if (!orderId) return res.fail('参数错误');

    // 3. 业务逻辑
    const order = await db.collection('orders').doc(orderId).get();
    if (!order.data) return res.fail('订单不存在');

    // 4. 返回
    return res.success({ order: order.data });

  } catch (err) {
    logger.error('cancelOrder', err, { orderId: event.orderId });
    return res.fail('系统错误，请稍后重试');
  }
};
```

**关键约定**：
- catch 中**绝不**返回 `err.message` 给客户端（可能泄露内部信息）。
- 原始错误通过 `logger.error()` 记录，客户端只收到中文提示。
- 每个 catch 必须记录日志。

## Layer 2：客户端错误处理

**规则**：每个涉及 I/O 的 Page 方法必须在 try/catch 内。

```js
// ✅ 标准模板
async loadOrders() {
  this.setData({ loading: true });
  const app = getApp();

  // Demo 降级
  if (app.globalData.demoMode) {
    const orders = demoStore.getAll(demoStore.KEYS.orders);
    this.setData({ orders: this.formatOrders(orders), loading: false });
    return;
  }

  try {
    const res = await wx.cloud.callFunction({ name: 'getMyOrders', data: { page: 1, pageSize: 500 } });
    if (res.result && res.result.code === 0) {
      this.setData({ orders: this.formatOrders(res.result.data.list || []) });
    } else {
      wx.showToast({ title: (res.result && res.result.msg) || '加载失败', icon: 'none' });
    }
  } catch (err) {
    // 网络错误（超时/DNS/无响应）
    wx.showToast({ title: '网络错误，请检查网络后重试', icon: 'none' });
    // 不在控制台泄露完整 err 对象（量太大）
    console.error('[loadOrders] 网络错误:', err.errMsg || String(err).slice(0, 100));
  }
  this.setData({ loading: false });
}
```

**Demo 模式优先原则**：所有数据加载方法必须遵循以下顺序：
1. 先判断 `app.globalData.demoMode`，是则走本地数据，直接 return
2. demo 分支不需要 try/catch（本地存储不会抛异常）
3. 云模式再走 try/catch

## Layer 3：全局兜底

`app.js` 中已实现两个全局监听器（**不要删除或修改**）：

```js
// 同步错误
wx.onError((err) => {
  const logs = wx.getStorageSync('_error_logs') || [];
  logs.push({ time: new Date().toISOString(), msg: String(err).slice(0, 500) });
  if (logs.length > 50) logs.splice(0, logs.length - 50);
  wx.setStorageSync('_error_logs', logs);
});

// 未处理的 Promise 拒绝
wx.onUnhandledRejection && wx.onUnhandledRejection((res) => {
  console.error('[未捕获Promise拒绝]', res.reason);
});
```

- `_error_logs` 最多保留最近 50 条
- 每条截断至 500 字符
- 这些日志仅用于开发者排查，**不自动上报**

## Toast 规范

| 场景 | Toast 文案示例 | icon |
|------|---------------|------|
| 成功 | `'已保存'` / `'保存成功'` | `'success'` |
| 参数缺失 | `'请填写客户名称'` / `'请填写正确的手机号'` | `'none'` |
| 业务拒绝 | `'订单已完成，无法取消'` | `'none'` |
| 网络错误 | `'网络错误，请检查网络后重试'` | `'none'` |
| 服务端返回的 msg | 直接使用 `res.result.msg` | `'none'` |
| Demo 模式操作 | `'已删除（演示模式）'` | `'success'` |

**单一原则**：Toast 文案≤12 个汉字，不堆砌信息。需要更多信息用 `wx.showModal`。

## 静默失败场景

以下场景**可以**静默（不弹 Toast，仅 console.warn）：

1. 订阅消息发送失败（非阻塞，不打扰用户）
2. 下单后自动保存地址失败（主流程已完成）
3. 下单后自动录入客户失败（主流程已完成）
4. 临时文件清理失败（`importProducts` 中 `cloud.deleteFile`）
5. 云存储文件删除失败（文件可能已不存在）
