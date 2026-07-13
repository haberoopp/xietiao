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

  if (method === 'GET' && path === '/prices') return handleList(qs)
  if (method === 'POST' && path === '/prices') return handleSet(auth.user, body)
  if (method === 'POST' && path === '/prices/batch') return handleBatch(auth.user, body)
  if (method === 'POST' && path === '/prices/import') return handleImport(auth.user, body)
  if (method === 'GET' && path === '/prices/grouped') return handleGroupedList(qs)
  if (method === 'POST' && path === '/prices/category') return handleCategoryPricing(auth.user, body)

  return httpError(404, 'Not Found', 404)
}

async function handleList(qs) {
  try {
    const page = parseInt(qs.page) || 1
    const pageSize = Math.min(parseInt(qs.pageSize) || 50, 100)
    const where = {}
    if (qs.customerPhone) where.customerPhone = qs.customerPhone
    if (qs.keyword) {
      const kw = security.escapeRegex(qs.keyword.trim())
      if (qs.customerPhone) where.productName = db.RegExp({ regexp: kw, options: 'i' })
      else {
        where.$or = [{ customerPhone: db.RegExp({ regexp: kw, options: 'i' }) }, { productName: db.RegExp({ regexp: kw, options: 'i' }) }]
      }
    }
    const [countRes, listRes] = await Promise.all([
      db.collection('customerPrices').where(where).count(),
      db.collection('customerPrices').where(where).skip((page - 1) * pageSize).limit(pageSize).orderBy('createdAt', 'desc').get()
    ])
    // 查询客户名称
    const phones = [...new Set(listRes.data.map(p => p.customerPhone).filter(Boolean))]
    const customerMap = {}
    if (phones.length > 0) {
      const batchSize = 100
      for (let i = 0; i < phones.length; i += batchSize) {
        const batch = phones.slice(i, i + batchSize)
        const custRes = await db.collection('customers').where({ phone: _.in(batch) }).field({ phone: true, name: true }).get()
        custRes.data.forEach(c => { customerMap[c.phone] = c.name || '' })
      }
    }
    const list = listRes.data.map(p => ({ ...p, customerName: customerMap[p.customerPhone] || '' }))
    return httpOk({ list, total: countRes.total, page, pageSize })
  } catch (err) { return httpError(500, '加载失败', 500) }
}

async function handleSet(user, body) {
  try {
    const { customerPhone, productId, productName, customPrice } = body
    if (!customerPhone || !productId) return httpError(400, '客户和产品不能为空')
    if (customPrice === undefined || customPrice < 0) return httpError(400, '价格无效')

    const old = await db.collection('customerPrices').where({ customerPhone, productId }).get()
    if (old.data.length > 0 && old.data[0].customPrice !== Math.round(parseFloat(customPrice) * 100)) {
      await db.collection('priceHistory').add({
        data: { customerPhone, productId, oldPrice: old.data[0].customPrice, newPrice: Math.round(parseFloat(customPrice) * 100), operator: user.username, createdAt: db.serverDate() }
      })
    }
    const priceInCents = Math.round(parseFloat(customPrice) * 100)
    if (old.data.length > 0) {
      await db.collection('customerPrices').doc(old.data[0]._id).update({ data: { customPrice: priceInCents, updatedAt: db.serverDate() } })
    } else {
      await db.collection('customerPrices').add({ data: { customerPhone, productId, productName: productName || '', customPrice: priceInCents, createdAt: db.serverDate(), updatedAt: db.serverDate() } })
    }
    await logOperation(db, user.username, 'pricing.set', `${customerPhone}/${productName || productId}`, `专属价设为${customPrice}元`)
    return httpOk({})
  } catch (err) { return httpError(500, '保存失败', 500) }
}

