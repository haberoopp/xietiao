const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
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
    return { code: -1, msg: '请输入账号和密码' };
  }

  try {
    const result = await db.collection('admins').where({ username }).get();
    if (result.data.length === 0) {
      return { code: -1, msg: '账号或密码错误' };
    }

    const admin = result.data[0];

    // 检查是否被锁定
    if (admin.lockedUntil && admin.lockedUntil > Date.now()) {
      const remaining = Math.ceil((admin.lockedUntil - Date.now()) / 60000);
      return { code: -1, msg: `账号已锁定，请${remaining}分钟后再试` };
    }

    let valid = false;
    let needsMigration = false;

    if (admin.passwordHash) {
      // 新版哈希验证
      const hash = hashPassword(password, admin.salt);
      valid = hash === admin.passwordHash;
    } else {
      // 兼容旧版明文密码
      valid = password === admin.password;
      needsMigration = true;
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
      return { code: -1, msg: '账号或密码错误' };
    }

    // 登录成功：重置失败次数，迁移密码，记录登录信息
    const updateData = {
      failedAttempts: 0,
      lockedUntil: null,
      loggedIn: true,
      lastLoginOpenid: openid,
      lastLoginAt: db.serverDate(),
      updatedAt: db.serverDate()
    };
    if (needsMigration) {
      const salt = generateSalt();
      updateData.passwordHash = hashPassword(password, salt);
      updateData.salt = salt;
      updateData.password = db.command.remove();
    }

    await db.collection('admins').doc(admin._id).update({ data: updateData });

    return {
      code: 0,
      data: {
        adminId: admin._id,
        username: admin.username,
        role: admin.role || 'warehouse',
        nickname: admin.nickname || admin.username
      }
    };
  } catch (err) {
    return { code: -1, msg: err.message };
  }
};
