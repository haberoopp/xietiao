const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const pwHash = require('./passwordHash')
const pwPolicy = require('./passwordPolicy')
const { requireJwt, httpOk, httpError } = require('./jwtAuth')
const { logOperation } = require('./operationLog')

// 手动解析 form-urlencoded（避免依赖 querystring 模块）
function parseFormUrlEncoded(str) {
  const result = {}
  if (!str || typeof str !== 'string') return result
  str.split('&').forEach(function (pair) {
    var parts = pair.split('=')
    if (parts[0]) {
      var key = decodeURIComponent(parts[0])
      var val = parts[1] ? decodeURIComponent(parts[1].replace(/\+/g, ' ')) : ''
      result[key] = val
    }
  })
  return result
}

// 通用 body 解析：支持 JSON / form-urlencoded / base64
function parseBody(event) {
  try {
    let raw = event.body || '{}'
    // base64 解码
    if (event.isBase64Encoded && typeof raw === 'string') {
      raw = Buffer.from(raw, 'base64').toString('utf-8')
    }
    // 已经是对象则直接返回
    if (typeof raw === 'object') return raw
    // 尝试 JSON 解析
    let parsed
    try { parsed = JSON.parse(raw) } catch (_) { /* not JSON */ }
    if (parsed && typeof parsed === 'object') return parsed
    // 尝试 form-urlencoded 解析
    if (raw.includes('=') && !raw.includes('{')) {
      parsed = parseFormUrlEncoded(raw)
      if (Object.keys(parsed).length > 0) return parsed
    }
    return {}
  } catch (e) {
    console.error('[parseBody] error:', e.message)
    return {}
  }
}

exports.main = async (event) => {
  console.log('[main] START method=' + (event.httpMethod || 'NONE') + ' path=' + (event.path || 'NONE'))

  const method = event.httpMethod
  const path = (event.path || '').replace('/api/admin', '')
  const body = parseBody(event)

  // CORS 预检处理
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
      },
      body: ''
    }
  }

  const auth = await requireJwt(event)
  if (!auth.authorized) return auth.response
  if (auth.user.role !== 'manager') return httpError(403, '无权限', 403)

  if (method === 'GET' && path === '/admins') return handleList()
  if (method === 'POST' && path === '/admins') return handleCreate(auth.user, body)
  if (method === 'PUT' && path === '/admins') return handleUpdate(auth.user, body)
  if (method === 'PUT' && path === '/admins/password') return handleChangePwd(auth.user, body)
  if (method === 'DELETE' && path === '/admins') return handleDelete(auth.user, body)

  return httpError(404, 'Not Found', 404)
}

async function handleList() {
  try {
    const res = await db.collection('admins').field({
      passwordHash: false, salt: false, password: false, failedAttempts: false, lockedUntil: false
    }).get()
    return httpOk({ list: res.data })
  } catch (err) {
    console.error('adminWebAdmins.handleList error:', err)
    return httpError(500, '加载失败', 500)
  }
}

async function handleCreate(user, body) {
  console.log('[handleCreate] START body:', JSON.stringify(body))
  console.log('[handleCreate] user:', JSON.stringify(user))
  try {
    const { username, password, nickname, role, status } = body
    console.log('[handleCreate] step1: username=' + username + ' role=' + role + ' status=' + status + ' pwdLen=' + (password ? password.length : 0))
    if (!username || !password) return httpError(400, '用户名和密码不能为空')
    if (typeof password !== 'string' || password.trim().length < pwPolicy.MIN_LENGTH) {
      return httpError(400, `密码不符合格式：至少${pwPolicy.MIN_LENGTH}位，需包含英文字母和数字`)
    }
    const VALID_ROLES = ['manager', 'delivery', 'warehouse']
    const VALID_STATUS = ['active', 'disabled']
    if (role && !VALID_ROLES.includes(role)) return httpError(400, '无效的角色类型')
    if (status && !VALID_STATUS.includes(status)) return httpError(400, '无效的状态值')
    console.log('[handleCreate] step2: validation passed')
    const pwCheck = pwPolicy.validate(password, { username: (username || '').trim() })
    if (!pwCheck.valid) return httpError(400, pwCheck.errors.join('；'))
    console.log('[handleCreate] step3: password policy passed')
    const existing = await db.collection('admins').where({ username: username.trim() }).count()
    console.log('[handleCreate] step4: count=' + existing.total)
    if (existing.total > 0) return httpError(409, '用户名已存在')
    console.log('[handleCreate] step5: hashing password...')
    const { salt, hash } = pwHash.hashPassword(password)
    console.log('[handleCreate] step6: password hashed, saltLen=' + salt.length + ' hashLen=' + hash.length)
    console.log('[handleCreate] step7: writing to database...')
    await db.collection('admins').add({
      data: {
        username: username.trim(), passwordHash: hash, salt, role: role || 'delivery',
        nickname: nickname || username.trim(), status: status || 'active', createdBy: user.username,
        failedAttempts: 0, loggedIn: false, forcePasswordChange: true,
        createdAt: db.serverDate(), updatedAt: db.serverDate()
      }
    })
    console.log('[handleCreate] step8: db write OK')
    await logOperation(db, user.username, 'admin.create', username, `新增管理员「${username}」`)
    console.log('[handleCreate] step9: logOperation done')
    return httpOk({})
  } catch (err) {
    console.error('[handleCreate] FAILED at step -- error:', err)
    console.error('[handleCreate] error name:', err.name)
    console.error('[handleCreate] error message:', err.message)
    console.error('[handleCreate] error stack:', err.stack)
    return httpError(500, '创建失败', 500)
  }
}