async function handleBatch(user, body) {
  try {
    const { action, entries } = body
    if (!entries || !entries.length) return httpError(400, '请选择条目')
    if (action === 'delete') {
      // 并行批量删除，每批10个并发
      const DEL_BATCH = 10
      for (let i = 0; i < entries.length; i += DEL_BATCH) {
        const batch = entries.slice(i, i + DEL_BATCH)
        await Promise.all(batch.map(async (e) => {
          const old = await db.collection('customerPrices').where({ customerPhone: e.customerPhone, productId: e.productId }).get()
          if (old.data.length > 0) await db.collection('customerPrices').doc(old.data[0]._id).remove()
        }))
      }
      await logOperation(db, user.username, 'pricing.set', '批量', `删除${entries.length}条定价`)
      return httpOk({ affected: entries.length })
    }
    if (action === 'set') {
      const SET_BATCH = 10
      for (let i = 0; i < entries.length; i += SET_BATCH) {
        const batch = entries.slice(i, i + SET_BATCH)
        await Promise.all(batch.map(async (e) => {
          if (!e.customerPhone || !e.productId) return
          const old = await db.collection('customerPrices').where({ customerPhone: e.customerPhone, productId: e.productId }).get()
          const priceInCents = Math.round(parseFloat(e.customPrice) * 100)
          if (old.data.length > 0) {
            await db.collection('customerPrices').doc(old.data[0]._id).update({ data: { customPrice: priceInCents, updatedAt: db.serverDate() } })
          } else {
            await db.collection('customerPrices').add({ data: { customerPhone: e.customerPhone, productId: e.productId, productName: e.productName || '', customPrice: priceInCents, createdAt: db.serverDate(), updatedAt: db.serverDate() } })
          }
        }))
      }
      await logOperation(db, user.username, 'pricing.set', '批量', `设置${entries.length}条定价`)
      return httpOk({ affected: entries.length })
    }
    return httpError(400, '不支持的操作类型')
  } catch (err) { return httpError(500, '批量操作失败', 500) }
}

async function handleCategoryPricing(user, body) {
  try {
    const { customerPhone, category, customPrice } = body
    if (!customerPhone || !category) return httpError(400, '客户和分类不能为空')
    if (customPrice === undefined || customPrice < 0) return httpError(400, '价格无效')

    const productsRes = await db.collection('products')
      .where({ category })
      .field({ _id: true, name: true, category: true })
      .limit(500)
      .get()

    if (!productsRes.data.length) return httpError(404, `分类「${category}」下没有产品`)

    const priceInCents = Math.round(parseFloat(customPrice) * 100)
    const productIds = productsRes.data.map(p => p._id)

    // 批量预查已有定价，避免逐条查询
    const existingMap = {}
    const BATCH_QUERY_SIZE = 100
    for (let i = 0; i < productIds.length; i += BATCH_QUERY_SIZE) {
      const batch = productIds.slice(i, i + BATCH_QUERY_SIZE)
      const existingRes = await db.collection('customerPrices')
        .where({ customerPhone, productId: _.in(batch) })
        .get()
      existingRes.data.forEach(p => { existingMap[p.productId] = p })
    }

    // 并行批量处理（每批10个并发，避免云函数过载）
    let created = 0, updated = 0
    const PARALLEL_SIZE = 10
    for (let i = 0; i < productsRes.data.length; i += PARALLEL_SIZE) {
      const batch = productsRes.data.slice(i, i + PARALLEL_SIZE)
      const results = await Promise.all(batch.map(async (product) => {
        const existing = existingMap[product._id]
        if (existing) {
          if (existing.customPrice !== priceInCents) {
            await db.collection('priceHistory').add({
              data: {
                customerPhone, productId: product._id,
                oldPrice: existing.customPrice, newPrice: priceInCents,
                operator: user.username, createdAt: db.serverDate()
              }
            })
            await db.collection('customerPrices').doc(existing._id).update({
              data: { customPrice: priceInCents, updatedAt: db.serverDate() }
            })
            return 'updated'
          }
          return 'skipped'
        } else {
          await db.collection('customerPrices').add({
            data: {
              customerPhone, productId: product._id,
              productName: product.name,
              customPrice: priceInCents,
              createdAt: db.serverDate(), updatedAt: db.serverDate()
            }
          })
          return 'created'
        }
      }))
      results.forEach(r => {
        if (r === 'created') created++
        else if (r === 'updated') updated++
      })
    }

    await logOperation(db, user.username, 'pricing.set',
      `分类批量/${customerPhone}`,
      `${category}分类下${productsRes.data.length}个产品，新建${created}条，更新${updated}条，价格${customPrice}元`
    )

    return httpOk({ category, productCount: productsRes.data.length, created, updated })
  } catch (err) { console.error('prices.categoryPricing:', err); return httpError(500, '设置分类定价失败', 500) }
}

