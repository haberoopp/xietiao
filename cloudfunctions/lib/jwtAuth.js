const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'xietiao-admin-jwt-secret-2026'
const TOKEN_EXPIRES = '24h'

function sign(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRES })
}

function verify(token) {
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    return { valid: true, payload }
  } catch (err) {
    if (err.name === 'TokenExpiredError') return { valid: false, error: '登录已过期' }
    return { valid: false, error: '无效的登录凭证' }
  }
}

function requireJwt(event) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization || ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) {
    return { authorized: false, response: { statusCode: 401, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 401, msg: '请先登录' }) } }
  }
  const result = verify(token)
  if (!result.valid) {
    return { authorized: false, response: { statusCode: 401, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 401, msg: result.error }) } }
  }
  return { authorized: true, user: result.payload }
}

function httpOk(data) {
  return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ code: 0, data }) }
}

function httpError(code, msg, httpStatus) {
  return { statusCode: httpStatus || 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ code, msg }) }
}

module.exports = { sign, verify, requireJwt, httpOk, httpError, JWT_SECRET }
