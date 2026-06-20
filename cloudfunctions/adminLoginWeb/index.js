const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const crypto = require('crypto')
const { sign, httpOk, httpError } = require('../lib/jwtAuth')

function verifyPassword(password, salt, hash) {
  const derived = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex')
  return derived === hash
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

  try {
    const result = await db.collection('admins').where({ username: username.trim() }).get()
    if (result.data.length === 0) return httpError(-1, '账号或密码错误')
    const admin = result.data[0]

    if (admin.status === 'disabled') return httpError(-1, '账号已被禁用，请联系管理员')
    if (admin.lockedUntil && admin.lockedUntil > Date.now()) {
      const minutes = Math.ceil((admin.lockedUntil - Date.now()) / 60000)
      return httpError(-1, `账号已锁定，请${minutes}分钟后再试`)
    }

    let passwordOk = false
    if (admin.passwordHash && admin.salt) {
      passwordOk = verifyPassword(password, admin.salt, admin.passwordHash)
    } else if (admin.password) {
      passwordOk = (password === admin.password)
    }

    if (!passwordOk) {
      const failedAttempts = (admin.failedAttempts || 0) + 1
      const updateData = { failedAttempts: db.command.inc(1) }
      if (failedAttempts >= 5) updateData.lockedUntil = Date.now() + 15 * 60 * 1000
      await db.collection('admins').doc(admin._id).update({ data: updateData })
      return httpError(-1, failedAttempts >= 5 ? '密码错误次数过多，账号已锁定15分钟' : '账号或密码错误')
    }

    await db.collection('admins').doc(admin._id).update({
      data: { failedAttempts: 0, lockedUntil: db.command.remove(), lastLoginAt: db.serverDate(), updatedAt: db.serverDate() }
    })

    const token = sign({ username: admin.username, role: admin.role, nickname: admin.nickname || admin.username })
    return httpOk({ token, username: admin.username, role: admin.role, nickname: admin.nickname || admin.username })
  } catch (err) {
    console.error('adminLoginWeb error:', err)
    return httpError(500, '登录失败，请稍后重试', 500)
  }
}
