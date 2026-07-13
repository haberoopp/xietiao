const crypto = require('crypto')
const jwt = require('jsonwebtoken')

// JWT secret: configured via CloudBase environment variable.
// NOT checked at module load — checked lazily so missing config doesn't crash cold starts.
const JWT_SECRET = process.env.JWT_SECRET || '';
const TOKEN_EXPIRES = '24h'

function getSecret() {
  const secret = process.env.JWT_SECRET || JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET not configured');
  }
  return secret;
}

function sign(payload) {
  return jwt.sign(payload, getSecret(), { expiresIn: TOKEN_EXPIRES })
}

function verify(token) {
  try {
    const secret = getSecret();
    const payload = jwt.verify(token, secret)
    return { valid: true, payload }
  } catch (err) {
    if (err.message === 'JWT_SECRET not configured') {
      return { valid: false, error: 'server config error' }
    }
    if (err.name === 'TokenExpiredError') return { valid: false, error: 'login expired' }
    return { valid: false, error: 'invalid token' }
  }
}

function requireJwt(event) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization || ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) {
    return { authorized: false, response: { statusCode: 401, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 401, msg: 'please login' }) } }
  }
  const result = verify(token)
  if (!result.valid) {
    return { authorized: false, response: { statusCode: 401, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 401, msg: result.error }) } }
  }
  return { authorized: true, user: result.payload }
}

// CORS origin: restrict to configured domain if set
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

function httpOk(data) {
  return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': CORS_ORIGIN }, body: JSON.stringify({ code: 0, data }) }
}

function httpError(code, msg, httpStatus) {
  return { statusCode: httpStatus || 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': CORS_ORIGIN }, body: JSON.stringify({ code, msg }) }
}

module.exports = { sign, verify, requireJwt, httpOk, httpError }
