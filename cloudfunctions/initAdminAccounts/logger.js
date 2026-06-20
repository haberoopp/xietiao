/**
 * 结构化日志模块
 *
 * 所有云函数使用此模块记录日志，不再直接使用 console.log。
 * 输出格式: [ISO时间] [级别] 事件名 {"key":"value"} 错误信息
 *
 * Usage:
 *   const logger = require('../lib/logger');
 *   logger.info('orderSubmitted', { orderId: result._id, amount: 25000 });
 *   logger.warn('notifyFailed', { orderId: 'xxx', errCode: 20001 });
 *   logger.error('dbWriteError', err, { collection: 'orders' });
 *
 * 级别说明:
 *   info  — 关键业务流程节点（下单、状态变更、退换货申请）
 *   warn  — 可恢复的异常（通知失败、降级操作）
 *   error — 不可恢复的错误（需人工排查）
 */

const LEVELS = {
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR'
};

/**
 * 序列化对象为单行 JSON（防循环引用，截断过长内容）
 * @param {Object} obj
 * @returns {string}
 */
function safeStringify(obj) {
  if (!obj || typeof obj !== 'object') return String(obj);
  try {
    const s = JSON.stringify(obj, null, 0);
    return s.length > 500 ? s.slice(0, 497) + '...' : s;
  } catch (e) {
    return '[unserializable]';
  }
}

/**
 * 写入一条结构化日志
 * @param {string} level - INFO | WARN | ERROR
 * @param {string} event - 事件名（camelCase）
 * @param {Error|Object} [contextOrError] - 上下文对象 或 Error 对象
 * @param {Object} [context] - 上下文对象（仅当第三个参数是 Error 时使用）
 */
function log(level, event, contextOrError, context) {
  const timestamp = new Date().toISOString();
  let ctxObj = {};
  let errObj = null;

  if (contextOrError instanceof Error) {
    errObj = contextOrError;
    ctxObj = context || {};
  } else if (contextOrError && typeof contextOrError === 'object') {
    ctxObj = contextOrError;
  }

  const parts = [`[${timestamp}]`, `[${level}]`, event, safeStringify(ctxObj)];

  if (errObj) {
    parts.push(errObj.message);
    if (errObj.stack) {
      // 只取第一行堆栈（文件+行号）
      const firstLine = errObj.stack.split('\n')[1] || '';
      parts.push(firstLine.trim());
    }
  }

  const line = parts.join(' ');

  switch (level) {
    case LEVELS.ERROR:
      console.error(line);
      break;
    case LEVELS.WARN:
      console.warn(line);
      break;
    default:
      console.log(line);
  }
}

/**
 * 记录关键业务节点
 * @param {string} event - 事件名
 * @param {Object} [context] - 上下文
 */
function info(event, context) {
  log(LEVELS.INFO, event, context);
}

/**
 * 记录可恢复异常
 * @param {string} event - 事件名
 * @param {Object} [context] - 上下文
 */
function warn(event, context) {
  log(LEVELS.WARN, event, context);
}

/**
 * 记录不可恢复错误
 * @param {string} event - 事件名
 * @param {Error} err - 原始错误对象
 * @param {Object} [context] - 附加上下文
 */
function error(event, err, context) {
  log(LEVELS.ERROR, event, err, context);
}

module.exports = {
  info,
  warn,
  error,
  LEVELS
};
