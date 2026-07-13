const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const res = require('./response');
const logger = require('./logger');
const crypto = require('crypto');

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

function generateSalt() {
  return crypto.randomBytes(32).toString('hex');
}

exports.main = async (event) => {
  const { username, password } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  if (!username || !password) {
    return res.badRequest('请输入账号和密码');
  }
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.badRequest('参数格式错误');
  }

  try {
    const result = await db.collection('admins').where({ username: username.trim() }).get();
    if (result.data.length === 0) {
      return res.badRequest('账号或密码错误');
    }

    const admin = result.data[0];

    // 检查账号状态
    if (admin.status === 'disabled') {
      logger.warn('adminLogin: disabled account attempt', { username });
      return res.badRequest('账号或密码错误');
    }

    // 检查是否被锁定
    if (admin.lockedUntil && admin.lockedUntil > Date.now()) {
      logger.warn('adminLogin: locked account attempt', { username });
      return res.badRequest('账号或密码错误');
    }

    let valid = false;

    if (admin.passwordHash) {
      // 哈希验证 (10k PBKDF2-SHA512，与初始部署代码一致)
      const hash = hashPassword(password, admin.salt);
      valid = hash === admin.passwordHash;
    } else {
      // 兼容旧版明文密码
      valid = password === admin.password;
    }

    if (!valid) {
      // 记录失败次数
      const failedAttempts = (admin.failedAttempts || 0) + 1;
      const updateData = {
        failedAttempts,
        updatedAt: db.serverDate()
      };
      if (failedAttempts >= MAX_ATTEMPTS) {
        updateData.lockedUntil = Date.now() + LOCK_MINUTES * 60000;
      }
      await db.collection('admins').doc(admin._id).update({ data: updateData });
      return res.badRequest('账号或密码错误');
    }

    // 登录成功前：清除同一 openid 下其他管理员旧登录态，防止多账号残留
    await db.collection('admins')
      .where({ lastLoginOpenid: openid, loggedIn: true, _id: db.command.neq(admin._id) })
      .update({ data: { loggedIn: false, updatedAt: db.serverDate() } });

    // 登录成功：重置失败次数，迁移密码，记录登录信息
    const updateData = {
      failedAttempts: 0,
      lockedUntil: null,
      loggedIn: true,
      lastLoginOpenid: openid,
      lastLoginAt: db.serverDate(),
      lastActivityAt: db.serverDate(),
      updatedAt: db.serverDate()
    };
    if (admin.password && !admin.passwordHash) {
      const salt = generateSalt();
      updateData.passwordHash = hashPassword(password, salt);
      updateData.salt = salt;
      updateData.password = db.command.remove();
    }

    await db.collection('admins').doc(admin._id).update({ data: updateData });

    logger.info('adminLogin', { adminId: admin._id, username: admin.username });
    return res.record({
      adminId: admin._id,
      username: admin.username,
      role: admin.role || 'warehouse',
      nickname: admin.nickname || admin.username
    });
  } catch (err) {
    logger.error('adminLogin', err, { username });
    return res.internalError();
  }
};
