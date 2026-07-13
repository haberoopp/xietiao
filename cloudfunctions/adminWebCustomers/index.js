const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const { requireJwt, httpOk, httpError } = require('./jwtAuth')
const security = require('./security')

exports.main = async (event) => {
  const auth = await requireJwt(event)
  if (!auth.authorized) return auth.response
  if (auth.user.role !== 'manager') return httpError(403, '无权限', 403)

  const method = event.httpMethod
  const path = (event.path || '').replace('/api/admin', '')
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
      const kw = security.escapeRegex(qs.keyword.trim())
      where.$or = [{ name: db.RegExp({ regexp: kw, options: 'i' }) }, { phone: db.RegExp({ regexp: kw, options: 'i' }) }]
    }
    // 拉取全部匹配记录（限制2000条），过滤空记录后再分页
    const allRes = await db.collection('customers')
      .where(where)
      .orderBy('createdAt', 'desc')
      .limit(2000)
      .get()
    // 过滤掉仅登录未下单的空记录（无名称且无手机号）
    const validCustomers = allRes.data.filter(c => c.name || c.phone)
    const total = validCustomers.length
    const start = (page - 1) * pageSize
    const pagedList = validCustomers.slice(start, start + pageSize)
    // 实时计算欠款和累计消费
    const phones = pagedList.map(c => c.phone).filter(Boolean)
    const statsMap = {}
    if (phones.length > 0) {
      const BATCH = 100
      for (let i = 0; i < phones.length; i += BATCH) {
        const batch = phones.slice(i, i + BATCH)
        const orderRes = await db.collection('orders')
          .where({ phone: _.in(batch), status: _.neq('cancelled') })
          .field({ phone: true, totalAmount: true, paid_amount: true, payment_status: true })
          .limit(2000).get()
        orderRes.data.forEach(o => {
          if (!statsMap[o.phone]) statsMap[o.phone] = { totalAmount: 0, debt: 0, totalOrders: 0 }
          statsMap[o.phone].totalAmount += (o.totalAmount || 0)
          statsMap[o.phone].totalOrders += 1
          const unpaid = (o.totalAmount || 0) - (o.paid_amount || 0)
          if (unpaid > 0 && o.payment_status !== 'paid') {
            statsMap[o.phone].debt += unpaid
          }
        })
      }
    }
    const list = pagedList.map(c => ({
      ...c,
      totalAmount: statsMap[c.phone] ? statsMap[c.phone].totalAmount : (c.totalAmount || 0),
      totalOrders: statsMap[c.phone] ? statsMap[c.phone].totalOrders : (c.totalOrders || 0),
      debt: statsMap[c.phone] ? statsMap[c.phone].debt : 0
    }))
    return httpOk({ list, total, page, pageSize })
  } catch (err) { console.error('customers.list:', err); return httpError(500, '加载失败', 500) }
}

async function handleDetail(phone) {
  try {
    const [customerRes, orderRes, priceRes] = await Promise.all([
      db.collection('customers').where({ phone }).get(),
      db.collection('orders').where({ phone }).orderBy('createdAt', 'desc').limit(50).get(),
      db.collection('customerPrices').where({ customerPhone: phone }).get()
    ])
    if (!customerRes.data.length) return httpError(404, '客户不存在')
    const customer = customerRes.data[0]
    // 实时计算客户统计
    const allOrders = await db.collection('orders')
      .where({ phone, status: _.neq('cancelled') })
      .field({ totalAmount: true, paid_amount: true, payment_status: true })
      .limit(2000).get()
    let totalAmount = 0, debt = 0, totalOrders = 0
    allOrders.data.forEach(o => {
      totalAmount += (o.totalAmount || 0)
      totalOrders += 1
      const unpaid = (o.totalAmount || 0) - (o.paid_amount || 0)
      if (unpaid > 0 && o.payment_status !== 'paid') debt += unpaid
    })
    return httpOk({
      customer: { ...customer, totalAmount, totalOrders, debt },
      orders: orderRes.data,
      prices: priceRes.data
    })
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
    const { _id, name, phone, deleted } = body
    if (!_id) return httpError(400, '客户ID不能为空')

    if (deleted) {
      await db.collection('customers').doc(_id).remove()
      return httpOk({})
    }

    const data = { updatedAt: db.serverDate() }
    if (name) data.name = name.trim()
    if (phone) data.phone = phone.trim()
    await db.collection('customers').doc(_id).update({ data })
    return httpOk({})
  } catch (err) { return httpError(500, '保存失败', 500) }
}

async function handleExport(qs) {
  try {
    const res = await db.collection('customers').limit(2000).orderBy('createdAt', 'desc').get()
    // 过滤掉仅登录未下单的空记录
    const validCustomers = res.data.filter(c => c.name || c.phone)
    return httpOk({ list: validCustomers })
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
