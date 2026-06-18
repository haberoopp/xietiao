/**
 * 统一 API 响应构建器
 *
 * 对标 HTTP 语义设计 code 值，覆盖所有成功/失败场景。
 * 所有云函数必须使用此模块构建返回值。
 *
 * 成功场景:
 *   res.list(list, total, page, pageSize)     — 列表（含分页信息）
 *   res.record(data)                           — 对象（详情/创建后/更新后）
 *   res.ok()                                   — 无数据返回（纯操作）
 *
 * 失败场景:
 *   res.badRequest(msg, errors?)               — 400 参数错误
 *   res.unauthorized()                         — 401 未登录
 *   res.forbidden(msg?)                        — 403 无权限
 *   res.notFound(msg)                          — 404 资源不存在
 *   res.conflict(msg)                          — 409 状态冲突
 *   res.internalError()                        — 500 系统异常
 */

// ============================================================
// 成功场景
// ============================================================

/**
 * 列表响应（分页数据）
 * @param {Array} list - 数据行（可为空数组）
 * @param {number} total - 总记录数
 * @param {number} [page] - 当前页码
 * @param {number} [pageSize] - 每页数量
 */
function list(list, total, page, pageSize) {
  const data = { list: list || [], total: total || 0 };
  if (page !== undefined) data.page = page;
  if (pageSize !== undefined) data.pageSize = pageSize;
  return { code: 0, data: data };
}

/**
 * 对象响应（详情、创建后、更新后）
 * @param {Object|null} data - 单条记录（可为 null 表示不存在但非错误）
 */
function record(data) {
  return { code: 0, data: { record: data } };
}

/**
 * 无数据成功响应（删除、登出、切换状态等纯操作）
 */
function ok() {
  return { code: 0 };
}

// ============================================================
// 失败场景
// ============================================================

/**
 * 400 — 参数错误
 * @param {string} msg - 用户可读的中文摘要
 * @param {Object} [errors] - 逐字段错误明细 { fieldName: '中文描述' }
 */
function badRequest(msg, errors) {
  const result = { code: 400, msg: msg };
  if (errors) result.errors = errors;
  return result;
}

/**
 * 401 — 未登录
 */
function unauthorized() {
  return { code: 401, msg: '请先登录' };
}

/**
 * 403 — 无权限
 * @param {string} [msg] - 自定义描述，默认 '无权限'
 */
function forbidden(msg) {
  return { code: 403, msg: msg || '无权限' };
}

/**
 * 404 — 资源不存在
 * @param {string} msg - 描述哪个资源不存在
 */
function notFound(msg) {
  return { code: 404, msg: msg || '资源不存在' };
}

/**
 * 409 — 业务状态冲突
 * @param {string} msg - 描述冲突原因
 */
function conflict(msg) {
  return { code: 409, msg: msg || '操作冲突' };
}

/**
 * 500 — 系统异常
 */
function internalError() {
  return { code: 500, msg: '操作失败，请稍后重试' };
}

module.exports = {
  // 成功
  list,
  record,
  ok,
  // 失败
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  internalError
};
