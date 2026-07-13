const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const { requireJwt, httpOk, httpError } = require('./jwtAuth')

exports.main = async (event) => {
  const auth = await requireJwt(event)
  if (!auth.authorized) return auth.response
  if (auth.user.role !== 'manager') return httpError(403, '无权限', 403)

  const qs = event.queryStringParameters || {}
  const range = qs.range || 'today'
  const now = Date.now()
  let rangeStart
  if (range === 'today') {
    rangeStart = new Date(); rangeStart.setHours(0, 0, 0, 0); rangeStart = rangeStart.getTime()
  } else if (range === '7days') {
    rangeStart = now - 7 * 86400000
  } else {
    rangeStart = now - 30 * 86400000
  }

  try {
    const [orderCount, productCount] = await Promise.all([
      db.collection('orders').count(),
      db.collection('products').count()
    ])
    const PAGE = 200
    const orderPages = Math.min(Math.ceil(orderCount.total / PAGE), 5)
    const productPages = Math.min(Math.ceil(productCount.total / PAGE), 5)
    const orderCalls = []; const productCalls = []
    for (let i = 0; i < orderPages; i++) orderCalls.push(db.collection('orders').skip(i * PAGE).limit(PAGE).orderBy('createdAt', 'desc').get())
    for (let i = 0; i < productPages; i++) productCalls.push(db.collection('products').skip(i * PAGE).limit(PAGE).get())
    const [orderResults, productResults] = await Promise.all([Promise.all(orderCalls), Promise.all(productCalls)])
    const allOrders = orderResults.flatMap(r => r.data)
    const allProducts = productResults.flatMap(r => r.data)

    const rangeOrders = allOrders.filter(o => {
      const t = o.createdAt ? (typeof o.createdAt === 'number' ? o.createdAt : new Date(o.createdAt).getTime()) : 0
      return t >= rangeStart
    })

    const totalOrders = rangeOrders.length
    const totalSales = rangeOrders.reduce((s, o) => s + (o.totalAmount || 0), 0)
    const pendingOrders = rangeOrders.filter(o => o.status === 'processing').length
    const unpaidAmount = allOrders.filter(o => o.payment_status === 'unpaid')
      .reduce((s, o) => s + (o.totalAmount || 0) - (o.paid_amount || 0), 0)
    const shortageCount = allProducts.filter(p => p.status === 'out' || p.status === 'low').length

    const trendDays = []
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(); dayStart.setDate(dayStart.getDate() - i); dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1)
      const dayOrders = allOrders.filter(o => {
        const t = o.createdAt ? (typeof o.createdAt === 'number' ? o.createdAt : new Date(o.createdAt).getTime()) : 0
        return t >= dayStart.getTime() && t < dayEnd.getTime()
      })
      trendDays.push({
        label: (dayStart.getMonth() + 1) + '/' + dayStart.getDate(),
        orders: dayOrders.length,
        sales: Math.round(dayOrders.reduce((s, o) => s + (o.totalAmount || 0), 0) / 100)
      })
    }

    const productSales = {}
    rangeOrders.forEach(o => { (o.items || []).forEach(item => {
      if (item.productId) productSales[item.productId] = (productSales[item.productId] || 0) + (item.price || 0) * (item.quantity || 0)
    })})

    const productMap = {}; allProducts.forEach(p => { productMap[p._id] = p })
    const categorySales = {}
    rangeOrders.forEach(o => { (o.items || []).forEach(item => {
      const cat = (productMap[item.productId] || {}).category || '未知'
      categorySales[cat] = (categorySales[cat] || 0) + (item.price || 0) * (item.quantity || 0)
    })})
    const categoryPie = Object.entries(categorySales).map(([name, value]) => ({ name, value: Math.round(value / 100) })).sort((a, b) => b.value - a.value)

    const topProducts = allProducts.map(p => ({ _id: p._id, name: p.name, category: p.category, unit: p.unit, sales: Math.round((productSales[p._id] || 0) / 100) })).sort((a, b) => b.sales - a.sales).slice(0, 10)

    const custMap = {}
    rangeOrders.forEach(o => {
      const key = o.phone || '未知'
      if (!custMap[key]) custMap[key] = { name: o.customerName || '未知', phone: key, amount: 0, orders: 0 }
      custMap[key].amount += (o.totalAmount || 0); custMap[key].orders += 1
    })
    const topCustomers = Object.values(custMap).map(c => ({ ...c, amount: Math.round(c.amount / 100) })).sort((a, b) => b.amount - a.amount).slice(0, 10)

    const shortageProducts = allProducts.filter(p => p.status === 'out' || p.status === 'low').map(p => ({
      _id: p._id, name: p.name, status: p.status, category: p.category, unit: p.unit, stock: p.stock || 0, sales: Math.round((productSales[p._id] || 0) / 100)
    })).sort((a, b) => a.status === 'out' ? -1 : 1)

    return httpOk({
      overview: { totalOrders, totalSales: Math.round(totalSales / 100), pendingOrders, unpaidAmount: Math.round(unpaidAmount / 100), shortageCount },
      trendDays, categoryPie, topProducts, topCustomers, shortageProducts
    })
  } catch (err) {
    console.error('adminGetDashboard error:', err)
    return httpError(500, '加载失败，请稍后重试', 500)
  }
}
