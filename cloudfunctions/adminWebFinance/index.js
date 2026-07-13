const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const { requireJwt, httpOk, httpError } = require('./jwtAuth')
const { logOperation } = require('./operationLog')
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

  if (method === 'GET' && path === '/finance') return handleOverview(qs)
  if (method === 'GET' && path === '/finance/grouped') return handleGroupedOverview(qs)
  if (method === 'POST' && path === '/finance/payment') return handlePayment(auth.user, body)
  if (method === 'GET' && path === '/finance/payments') return handlePaymentHistory(qs)

  return httpError(404, 'Not Found', 404)
}

async function handleOverview(qs) {
  try {
    const page = parseInt(qs.page) || 1
    const pageSize = Math.min(parseInt(qs.pageSize) || 20, 100)
    const where = { payment_status: 'unpaid', status: _.neq('cancelled') }
    // 客户搜索
    if (qs.keyword) {
      const kw = security.escapeRegex(qs.keyword.trim())
      where.$or = [
        { customerName: db.RegExp({ regexp: kw, options: 'i' }) },
        { phone: db.RegExp({ regexp: kw, options: 'i' }) }
      ]
    }
    // 时间范围搜索
    if (qs.startDate || qs.endDate) {
      if (qs.startDate && qs.endDate) {
        where.createdAt = _.gte(new Date(qs.startDate).getTime()).and(_.lte(new Date(qs.endDate).getTime() + 86400000))
      } else if (qs.startDate) {
        where.createdAt = _.gte(new Date(qs.startDate).getTime())
      } else {
        where.createdAt = _.lte(new Date(qs.endDate).getTime() + 86400000)
      }
    }
    const [countRes, listRes] = await Promise.all([
      db.collection('orders').where(where).count(),
      db.collection('orders').where(where).skip((page - 1) * pageSize).limit(pageSize).orderBy('createdAt', 'desc').get()
    ])
    const allUnpaid = listRes.data
    const totalReceivable = allUnpaid.reduce((s, o) => s + (o.totalAmount || 0), 0)
    const totalPaid = allUnpaid.reduce((s, o) => s + (o.paid_amount || 0), 0)
    const totalUnpaid = totalReceivable - totalPaid

    // Monthly stats: aggregate from orders
    const allPaidOrders = await db.collection('orders').where({ payment_status: 'paid' }).limit(500).orderBy('createdAt', 'desc').get()
    const monthStats = {}
    allPaidOrders.data.forEach(o => {
      const d = new Date(o.createdAt)
      const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
      monthStats[key] = (monthStats[key] || 0) + (o.totalAmount || 0)
    })
    const monthlyStats = Object.entries(monthStats).map(([month, amount]) => ({ month, amount: Math.round(amount / 100) })).sort((a, b) => a.month.localeCompare(b.month)).slice(-12)

    return httpOk({
      summary: { totalReceivable: Math.round(totalReceivable / 100), totalPaid: Math.round(totalPaid / 100), totalUnpaid: Math.round(totalUnpaid / 100), overdueCount: allUnpaid.length },
      unpaidOrders: allUnpaid.map(o => ({ _id: o._id, customerName: o.customerName, phone: o.phone, totalAmount: o.totalAmount, paid_amount: o.paid_amount || 0, unpaid: (o.totalAmount || 0) - (o.paid_amount || 0), createdAt: o.createdAt, deliveryMethod: o.deliveryMethod, status: o.status })),
      total: countRes.total, page, pageSize, monthlyStats
    })
  } catch (err) { return httpError(500, '加载失败', 500) }
}

