const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const { requireJwt, httpOk, httpError } = require('../lib/jwtAuth')

exports.main = async (event) => {
  const auth = requireJwt(event)
  if (!auth.authorized) return auth.response
  if (auth.user.role !== 'manager') return httpError(403, '无权限', 403)

  const method = event.httpMethod
  const path = event.path || ''
  const qs = event.queryStringParameters || {}
  let body = {}
  try { body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body || {}) } catch (e) {}

  if (method === 'GET' && path === '/customers') return handleList(qs)
  if (method === 'GET' && path.startsWith('/customers/')) return handleDetail(path.split('/customers/')[1])
  if (method === 'POST' && path === '/customers') return handleCreate(body)
  if (method === 'PUT' && path === '/customers') return handleUpdate(body)
  if (method === 'GET' && path === '/customers/export') return handleExport(qs)
  if (method === 'POST' && path === '/customers/import') return handleImport(body)

  return httpError(404, 'Not Found', 404)
}

async function handleList(qs) {
  try {
    const page = parseInt(qs.page) || 1
    const pageSize = Math.min(parseInt(qs.pageSize) || 20, 100)
    const where = {}
    if (qs.keyword) {
      const kw = qs.keyword.trim()
      where.$or = [{ name: db.RegExp({ regexp: kw, options: 'i' }) }, { phone: db.RegExp({ regexp: kw, options: 'i' }) }]
    }
    const [countRes, listRes] = await Promise.all([
      db.collection('customers').where(where).count(),
      db.collection('customers').where(where).skip((page - 1) * pageSize).limit(pageSize).orderBy('createdAt', 'desc').get()
    ])
    return httpOk({ list: listRes.data, total: countRes.total, page, pageSize })
  } catch (err) { return httpError(500, '加载失败', 500) }
}

async function handleDetail(phone) {
  try {
    const [customerRes, orderRes, priceRes] = await Promise.all([
      db.collection('customers').where({ phone }).get(),
      db.collection('orders').where({ phone }).orderBy('createdAt', 'desc').limit(50).get(),
      db.collection('customerPrices').where({ customerPhone: phone }).get()
    ])
    if (!customerRes.data.length) return httpError(404, '客户不存在')
    return httpOk({ customer: customerRes.data[0], orders: orderRes.data, prices: priceRes.data })
  } catch (err) { return httpError(500, '加载失败', 500) }
}

async function handleCreate(body) {
  try {
    const { name, phone } = body
    if (!name || !phone) return httpError(400, '名称和手机号不能为空')
    const existing = await db.collection('customers').where({ phone }).count()
    if (existing.total > 0) return httpError(409, '该手机号已存在')
    const data = { name: name.trim(), phone: phone.trim(), totalOrders: 0, totalAmount: 0, debt: 0, createdAt: db.serverDate(), updatedAt: db.serverDate() }
    const res = await db.collection('customers').add({ data })
    return httpOk({ _id: res._id })
  } catch (err) { return httpError(500, '保存失败', 500) }
}

async function handleUpdate(body) {
  try {
    const { _id, name, phone } = body
    if (!_id) return httpError(400, '客户ID不能为空')
    const data = { updatedAt: db.serverDate() }
    if (name) data.name = name.trim()
    if (phone) data.phone = phone.trim()
    await db.collection('customers').doc(_id).update({ data })
    return httpOk({})
  } catch (err) { return httpError(500, '保存失败', 500) }
}

async function handleExport(qs) {
  try {
    const res = await db.collection('customers').limit(1000).orderBy('createdAt', 'desc').get()
    return httpOk({ list: res.data })
  } catch (err) { return httpError(500, '导出失败', 500) }
}

async function handleImport(body) {
  try {
    const { items } = body
    if (!items || !items.length) return httpError(400, '没有可导入的数据')
    let success = 0
    for (const item of items) {
      if (!item.name || !item.phone) continue
      try {
        await db.collection('customers').add({
          data: { name: item.name.trim(), phone: item.phone.trim(), totalOrders: 0, totalAmount: 0, debt: 0, createdAt: db.serverDate(), updatedAt: db.serverDate() }
        })
        success++
      } catch (e) { /* skip duplicates */ }
    }
    return httpOk({ success })
  } catch (err) { return httpError(500, '导入失败', 500) }
}
