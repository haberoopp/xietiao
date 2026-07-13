/**
 * 修改管理员密码
 *
 * 仅允许已登录管理员修改自己的密码。
 * 要求验证旧密码，新密码需满足强度策略。
 */

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const res = require('./response');
const logger = require('./logger');
const auth = require('./auth');
const pwHash = require('./passwordHash');
const pwPolicy = require('./passwordPolicy');

exports.main = async (event) => {
  const { oldPassword, newPassword } = event;

  if (!oldPassword || !newPassword) {
    return res.badRequest('请输入旧密码和新密码');
  }

  try {
    const authResult = await auth.requireAdmin();
    if (!authResult.authorized) return authResult.response;

    const admin = authResult.admin;

    // 校验新密码强度
    const pwCheck = pwPolicy.validate(newPassword, { username: admin.username });
    if (!pwCheck.valid) {
      return res.badRequest(pwCheck.errors.join('；'));
    }

    // 验证旧密码
    let valid = false;
    if (admin.passwordHash && admin.salt) {
      valid = pwHash.verifyPassword(oldPassword, admin.salt, admin.passwordHash);
    } else if (admin.password) {
      // 兼容旧明文密码
      valid = oldPassword === admin.password;
    }

    if (!valid) {
      return res.badRequest('旧密码不正确');
    }

    // 新密码不能与旧密码相同
    let sameAsOld = false;
    if (admin.passwordHash && admin.salt) {
      sameAsOld = pwHash.verifyPassword(newPassword, admin.salt, admin.passwordHash);
    } else if (admin.password) {
      sameAsOld = newPassword === admin.password;
    }
    if (sameAsOld) {
      return res.badRequest('新密码不能与旧密码相同');
    }

    // 生成新哈希
    const { salt, hash: passwordHash } = pwHash.hashPassword(newPassword);

    const updateData = {
      passwordHash,
      salt,
      loggedIn: false,
      updatedAt: db.serverDate()
    };
    // 清除旧明文字段
    if (admin.password) {
      updateData.password = db.command.remove();
    }

    await db.collection('admins').doc(admin._id).update({ data: updateData });

    logger.info('changePassword', { adminId: admin._id, username: admin.username });
    return res.ok();
  } catch (err) {
    logger.error('changePassword', err, { username: event.oldPassword ? '***' : undefined });
    return res.internalError();
  }
};
