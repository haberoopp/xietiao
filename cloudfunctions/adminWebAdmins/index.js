const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const crypto = require('crypto')
const { requireJwt, httpOk, httpError } = require('../lib/jwtAuth')
const { logOperation } = require('../lib/operationLog')

function hashPassword(password) {
  const salt = crypto.randomBytes(32).toString('hex')
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex')
  return { salt, hash }
}

exports.main = async (event) => {
  const auth = requireJwt(event)
  if (!auth.authorized) return auth.response
  if (auth.user.role !== 'manager') return httpError(403, '无权限', 403)

  const method = event.httpMethod
  const path = event.path || ''
  let body = {}
  try { body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body || {}) } catch (e) {}

  if (method === 'GET' && path === '/admins') return handleList()
  if (method === 'POST' && path === '/admins') return handleCreate(auth.user, body)
  if (method === 'PUT' && path === '/admins') return handleUpdate(auth.user, body)
  if (method === 'PUT' && path === '/admins/password') return handleChangePwd(auth.user, body)

  return httpError(404, 'Not Found', 404)
}

async function handleList() {
  try {
    const res = await db.collection('admins').field({
      passwordHash: false, salt: false, password: false, failedAttempts: false, lockedUntil: false
    }).get()
    return httpOk({ list: res.data })
  } catch (err) { return httpError(500, '加载失败', 500) }
}

async function handleCreate(user, body) {
  try {
    const { username, password, nickname, role } = body
    if (!username || !password) return httpError(400, '用户名和密码不能为空')
    const existing = await db.collection('admins').where({ username: username.trim() }).count()
    if (existing.total > 0) return httpError(409, '用户名已存在')
    const { salt, hash } = hashPassword(password)
    await db.collection('admins').add({
      data: {
        username: username.trim(), passwordHash: hash, salt, role: role || 'delivery',
        nickname: nickname || username.trim(), status: 'active', createdBy: user.username,
        failedAttempts: 0, loggedIn: false, createdAt: db.serverDate(), updatedAt: db.serverDate()
      }
    })
    await logOperation(db, user.username, 'admin.create', username, `新增管理员「${username}」`)
    return httpOk({})
  } catch (err) { return httpError(500, '创建失败', 500) }
}

async function handleUpdate(user, body) {
  try {
    const { _id, nickname, role, status } = body
    if (!_id) return httpError(400, '管理员ID不能为空')
    const data = { updatedAt: db.serverDate() }
    if (nickname) data.nickname = nickname
    if (role) data.role = role
    if (status) data.status = status
    await db.collection('admins').doc(_id).update({ data })
    if (status === 'disabled') await logOperation(db, user.username, 'admin.disable', body.username || _id, `禁用管理员`)
    return httpOk({})
  } catch (err) { return httpError(500, '更新失败', 500) }
}

async function handleChangePwd(user, body) {
  try {
    const { oldPassword, newPassword } = body
    if (!oldPassword || !newPassword) return httpError(400, '请输入旧密码和新密码')
    if (newPassword.length < 4) return httpError(400, '密码至少4位')

    const res = await db.collection('admins').where({ username: user.username }).get()
    if (!res.data.length) return httpError(404, '账号不存在')
    const admin = res.data[0]

    let ok = false
    if (admin.passwordHash && admin.salt) {
      ok = crypto.pbkdf2Sync(oldPassword, admin.salt, 10000, 64, 'sha512').toString('hex') === admin.passwordHash
    } else if (admin.password) {
      ok = oldPassword === admin.password
    }
    if (!ok) return httpError(-1, '旧密码不正确')

    const { salt, hash } = hashPassword(newPassword)
    await db.collection('admins').doc(admin._id).update({ data: { passwordHash: hash, salt, password: db.command.remove(), updatedAt: db.serverDate() } })
    await logOperation(db, user.username, 'admin.password', user.username, '修改密码')
    return httpOk({})
  } catch (err) { return httpError(500, '修改失败', 500) }
}
