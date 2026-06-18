const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const crypto = require('crypto');
const res = require('./response');
const logger = require('./logger');
const auth = require('./auth');

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

function generateSalt() {
  return crypto.randomBytes(32).toString('hex');
}

const ACCOUNTS = [
  { username: 'changzhang', password: '123456', role: 'manager', nickname: '厂长' },
  { username: 'songhuo', password: '123456', role: 'delivery', nickname: '送货员' },
  { username: 'diaohuo', password: '123456', role: 'warehouse', nickname: '仓库调货员' },
];

exports.main = async () => {
  try {
    const results = [];
    for (const account of ACCOUNTS) {
      const existing = await db.collection('admins')
        .where({ username: account.username })
        .get();

      if (existing.data.length > 0) {
        results.push({ username: account.username, status: 'skipped', reason: 'already exists' });
        continue;
      }

      const salt = generateSalt();
      const passwordHash = hashPassword(account.password, salt);

      await db.collection('admins').add({
        data: {
          username: account.username,
          passwordHash,
          salt,
          role: account.role,
          nickname: account.nickname,
          failedAttempts: 0,
          lockedUntil: null,
          loggedIn: false,
          lastLoginOpenid: null,
          lastLoginAt: null,
          createdAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
      });
      results.push({ username: account.username, status: 'created' });
    }
    logger.info('Seed admin accounts', { count: results.length });
    return res.record(results);
  } catch (err) {
    logger.error('seedAdmin error', { error: err.message });
    return res.internalError();
  }
};
