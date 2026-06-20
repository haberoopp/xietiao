const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const { requireJwt, httpOk, httpError } = require('../lib/jwtAuth')
const { logOperation } = require('../lib/operationLog')

exports.main = async (event) => {
  const auth = requireJwt(event)
  if (!auth.authorized) return auth.response
  if (auth.user.role !== 'manager') return httpError(403, '无权限', 403)

  const method = event.httpMethod
  const path = event.path || ''
  const qs = event.queryStringParameters || {}
  let body = {}
  try { body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body || {}) } catch (e) {}

  if (method === 'GET' && path === '/finance') return handleOverview(qs)
  if (method === 'POST' && path === '/finance/payment') return handlePayment(auth.user, body)
  if (method === 'GET' && path === '/finance/payments') return handlePaymentHistory(qs)

  return httpError(404, 'Not Found', 404)
}

async function handleOverview(qs) {
  try {
    const page = parseInt(qs.page) || 1
    const pageSize = Math.min(parseInt(qs.pageSize) || 20, 100)
    const where = { payment_status: 'unpaid', status: _.neq('cancelled') }
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
      unpaidOrders: allUnpaid.map(o => ({ _id: o._id, customerName: o.customerName, phone: o.phone, totalAmount: o.totalAmount, paid_amount: o.paid_amount || 0, unpaid: (o.totalAmount || 0) - (o.paid_amount || 0), createdAt: o.createdAt })),
      total: countRes.total, page, pageSize, monthlyStats
    })
  } catch (err) { return httpError(500, '加载失败', 500) }
}

async function handlePayment(user, body) {
  try {
    const { orderId, amount } = body
    if (!orderId || amount === undefined || amount <= 0) return httpError(400, '请输入有效的收款金额')
    const amountInCents = Math.round(parseFloat(amount) * 100)
    const order = await db.collection('orders').doc(orderId).get()
    if (!order.data) return httpError(404, '订单不存在')

    const newPaid = (order.data.paid_amount || 0) + amountInCents
    const paymentStatus = newPaid >= (order.data.totalAmount || 0) ? 'paid' : 'unpaid'

    await db.collection('orders').doc(orderId).update({
      data: { paid_amount: newPaid, payment_status: paymentStatus, updatedAt: db.serverDate() }
    })
    await logOperation(db, user.username, 'payment.record', `订单${orderId}`, `收款${amount}元，累计${(newPaid / 100).toFixed(2)}元`)
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
