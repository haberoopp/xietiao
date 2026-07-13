const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const res = require('./response');
const logger = require('./logger');
const auth = require('./auth');
const pwHash = require('./passwordHash');

const ACCOUNTS = [
  { username: 'changzhang', password: pwHash.generateRandomPassword(16), role: 'manager', nickname: '厂长' },
  { username: 'songhuo',   password: pwHash.generateRandomPassword(16), role: 'delivery', nickname: '送货员' },
  { username: 'diaohuo',   password: pwHash.generateRandomPassword(16), role: 'warehouse', nickname: '仓库调货员' },
];

exports.main = async () => {
  const authResult = await auth.requireRole('manager');
  if (!authResult.authorized) return authResult.response;
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

      const { salt, hash: passwordHash } = pwHash.hashPassword(account.password);

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
      results.push({ username: account.username, status: 'created', password: account.password });
    }
    logger.info('Admin accounts initialized', { count: results.length });
    // Log that passwords were generated — do NOT log the actual password values
    results.forEach(r => {
      if (r.status === 'created') {
        logger.info('Admin account created with random password', { username: r.username, note: 'Password only visible once in initAdminAccounts response' });
      }
    });
    return res.record(results);
  } catch (err) {
    logger.error('initAdminAccounts error', err);
    return res.internalError();
  }
};
