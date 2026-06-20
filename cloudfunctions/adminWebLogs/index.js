const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const { requireJwt, httpOk, httpError } = require('../lib/jwtAuth')

exports.main = async (event) => {
  const auth = requireJwt(event)
  if (!auth.authorized) return auth.response
  if (auth.user.role !== 'manager') return httpError(403, '无权限', 403)

  const qs = event.queryStringParameters || {}
  const page = parseInt(qs.page) || 1
  const pageSize = Math.min(parseInt(qs.pageSize) || 20, 100)
  const where = {}
  if (qs.operator) where.operator = qs.operator
  if (qs.action) where.action = qs.action
  if (qs.startDate || qs.endDate) {
    where.createdAt = {}
    if (qs.startDate) where.createdAt = db.command.gte(new Date(qs.startDate).getTime())
    if (qs.endDate) where.createdAt = { ...where.createdAt, ...db.command.lte(new Date(qs.endDate).getTime() + 86400000) }
  }

  try {
    const [countRes, listRes] = await Promise.all([
      db.collection('operationLogs').where(where).count(),
      db.collection('operationLogs').where(where).skip((page - 1) * pageSize).limit(pageSize).orderBy('createdAt', 'desc').get()
    ])
    return httpOk({ list: listRes.data, total: countRes.total, page, pageSize })
  } catch (err) { return httpError(500, '加载失败', 500) }
}
