const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const crypto = require('crypto')
const { sign, httpOk, httpError } = require('./jwtAuth')
const rateLimiter = require('./rateLimiter')

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex')
}

exports.main = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: '' }
  }
  if (event.httpMethod !== 'POST') return httpError(405, 'Method Not Allowed', 405)

  let body
  try { body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body } catch (e) { return httpError(400, '请求格式错误') }
  const { username, password } = body || {}
  if (!username || !password) return httpError(400, '请输入用户名和密码')

  // 频率限制：每个用户名每分钟最多10次尝试
  const ip = (event.headers && (event.headers['x-forwarded-for'] || event.headers['X-Forwarded-For'])) || 'unknown';
  const rateKey = `login:${ip}:${(username || '').trim()}`;
  const rateCheck = await rateLimiter.check(db, rateKey, { max: 10, window: 60 });
  if (!rateCheck.allowed) return httpError(429, `请求过于频繁，请${rateCheck.retryAfter}秒后再试`, 429);

  try {
    const result = await db.collection('admins').where({ username: username.trim() }).get()
    if (result.data.length === 0) return httpError(401, '账号或密码错误', 401)
    const admin = result.data[0]

    if (admin.status === 'disabled') { console.log('adminLoginWeb: disabled account', { username: username.trim() }); return httpError(401, '账号或密码错误', 401) }
    if (admin.lockedUntil && admin.lockedUntil > Date.now()) {
      console.log('adminLoginWeb: locked account', { username: username.trim() })
      return httpError(401, '账号或密码错误', 401)
    }

    let passwordOk = false
    if (admin.passwordHash && admin.salt) {
      passwordOk = hashPassword(password, admin.salt) === admin.passwordHash
    } else if (admin.password) {
      passwordOk = (password === admin.password)
    }

    if (!passwordOk) {
      // 原子递增失败次数
      await db.collection('admins').doc(admin._id).update({
        data: { failedAttempts: db.command.inc(1), updatedAt: db.serverDate() }
      })
      // 重新读取以判断是否需要锁定（inc 后值 = 原值 + 1）
      const updatedAdmin = await db.collection('admins').doc(admin._id).field({ failedAttempts: true }).get()
      const currentAttempts = updatedAdmin.data.failedAttempts
      if (currentAttempts >= 5) {
        await db.collection('admins').doc(admin._id).update({
          data: { lockedUntil: Date.now() + 15 * 60 * 1000, updatedAt: db.serverDate() }
        })
        return httpError(423, '密码错误次数过多，账号已锁定15分钟', 423)
      }
      return httpError(401, '账号或密码错误', 401)
    }

    // 自动迁移旧明文密码到哈希存储
    if (admin.password && !admin.passwordHash) {
      const salt = crypto.randomBytes(32).toString('hex')
      const passwordHash = hashPassword(password, salt)
      await db.collection('admins').doc(admin._id).update({
        data: { passwordHash, salt, password: db.command.remove(), updatedAt: db.serverDate() }
      })
    }

    await db.collection('admins').doc(admin._id).update({
      data: { failedAttempts: 0, lockedUntil: db.command.remove(), lastLoginAt: db.serverDate(), updatedAt: db.serverDate() }
    })

    const token = await sign({ username: admin.username, role: admin.role, nickname: admin.nickname || admin.username })
    return httpOk({ token, username: admin.username, role: admin.role, nickname: admin.nickname || admin.username })
  } catch (err) {
    console.error('adminLoginWeb error:', err)
    return httpError(500, '登录失败，请稍后重试', 500)
  }
}
