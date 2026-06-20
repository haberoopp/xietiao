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

  if (method === 'GET' && path === '/products') return handleList(qs)
  if (method === 'POST' && path === '/products') return handleCreate(auth.user, body)
  if (method === 'PUT' && path === '/products') return handleUpdate(auth.user, body)
  if (method === 'POST' && path === '/products/batch') return handleBatch(auth.user, body)
  if (method === 'GET' && path === '/products/export') return handleExport(qs)
  if (method === 'POST' && path === '/products/import') return handleImport(auth.user, body)

  return httpError(404, 'Not Found', 404)
}

async function handleList(qs) {
  try {
    const page = parseInt(qs.page) || 1
    const pageSize = Math.min(parseInt(qs.pageSize) || 20, 100)
    const where = {}
    if (qs.category) where.category = qs.category
    if (qs.status) where.status = qs.status
    if (qs.keyword) {
      const kw = qs.keyword.trim()
      where.$or = [{ name: db.RegExp({ regexp: kw, options: 'i' }) }, { category: db.RegExp({ regexp: kw, options: 'i' }) }]
    }
    const [countRes, listRes] = await Promise.all([
      db.collection('products').where(where).count(),
      db.collection('products').where(where).skip((page - 1) * pageSize).limit(pageSize).orderBy('name', 'asc').get()
    ])
    return httpOk({ list: listRes.data, total: countRes.total, page, pageSize })
  } catch (err) { console.error('products.list:', err); return httpError(500, '加载失败', 500) }
}

async function handleCreate(user, body) {
  try {
    const { name, category, price, unit, stock, description, images, status } = body
    if (!name || !category || price === undefined) return httpError(400, '名称、分类和价格不能为空')
    const data = {
      name: name.trim(), category, price: Math.round(parseFloat(price) * 100),
      unit: unit || '米', stock: parseInt(stock) || 0, status: status || 'sufficient',
      description: description || '', createdAt: db.serverDate(), updatedAt: db.serverDate()
    }
    if (images && images.length) { data.images = images; data.image = images[0] }
    else if (body.image) { data.image = body.image }
    const res = await db.collection('products').add({ data })
    await logOperation(db, user.username, 'product.create', name, `新增产品「${name}」`)
    return httpOk({ _id: res._id })
  } catch (err) { console.error('products.create:', err); return httpError(500, '保存失败', 500) }
}

async function handleUpdate(user, body) {
  try {
    const { _id, name, category, price, unit, stock, description, images, status } = body
    if (!_id) return httpError(400, '产品ID不能为空')
    const data = { updatedAt: db.serverDate() }
    if (name) data.name = name.trim()
    if (category) data.category = category
    if (price !== undefined) data.price = Math.round(parseFloat(price) * 100)
    if (unit) data.unit = unit
    if (stock !== undefined) data.stock = parseInt(stock)
    if (status) data.status = status
    if (description !== undefined) data.description = description
    if (images && images.length) { data.images = images; data.image = images[0] }
    await db.collection('products').doc(_id).update({ data })
    await logOperation(db, user.username, 'product.update', name || _id, `编辑产品「${name || _id}」`)
    return httpOk({})
  } catch (err) { console.error('products.update:', err); return httpError(500, '保存失败', 500) }
}

async function handleBatch(user, body) {
  try {
    const { ids, action, category, unit, status } = body
    if (!ids || !ids.length) return httpError(400, '请选择产品')
    if (action === 'delete') {
      await db.collection('products').where({ _id: _.in(ids) }).remove()
      await logOperation(db, user.username, 'product.delete', `批量`, `删除${ids.length}个产品`)
      return httpOk({ affected: ids.length })
    }
    if (action === 'update') {
      const data = { updatedAt: db.serverDate() }
      if (category) data.category = category
      if (unit) data.unit = unit
      if (status) data.status = status
      if (!category && !unit && !status) return httpError(400, '请至少选择一个要修改的字段')
      await db.collection('products').where({ _id: _.in(ids) }).update({ data })
      await logOperation(db, user.username, 'product.update', `批量`, `批量更新${ids.length}个产品`)
      return httpOk({ affected: ids.length })
    }
    return httpError(400, '不支持的操作类型')
  } catch (err) { console.error('products.batch:', err); return httpError(500, '批量操作失败', 500) }
}

async function handleExport(qs) {
  try {
    const where = {}
    if (qs.category) where.category = qs.category
    if (qs.status) where.status = qs.status
    const res = await db.collection('products').where(where).limit(1000).orderBy('name', 'asc').get()
    return httpOk({ list: res.data })
  } catch (err) { console.error('products.export:', err); return httpError(500, '导出失败', 500) }
}

async function handleImport(user, body) {
  try {
    const { items } = body
    if (!items || !items.length) return httpError(400, '没有可导入的数据')
    let success = 0
    for (const item of items) {
      if (!item.name || item.price === undefined) continue
      await db.collection('products').add({
        data: {
          name: item.name.trim(), category: item.category || '其他',
          price: Math.round(parseFloat(item.price) * 100),
          unit: item.unit || '米', stock: parseInt(item.stock) || 0,
          status: 'sufficient', description: item.description || '',
          createdAt: db.serverDate(), updatedAt: db.serverDate()
        }
      })
      success++
    }
    await logOperation(db, user.username, 'product.create', `批量导入`, `导入${success}个产品`)
    return httpOk({ success })
  } catch (err) { console.error('products.import:', err); return httpError(500, '导入失败', 500) }
}