async function handleGroupedOverview(qs) {
  try {
    const page = parseInt(qs.page) || 1
    const pageSize = Math.min(parseInt(qs.pageSize) || 20, 50)
    const where = { status: _.neq('cancelled'), payment_status: 'unpaid' }
    if (qs.keyword) {
      const kw = security.escapeRegex(qs.keyword.trim())
      where.$or = [
        { customerName: db.RegExp({ regexp: kw, options: 'i' }) },
        { phone: db.RegExp({ regexp: kw, options: 'i' }) }
      ]
    }
    if (qs.startDate || qs.endDate) {
      if (qs.startDate && qs.endDate) {
        where.createdAt = _.gte(new Date(qs.startDate).getTime()).and(_.lte(new Date(qs.endDate).getTime() + 86400000))
      } else if (qs.startDate) {
        where.createdAt = _.gte(new Date(qs.startDate).getTime())
      } else {
        where.createdAt = _.lte(new Date(qs.endDate).getTime() + 86400000)
      }
    }

    const allRes = await db.collection('orders')
      .where(where)
      .orderBy('createdAt', 'desc')
      .limit(2000)
      .get()

    // Group by phone
    const grouped = {}
    for (const o of allRes.data) {
      const phone = o.phone || '未知'
      if (!grouped[phone]) {
        grouped[phone] = {
          customerPhone: phone,
          customerName: o.customerName || '',
          totalReceivable: 0,
          totalPaid: 0,
          totalUnpaid: 0,
          orders: []
        }
      }
      const totalAmount = o.totalAmount || 0
      const paidAmount = o.paid_amount || 0
      const unpaid = totalAmount - paidAmount
      grouped[phone].totalReceivable += totalAmount
      grouped[phone].totalPaid += paidAmount
      grouped[phone].totalUnpaid += unpaid
      grouped[phone].orders.push({
        _id: o._id,
        totalAmount: totalAmount,
        paid_amount: paidAmount,
        unpaid: unpaid,
        createdAt: o.createdAt,
        status: o.status,
        deliveryMethod: o.deliveryMethod,
        itemsSummary: (o.items || []).map(i => i.name + '×' + i.quantity).join('、')
      })
    }

    const fullList = Object.values(grouped).map(g => ({
      ...g,
      totalReceivable: Math.round(g.totalReceivable / 100),
      totalPaid: Math.round(g.totalPaid / 100),
      totalUnpaid: Math.round(g.totalUnpaid / 100),
      orderCount: g.orders.length
    }))

    // Summary cards
    const totalReceivable = fullList.reduce((s, g) => s + g.totalReceivable, 0)
    const totalPaid = fullList.reduce((s, g) => s + g.totalPaid, 0)
    const totalUnpaid = fullList.reduce((s, g) => s + g.totalUnpaid, 0)
    const overdueCount = fullList.length

    const total = fullList.length
    const start = (page - 1) * pageSize
    const list = fullList.slice(start, start + pageSize)

    // Monthly stats (same as overview)
    const allPaidOrders = await db.collection('orders').where({ payment_status: 'paid' }).limit(500).orderBy('createdAt', 'desc').get()
    const monthStats = {}
    allPaidOrders.data.forEach(o => {
      const d = new Date(o.createdAt)
      const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
      monthStats[key] = (monthStats[key] || 0) + (o.totalAmount || 0)
    })
    const monthlyStats = Object.entries(monthStats).map(([month, amount]) => ({ month, amount: Math.round(amount / 100) })).sort((a, b) => a.month.localeCompare(b.month)).slice(-12)

    return httpOk({
      summary: { totalReceivable, totalPaid, totalUnpaid, overdueCount },
      list, total, page, pageSize, monthlyStats
    })
  } catch (err) { console.error('finance.groupedOverview:', err); return httpError(500, '加载失败', 500) }
}

async function handlePayment(user, body) {
  try {
    const { orderId, amount } = body
    if (!orderId || amount === undefined || amount <= 0) return httpError(400, '请输入有效的收款金额')
    const amountInCents = Math.round(parseFloat(amount) * 100)
    const order = await db.collection('orders').doc(orderId).get()
    if (!order.data) return httpError(404, '订单不存在')

    // 使用原子递增避免并发竞态（不再读-算-写）
    await db.collection('orders').doc(orderId).update({
      data: { paid_amount: _.inc(amountInCents), updatedAt: db.serverDate() }
    })

    // 读取递增后的值，同步 payment_status
    const updatedOrder = await db.collection('orders').doc(orderId).get()
    const newPaid = updatedOrder.data.paid_amount || 0
    const paymentStatus = newPaid >= (updatedOrder.data.totalAmount || 0) ? 'paid' : 'unpaid'

    if (updatedOrder.data.payment_status !== paymentStatus) {
      await db.collection('orders').doc(orderId).update({
        data: { payment_status: paymentStatus, updatedAt: db.serverDate() }
      })
    }

    await logOperation(db, user.username, 'payment.record', `「${order.data.customerName||'顾客'}」订单${orderId.slice(-8)}`, `收款${amount}元，累计${(newPaid / 100).toFixed(2)}元`)
    return httpOk({ paid_amount: newPaid, payment_status: paymentStatus })
  } catch (err) { return httpError(500, '收款失败', 500) }
}

async function handlePaymentHistory(qs) {
  try {
    const page = parseInt(qs.page) || 1
    const pageSize = Math.min(parseInt(qs.pageSize) || 20, 100)
    const where = { action: 'payment.record' }
    const [countRes, listRes] = await Promise.all([
      db.collection('operationLogs').where(where).count(),
      db.collection('operationLogs').where(where).skip((page - 1) * pageSize).limit(pageSize).orderBy('createdAt', 'desc').get()
    ])
    return httpOk({ list: listRes.data, total: countRes.total, page, pageSize })
  } catch (err) { return httpError(500, '加载失败', 500) }
}
