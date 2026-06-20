const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const { requireJwt, httpOk, httpError } = require('../lib/jwtAuth')
const { logOperation } = require('../lib/operationLog')

exports.main = async (event) => {
  const auth = requireJwt(event)
  if (!auth.authorized) return auth.response

  const method = event.httpMethod
  const path = event.path || ''
  const qs = event.queryStringParameters || {}
  let body = {}
  try { body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body || {}) } catch (e) {}

  if (method === 'GET' && path === '/orders') return handleList(auth.user, qs)
  if (method === 'GET' && path.startsWith('/orders/')) return handleDetail(path.split('/orders/')[1])
  if (method === 'PUT' && path.startsWith('/orders/')) return handleUpdate(auth.user, path.split('/orders/')[1], body)
  if (method === 'POST' && path === '/orders/batch') return handleBatch(auth.user, body)
  if (method === 'GET' && path === '/orders/export') return handleExport(auth.user, qs)

  return httpError(404, 'Not Found', 404)
}

async function handleList(user, qs) {
  try {
    const page = parseInt(qs.page) || 1
    const pageSize = Math.min(parseInt(qs.pageSize) || 20, 100)
    const where = {}
    if (qs.status) where.status = qs.status
    if (qs.payment_status) where.payment_status = qs.payment_status
    if (qs.deliveryMethod) where.deliveryMethod = qs.deliveryMethod
    if (user.role === 'delivery') where.deliveryMethod = 'delivery'
    if (user.role === 'warehouse') where.deliveryMethod = 'logistics'
    if (qs.startDate || qs.endDate) {
      where.createdAt = {}
      if (qs.startDate) where.createdAt = _.gte(new Date(qs.startDate).getTime())
      if (qs.endDate) where.createdAt = { ...where.createdAt, ..._.lte(new Date(qs.endDate).getTime() + 86400000) }
    }
    if (qs.keyword) {
      const kw = qs.keyword.trim()
      where.$or = [{ customerName: db.RegExp({ regexp: kw, options: 'i' }) }, { phone: db.RegExp({ regexp: kw, options: 'i' }) }]
    }
    const [countRes, listRes] = await Promise.all([
      db.collection('orders').where(where).count(),
      db.collection('orders').where(where).skip((page - 1) * pageSize).limit(pageSize).orderBy('createdAt', 'desc').get()
    ])
    const list = listRes.data.map(o => ({
      _id: o._id, customerName: o.customerName, phone: o.phone, address: o.address,
      itemsSummary: (o.items || []).map(i => i.name + '×' + i.quantity).join('、'),
      totalAmount: o.totalAmount, discount: o.discount, deliveryMethod: o.deliveryMethod,
      status: o.status, payment_status: o.payment_status, paid_amount: o.paid_amount || 0,
      pickedUp: o.pickedUp || false, remark: o.remark, returnRequest: o.returnRequest, createdAt: o.createdAt,
      images: o.images || []
    }))
    return httpOk({ list, total: countRes.total, page, pageSize })
  } catch (err) { console.error('orders.list:', err); return httpError(500, '加载失败', 500) }
}

async function handleDetail(orderId) {
  try {
    const res = await db.collection('orders').doc(orderId).get()
    if (!res.data) return httpError(404, '订单不存在')
    return httpOk({ record: res.data })
  } catch (err) { console.error('orders.detail:', err); return httpError(500, '加载失败', 500) }
}

async function handleUpdate(user, orderId, body) {
  try {
    const order = await db.collection('orders').doc(orderId).get()
    if (!order.data) return httpError(404, '订单不存在')
    const updateData = { updatedAt: db.serverDate() }
    let logAction = '', logDetail = ''

    if (body.status) { updateData.status = body.status; logAction = 'order.status'; logDetail = `订单状态改为${body.status === 'completed' ? '已完成' : body.status === 'cancelled' ? '已取消' : body.status}` }
    if (body.payment_status) { updateData.payment_status = body.payment_status; if (body.payment_status === 'paid') updateData.paid_amount = order.data.totalAmount }
    if (body.totalAmount !== undefined) { updateData.totalAmount = body.totalAmount; if (!logAction) { logAction = 'order.price'; logDetail = `金额改为${(body.totalAmount / 100).toFixed(2)}元` } }
    if (body.pickedUp !== undefined) updateData.pickedUp = body.pickedUp
    if (body.remark !== undefined) updateData.remark = body.remark
    if (body.returnRequest) updateData.returnRequest = body.returnRequest

    await db.collection('orders').doc(orderId).update({ data: updateData })
    if (logAction) await logOperation(db, user.username, logAction, `订单${orderId}`, logDetail)
    return httpOk({})
  } catch (err) { console.error('orders.update:', err); return httpError(500, '操作失败', 500) }
}

async function handleBatch(user, body) {
  try {
    const { ids, action } = body
    if (!ids || !ids.length) return httpError(400, '请选择订单')
    const updateData = { updatedAt: db.serverDate() }
    let logDetail = ''
    if (action === 'complete') { updateData.status = 'completed'; logDetail = `批量完成${ids.length}个订单` }
    else if (action === 'cancel') { updateData.status = 'cancelled'; logDetail = `批量取消${ids.length}个订单` }
    else return httpError(400, '不支持的操作类型')
    await db.collection('orders').where({ _id: _.in(ids) }).update({ data: updateData })
    await logOperation(db, user.username, 'order.status', `批量(${ids.length}单)`, logDetail)
    return httpOk({ affected: ids.length })
  } catch (err) { console.error('orders.batch:', err); return httpError(500, '批量操作失败', 500) }
}

async function handleExport(user, qs) {
  try {
    const where = {}
    if (qs.status) where.status = qs.status
    if (qs.deliveryMethod) where.deliveryMethod = qs.deliveryMethod
    if (user.role === 'delivery') where.deliveryMethod = 'delivery'
    if (user.role === 'warehouse') where.deliveryMethod = 'logistics'
    if (qs.keyword) { const kw = qs.keyword.trim(); where.$or = [{ customerName: db.RegExp({ regexp: kw, options: 'i' }) }, { phone: db.RegExp({ regexp: kw, options: 'i' }) }] }
    const res = await db.collection('orders').where(where).limit(1000).orderBy('createdAt', 'desc').get()
    return httpOk({ list: res.data })
  } catch (err) { console.error('orders.export:', err); return httpError(500, '导出失败', 500) }
}