async function handleUpdate(user, body) {
  try {
    const { _id, nickname, role, status } = body
    if (!_id) return httpError(400, '管理员ID不能为空')
    const VALID_ROLES = ['manager', 'delivery', 'warehouse']
    const VALID_STATUS = ['active', 'disabled']
    if (role && !VALID_ROLES.includes(role)) return httpError(400, '无效的角色类型')
    if (status && !VALID_STATUS.includes(status)) return httpError(400, '无效的状态值')
    const data = { updatedAt: db.serverDate() }
    if (nickname) data.nickname = nickname
    if (role) data.role = role
    if (status) data.status = status
    await db.collection('admins').doc(_id).update({ data })
    if (status === 'disabled') await logOperation(db, user.username, 'admin.disable', body.username || _id, `禁用管理员`)
    else if (status === 'active') await logOperation(db, user.username, 'admin.enable', body.username || _id, `启用管理员`)
    return httpOk({})
  } catch (err) {
    console.error('adminWebAdmins.handleUpdate error:', err)
    return httpError(500, '更新失败', 500)
  }
}

async function handleDelete(user, body) {
  try {
    const { _id } = body
    if (!_id) return httpError(400, '管理员ID不能为空')
    // 不允许删除自己
    const target = await db.collection('admins').doc(_id).get()
    if (!target.data) return httpError(404, '管理员不存在')
    if (target.data.username === user.username) return httpError(400, '不能删除自己')
    // 不允许删除最后一个厂长
    if (target.data.role === 'manager') {
      const managerCount = await db.collection('admins').where({ role: 'manager', status: 'active' }).count()
      if (managerCount.total <= 1) return httpError(400, '不能删除最后一个厂长账号')
    }
    await db.collection('admins').doc(_id).remove()
    await logOperation(db, user.username, 'admin.delete', target.data.username, `删除管理员「${target.data.username}」`)
    return httpOk({})
  } catch (err) {
    console.error('adminWebAdmins.handleDelete error:', err)
    return httpError(500, '删除失败', 500)
  }
}

async function handleChangePwd(user, body) {
  try {
    const { oldPassword, newPassword } = body
    if (!oldPassword || !newPassword) return httpError(400, '请输入旧密码和新密码')
    if (newPassword.length < pwPolicy.MIN_LENGTH) return httpError(400, `密码不符合格式：至少${pwPolicy.MIN_LENGTH}位，需包含英文字母和数字`)
    const pwCheck = pwPolicy.validate(newPassword, { username: user.username })
    if (!pwCheck.valid) return httpError(400, pwCheck.errors.join('；'))

    const res = await db.collection('admins').where({ username: user.username }).get()
    if (!res.data.length) return httpError(404, '账号不存在')
    const admin = res.data[0]

    let oldOk = false
    if (admin.passwordHash && admin.salt) {
      oldOk = pwHash.verifyPassword(oldPassword, admin.salt, admin.passwordHash)
    } else if (admin.password) {
      oldOk = (oldPassword === admin.password)
    }
    if (!oldOk) return httpError(400, '旧密码不正确')

    // Check same password
    const sameAsOld = (admin.passwordHash && admin.salt && pwHash.verifyPassword(newPassword, admin.salt, admin.passwordHash)) ||
                      (admin.password && newPassword === admin.password)
    if (sameAsOld) return httpError(400, '新密码不能与旧密码相同')

    const { salt, hash } = pwHash.hashPassword(newPassword)
    await db.collection('admins').doc(admin._id).update({
      data: {
        passwordHash: hash, salt, password: db.command.remove(),
        forcePasswordChange: false, updatedAt: db.serverDate()
      }
    })
    await logOperation(db, user.username, 'admin.password', user.username, '修改密码')
    return httpOk({})
  } catch (err) {
    console.error('adminWebAdmins.handleChangePwd error:', err)
    return httpError(500, '修改失败', 500)
  }
}