async function handleGroupedList(qs) {
  try {
    const page = parseInt(qs.page) || 1
    const pageSize = Math.min(parseInt(qs.pageSize) || 20, 50)
    const match = {}
    if (qs.keyword) {
      const kw = security.escapeRegex(qs.keyword.trim())
      match.$or = [
        { customerPhone: db.RegExp({ regexp: kw, options: 'i' }) },
        { productName: db.RegExp({ regexp: kw, options: 'i' }) }
      ]
    }

    const allRes = await db.collection('customerPrices')
      .where(Object.keys(match).length ? match : {})
      .orderBy('createdAt', 'desc')
      .limit(2000)
      .get()

    // Group by customerPhone
    const grouped = {}
    for (const p of allRes.data) {
      if (!grouped[p.customerPhone]) {
        grouped[p.customerPhone] = { customerPhone: p.customerPhone, products: [] }
      }
      grouped[p.customerPhone].products.push({
        productId: p.productId,
        productName: p.productName,
        customPrice: p.customPrice,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt
      })
    }

    const customerPhones = Object.keys(grouped)

    // Batch fetch customer names
    const customerMap = {}
    if (customerPhones.length > 0) {
      const batchSize = 100
      for (let i = 0; i < customerPhones.length; i += batchSize) {
        const batch = customerPhones.slice(i, i + batchSize)
        const custRes = await db.collection('customers')
          .where({ phone: _.in(batch) })
          .field({ phone: true, name: true })
          .get()
        custRes.data.forEach(c => { customerMap[c.phone] = c.name || '' })
      }
    }

    const fullList = customerPhones.map(phone => ({
      customerPhone: phone,
      customerName: customerMap[phone] || '',
      productCount: grouped[phone].products.length,
      products: grouped[phone].products
    }))

    const total = fullList.length
    const start = (page - 1) * pageSize
    const list = fullList.slice(start, start + pageSize)

    return httpOk({ list, total, page, pageSize })
  } catch (err) { console.error('prices.groupedList:', err); return httpError(500, '加载失败', 500) }
}

async function handleImport(user, body) {
  try {
    const { items } = body
    if (!items || !items.length) return httpError(400, '没有可导入的数据')
    let success = 0
    for (const item of items) {
      if (!item.customerPhone || !item.productId) continue
      const old = await db.collection('customerPrices').where({ customerPhone: item.customerPhone, productId: item.productId }).get()
      const priceInCents = Math.round(parseFloat(item.customPrice) * 100)
      if (old.data.length > 0) {
        await db.collection('customerPrices').doc(old.data[0]._id).update({ data: { customPrice: priceInCents, updatedAt: db.serverDate() } })
      } else {
        await db.collection('customerPrices').add({ data: { customerPhone: item.customerPhone, productId: item.productId, productName: item.productName || '', customPrice: priceInCents, createdAt: db.serverDate(), updatedAt: db.serverDate() } })
      }
      success++
    }
    await logOperation(db, user.username, 'pricing.set', '批量导入', `导入${success}条定价`)
    return httpOk({ success })
  } catch (err) { return httpError(500, '导入失败', 500) }
}
