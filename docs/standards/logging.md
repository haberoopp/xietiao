# 日志记录规范

## 日志分级

| 级别 | 方法 | 使用场景 | 示例 |
|------|------|---------|------|
| **info** | `logger.info()` | 关键业务流程节点 | 下单成功、状态变更、退换货申请 |
| **warn** | `logger.warn()` | 可恢复的异常、降级 | 订阅消息发送失败、通知模块跳过 |
| **error** | `logger.error()` | 不可恢复的错误 | 数据库写入失败、云函数执行异常 |

## 云函数日志（结构化）

使用共享库 `cloudfunctions/lib/logger.js`：

```js
const logger = require('../lib/logger');

// 使用示例
logger.info('orderSubmitted', { orderId: result._id, totalAmount: order.totalAmount });
logger.warn('notifyFailed', { orderId: order._id, errCode: 20001 });
logger.error('dbWriteFailed', err, { collection: 'orders', operation: 'add' });
```

**每条日志必须包含**：
1. **event** — 简短的事件名（camelCase，如 `orderSubmitted`、`statusChanged`、`dbWriteFailed`）
2. **context** — 包含 `_id` / `orderId` / `productId` 等关键标识的对象
3. **error**（仅 error 级别）— 原始 error 对象

**日志输出格式**（控制台）：

```
[2026-06-18T14:32:05.123Z] [INFO] orderSubmitted {"orderId":"abc123","totalAmount":25000}
[2026-06-18T14:32:10.456Z] [ERROR] dbWriteFailed {"collection":"orders","operation":"add"} Error: ...
```

## 客户端日志

客户端不需要 `logger` 模块（避免体积膨胀），使用 `console`：

```js
// ✅ 关键节点
console.log(`✅ 已加载 ${allProducts.length} / ${total} 个产品`);

// ✅ 错误
console.error('[loadOrders] 网络错误:', err.errMsg || String(err).slice(0, 100));

// ✅ 警告
console.warn('[notify] 订阅消息发送失败:', err.errCode);

// ❌ 禁止：生产环境输出完整对象
console.log('订单数据:', JSON.stringify(order));  // 量太大
```

## 全局错误日志

`app.js` 自动将所有未捕获错误写入 `_error_logs`（Storage，最多 50 条）：

```js
// 开发者手动查看（可在调试控制台执行）
const logs = wx.getStorageSync('_error_logs');
console.table(logs);
```

## 日志保留策略

| 存储位置 | 保留策略 | 用途 |
|---------|---------|------|
| 云函数控制台 | 腾讯云默认 7 天 | 生产问题排查 |
| 客户端 Storage `_error_logs` | 最近 50 条 | 客户端崩溃排查 |

## 禁止事项

1. **禁止** `console.log` 打印敏感信息（密码、手机号全号、完整地址）
2. **禁止** 在循环中打日志（如 `for` 循环中 `console.log` 每个 item）
3. **禁止** 使用 `console.log(JSON.stringify(largeObject))` 打印大对象
4. **禁止** catch 块中不记录日志直接吞掉错误
