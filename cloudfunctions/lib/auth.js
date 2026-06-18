/**
 * 统一鉴权模块
 *
 * 所有云函数的身份校验通过此模块完成，不每个函数自行编写。
 * 使用微信框架自动注入的 openid，不是自建 token 系统。
 *
 * Usage:
 *   const auth = require('../lib/auth');
 *
 *   // 客户身份
 *   const r = await auth.requireOpenid();
 *   if (!r.authorized) return r.response;
 *   // r.openid 可用
 *
 *   // 管理员身份
 *   const r = await auth.requireAdmin();
 *   if (!r.authorized) return r.response;
 *   // r.admin + r.openid 可用
 */

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const res = require('./response');

/**
 * 客户身份校验
 * 仅验证微信 openid 存在，不查数据库。
 * @returns {Promise<{ authorized: true, openid: string } | { authorized: false, response: object }>}
 */
async function requireOpenid() {
  const openid = cloud.getWXContext().OPENID;
  if (!openid) {
    return { authorized: false, response: res.unauthorized() };
  }
  return { authorized: true, openid };
}

/**
 * 管理员身份校验
 * 验证 openid 存在且在 admins 表中有有效登录态。
 * @returns {Promise<{ authorized: true, admin: object, openid: string } | { authorized: false, response: object }>}
 */
async function requireAdmin() {
  const openid = cloud.getWXContext().OPENID;
  if (!openid) {
    return { authorized: false, response: res.unauthorized() };
  }

  try {
    const result = await db.collection('admins')
      .where({ lastLoginOpenid: openid, loggedIn: true })
      .get();

    if (result.data.length === 0) {
      return { authorized: false, response: res.forbidden() };
    }

    return { authorized: true, admin: result.data[0], openid };
  } catch (err) {
    return { authorized: false, response: res.internalError() };
  }
}

module.exports = {
  requireOpenid,
  requireAdmin
};
