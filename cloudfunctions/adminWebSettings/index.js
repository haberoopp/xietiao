const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const { requireJwt, httpOk, httpError } = require('../lib/jwtAuth')

exports.main = async (event) => {
  const auth = requireJwt(event)
  if (!auth.authorized) return auth.response
  if (auth.user.role !== 'manager') return httpError(403, '无权限', 403)

  const method = event.httpMethod
  const path = event.path || ''
  let body = {}
  try { body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body || {}) } catch (e) {}

  if (method === 'GET' && path === '/settings') return handleGetCategories()
  if (method === 'PUT' && path === '/settings') return handleUpdateCategories(body)
  return httpError(404, 'Not Found', 404)
}

async function handleGetCategories() {
  try {
    const res = await db.collection('products').field({ category: true }).limit(1000).get()
    const countMap = {}
    res.data.forEach(p => { const c = p.category || '其他'; countMap[c] = (countMap[c] || 0) + 1 })
    return httpOk({ categories: Object.entries(countMap).map(([name, count]) => ({ name, count })) })
  } catch (err) { return httpError(500, '加载失败', 500) }
}

async function handleUpdateCategories(body) {
  try {
    const { oldName, newName } = body
    if (!oldName || !newName) return httpError(400, '分类名不能为空')
    if (oldName === newName) return httpOk({})
    await db.collection('products').where({ category: oldName }).update({ data: { category: newName, updatedAt: db.serverDate() } })
    return httpOk({})
  } catch (err) { return httpError(500, '更新失败', 500) }
}
