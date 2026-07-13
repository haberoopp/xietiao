const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const fs = require('fs')
const path = require('path')
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

  if (method === 'GET' && path === '/products') return handleList(qs)
  if (method === 'POST' && path === '/products') return handleCreate(auth.user, body)
  if (method === 'PUT' && path === '/products') return handleUpdate(auth.user, body)
  if (method === 'POST' && path === '/products/batch') return handleBatch(auth.user, body)
  if (method === 'GET' && path === '/products/export') return handleExport(qs)
  if (method === 'POST' && path === '/products/import') return handleImport(auth.user, body)
  if (method === 'POST' && path === '/products/upload') return handleUpload(body)

  return httpError(404, 'Not Found', 404)
}

async function handleList(qs) {
  try {
    const page = parseInt(qs.page) || 1
    const requestedSize = parseInt(qs.pageSize) || 20
    // 前端修改订单的产品搜索需要全部产品，上限提高到 2000
    const pageSize = Math.min(requestedSize, 2000)
    const where = {}
    if (qs.category) where.category = qs.category
    if (qs.status) where.status = qs.status
    if (qs.keyword) {
      const kw = security.escapeRegex(qs.keyword.trim())
      where.$or = [{ name: db.RegExp({ regexp: kw, options: 'i' }) }, { category: db.RegExp({ regexp: kw, options: 'i' }) }]
    }
    const countRes = await db.collection('products').where(where).count()

    // CloudBase 单次 get() 最多返回 100 条，pageSize 超过 100 时分批拉取
    const MAX_BATCH = 100
    let listData = []
    if (pageSize <= MAX_BATCH) {
      const res = await db.collection('products').where(where)
        .skip((page - 1) * pageSize).limit(pageSize).orderBy('name', 'asc').get()
      listData = res.data
    } else {
      const totalNeeded = Math.min(pageSize, countRes.total - (page - 1) * pageSize)
      for (let offset = (page - 1) * pageSize; offset < (page - 1) * pageSize + totalNeeded; offset += MAX_BATCH) {
        const res = await db.collection('products').where(where)
          .skip(offset).limit(Math.min(MAX_BATCH, totalNeeded - (offset - (page - 1) * pageSize)))
          .orderBy('name', 'asc').get()
        listData = listData.concat(res.data)
      }
    }
    // 解析图片 URL（供 web 端显示）
    // image 字段可能是 HTTPS URL（直接可用）或 cloud:// fileID（需转换）
    const cloudFileIds = []
    const directUrls = {}
    listData.forEach(p => {
      ;[p.image, ...(p.images || [])].filter(Boolean).forEach(url => {
        if (url.startsWith('cloud://')) {
          cloudFileIds.push(url)
        } else if (url.startsWith('http://') || url.startsWith('https://')) {
          directUrls[url] = url  // HTTPS URL 直接用
        }
      })
    })
    const urlMap = { ...directUrls }
    if (cloudFileIds.length > 0) {
      try {
        const uniqueIds = [...new Set(cloudFileIds)]
        for (let i = 0; i < uniqueIds.length; i += 50) {
          const batch = uniqueIds.slice(i, i + 50)
          const urlRes = await cloud.getTempFileURL({ fileList: batch })
          urlRes.fileList.forEach(f => {
            if (f.tempFileURL) urlMap[f.fileID] = f.tempFileURL
          })
        }
      } catch (e) { console.error('products.getTempFileURL:', e) }
    }
    const list = listData.map(p => ({
      ...p,
      imageUrl: p.image ? (urlMap[p.image] || '') : '',
      imagesUrls: p.images ? p.images.map(fid => urlMap[fid] || '') : []
    }))
    return httpOk({ list, total: countRes.total, page, pageSize })
  } catch (err) { console.error('products.list:', err); return httpError(500, '加载失败', 500) }
}

async function handleCreate(user, body) {
  try {
    const { name, category, price, unit, stock, description, images, status } = body
    if (!name || !category || price === undefined || price === null || isNaN(parseFloat(price)) || parseFloat(price) < 0) return httpError(400, '名称、分类和价格不能为空，价格不能为负数')
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
    if (price !== undefined) {
      if (price === null || isNaN(parseFloat(price)) || parseFloat(price) < 0) return httpError(400, '价格不能为负数')
      data.price = Math.round(parseFloat(price) * 100)
    }
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
      const data = {
        name: item.name.trim(), category: item.category || '其他',
        price: Math.round(parseFloat(item.price) * 100),
        unit: item.unit || '米', stock: parseInt(item.stock) || 0,
        status: 'sufficient', description: item.description || '',
        createdAt: db.serverDate(), updatedAt: db.serverDate()
      }
      if (item.images && item.images.length) {
        data.images = item.images
        data.image = item.images[0]
      }
      await db.collection('products').add({ data })
      success++
    }
    await logOperation(db, user.username, 'product.create', `批量导入`, `导入${success}个产品`)
    return httpOk({ success })
  } catch (err) { console.error('products.import:', err); return httpError(500, '导入失败', 500) }
}

async function handleUpload(body) {
  try {
    const { image, fileName } = body
    if (!image || !fileName) return httpError(400, '缺少图片数据')
    const ext = path.extname(fileName).toLowerCase()
    if (!['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].includes(ext)) {
      return httpError(400, '不支持的图片格式')
    }
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '')
    const tmpPath = `/tmp/${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`
    fs.writeFileSync(tmpPath, Buffer.from(base64Data, 'base64'))
    const cloudPath = `products/${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`
    const uploadRes = await cloud.uploadFile({ cloudPath, filePath: tmpPath })
    try { fs.unlinkSync(tmpPath) } catch (e) {}
    return httpOk({ fileID: uploadRes.fileID, cloudPath })
  } catch (err) { console.error('products.upload:', err); return httpError(500, '图片上传失败', 500) }
}
