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

  if (method === 'GET' && path === '/prices') return handleList(qs)
  if (method === 'POST' && path === '/prices') return handleSet(auth.user, body)
  if (method === 'POST' && path === '/prices/batch') return handleBatch(auth.user, body)
  if (method === 'POST' && path === '/prices/import') return handleImport(auth.user, body)

  return httpError(404, 'Not Found', 404)
}

async function handleList(qs) {
  try {
    const page = parseInt(qs.page) || 1
    const pageSize = Math.min(parseInt(qs.pageSize) || 50, 100)
    const where = {}
    if (qs.customerPhone) where.customerPhone = qs.customerPhone
    if (qs.keyword) {
      const kw = qs.keyword.trim()
      if (qs.customerPhone) where.productName = db.RegExp({ regexp: kw, options: 'i' })
      else {
        where.$or = [{ customerPhone: db.RegExp({ regexp: kw, options: 'i' }) }, { productName: db.RegExp({ regexp: kw, options: 'i' }) }]
      }
    }
    const [countRes, listRes] = await Promise.all([
      db.collection('customerPrices').where(where).count(),
      db.collection('customerPrices').where(where).skip((page - 1) * pageSize).limit(pageSize).orderBy('createdAt', 'desc').get()
    ])
    return httpOk({ list: listRes.data, total: countRes.total, page, pageSize })
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
      for (const e of entries) {
        const old = await db.collection('customerPrices').where({ customerPhone: e.customerPhone, productId: e.productId }).get()
        if (old.data.length > 0) await db.collection('customerPrices').doc(old.data[0]._id).remove()
      }
      await logOperation(db, user.username, 'pricing.set', '批量', `删除${entries.length}条定价`)
      return httpOk({ affected: entries.length })
    }
    if (action === 'set') {
      for (const e of entries) {
        if (!e.customerPhone || !e.productId) continue
        const old = await db.collection('customerPrices').where({ customerPhone: e.customerPhone, productId: e.productId }).get()
        const priceInCents = Math.round(parseFloat(e.customPrice) * 100)
        if (old.data.length > 0) {
          await db.collection('customerPrices').doc(old.data[0]._id).update({ data: { customPrice: priceInCents, updatedAt: db.serverDate() } })
        } else {
          await db.collection('customerPrices').add({ data: { customerPhone: e.customerPhone, productId: e.productId, productName: e.productName || '', customPrice: priceInCents, createdAt: db.serverDate(), updatedAt: db.serverDate() } })
        }
      }
      await logOperation(db, user.username, 'pricing.set', '批量', `设置${entries.length}条定价`)
      return httpOk({ affected: entries.length })
    }
    return httpError(400, '不支持的操作类型')
  } catch (err) { return httpError(500, '批量操作失败', 500) }
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
