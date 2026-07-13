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
  const isManager = auth.user.role === 'manager'

  const method = event.httpMethod
  const path = (event.path || '').replace('/api/admin', '')
  const qs = event.queryStringParameters || {}
  let body = {}
  try { body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body || {}) } catch (e) {}

  if (method === 'GET' && path === '/orders') return handleList(auth.user, qs)
  if (method === 'GET' && path.startsWith('/orders/')) return handleDetail(auth.user, path.split('/orders/')[1])
  if (method === 'PUT' && path.startsWith('/orders/')) return handleUpdate(auth.user, path.split('/orders/')[1], body)
  if (method === 'POST' && path === '/orders/batch') return handleBatch(auth.user, body)
  if (method === 'DELETE' && path.startsWith('/orders/')) return handleDelete(auth.user, path.split('/orders/')[1])
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
      const kw = security.escapeRegex(qs.keyword.trim())
      where.$or = [
        { customerName: db.RegExp({ regexp: kw, options: 'i' }) },
        { phone: db.RegExp({ regexp: kw, options: 'i' }) },
        { _id: db.RegExp({ regexp: kw, options: 'i' }) }
      ]
    }
    const [countRes, listRes] = await Promise.all([
      db.collection('orders').where(where).count(),
      db.collection('orders').where(where).skip((page - 1) * pageSize).limit(pageSize).orderBy('createdAt', 'desc').get()
    ])
    const list = listRes.data.map(o => ({
      _id: o._id, customerName: o.customerName,
      phone: user.role === 'manager' ? o.phone : (o.phone ? o.phone.slice(0, 3) + '****' + o.phone.slice(-4) : ''),
      address: o.address,
      itemsSummary: (o.items || []).map(i => i.name + '×' + i.quantity).join('、'),
      totalAmount: o.totalAmount, discount: o.discount, deliveryMethod: o.deliveryMethod,
      status: o.status, payment_status: o.payment_status, paid_amount: o.paid_amount || 0,
      pickedUp: o.pickedUp || false, remark: o.remark, returnRequest: o.returnRequest, createdAt: o.createdAt,
      images: o.images || []
    }))
    return httpOk({ list, total: countRes.total, page, pageSize })
  } catch (err) { console.error('orders.list:', err); return httpError(500, '加载失败', 500) }
}

async function handleDetail(user, orderId) {
  try {
    const res = await db.collection('orders').doc(orderId).get()
    if (!res.data) return httpError(404, '订单不存在')
    const record = res.data
    // 非管理员只能查看自己配送范围内的订单
    if (user.role !== 'manager') {
      const roleDeliveryMethod = user.role === 'delivery' ? 'delivery' : user.role === 'warehouse' ? 'logistics' : null;
      if (roleDeliveryMethod && record.deliveryMethod !== roleDeliveryMethod) {
        return httpError(403, '无权限查看此订单', 403);
      }
      // 非管理员脱敏手机号
      if (record.phone) record.phone = record.phone.slice(0, 3) + '****' + record.phone.slice(-4);
    }
    // 转换云文件ID为临时HTTPS URL
    if (record.images && record.images.length > 0) {
      try {
        const fileIDs = record.images.map(img => img.fileID || img).filter(Boolean)
        if (fileIDs.length > 0) {
          const urlRes = await cloud.getTempFileURL({ fileList: fileIDs })
          const urlMap = {}
          ;(urlRes.fileList || []).forEach(f => { urlMap[f.fileID] = f.tempFileURL || '' })
          record.images = record.images.map(img => {
            const fid = img.fileID || img
            return { ...img, fileID: fid, url: urlMap[fid] || fid }
          })
        }
      } catch (e) { /* 转换失败保持原样 */ }
    }
    return httpOk({ record })
  } catch (err) { console.error('orders.detail:', err); return httpError(500, '加载失败', 500) }
}

async function handleUpdate(user, orderId, body) {
  try {
    const order = await db.collection('orders').doc(orderId).get()
    if (!order.data) return httpError(404, '订单不存在')

    // 非管理员只能修改自己配送范围内的订单，且不能修改金额/商品
    if (user.role !== 'manager') {
      const roleDeliveryMethod = user.role === 'delivery' ? 'delivery' : user.role === 'warehouse' ? 'logistics' : null;
      if (roleDeliveryMethod && order.data.deliveryMethod !== roleDeliveryMethod) {
        return httpError(403, '无权限修改此订单', 403);
      }
      if (body.totalAmount !== undefined || body.payment_status !== undefined || body.paid_amount !== undefined || body.items !== undefined || body.discount !== undefined) {
        return httpError(403, '无权限修改金额或商品明细', 403);
      }
    }

    const updateData = { updatedAt: db.serverDate() }
    let logAction = '', logDetail = ''

    // === 订单基本信息字段（支持修改订单功能） ===
    const VALID_DELIVERY = ['pickup', 'delivery', 'logistics'];
    if (body.customerName !== undefined) { updateData.customerName = body.customerName.trim(); if (!logAction) { logAction = 'order.edit'; logDetail = '修改客户信息' } }
    if (body.phone !== undefined) { updateData.phone = body.phone.trim(); if (!logAction) { logAction = 'order.edit'; logDetail = '修改客户信息' } }
    if (body.address !== undefined) { updateData.address = body.address.trim(); if (!logAction) { logAction = 'order.edit'; logDetail = '修改地址' } }
    if (body.deliveryMethod !== undefined) {
      updateData.deliveryMethod = VALID_DELIVERY.includes(body.deliveryMethod) ? body.deliveryMethod : 'delivery';
      if (!logAction) { logAction = 'order.edit'; logDetail = `修改拿货方式为${body.deliveryMethod}` }
    }
    if (body.logisticsCompany !== undefined) { updateData.logisticsCompany = body.logisticsCompany.trim(); if (!logAction) { logAction = 'order.edit'; logDetail = '修改物流公司' } }
    if (body.remark !== undefined) { updateData.remark = body.remark.trim() }

    // === 商品明细修改（服务端重新验算，与小程序 updateOrder 逻辑一致） ===
    if (body.items !== undefined && Array.isArray(body.items) && body.items.length > 0) {
      const items = body.items;
      const productIds = items.map(i => i.productId).filter(Boolean);
      const priceMap = {};
      if (productIds.length > 0) {
        const BATCH = 100;
        for (let i = 0; i < productIds.length; i += BATCH) {
          const batch = productIds.slice(i, i + BATCH);
          const prodRes = await db.collection('products')
            .where({ _id: db.command.in(batch) })
            .field({ price: true, name: true, unit: true })
            .get();
          prodRes.data.forEach(p => { priceMap[p._id] = p; });
        }
      }

      // 查询该客户的专属定价
      const customPriceMap = {};
      const phone = body.phone || order.data.phone;
      try {
        const customRes = await db.collection('customerPrices')
          .where({ customerPhone: phone, productId: db.command.in(productIds) })
          .get();
        customRes.data.forEach(cp => { customPriceMap[cp.productId] = cp.customPrice; });
      } catch (e) { /* customerPrices 集合可能不存在 */ }

      // 重新计算应收金额（分）
      let serverTotal = 0;
      const validatedItems = items.map(item => {
        const prod = priceMap[item.productId];
        const unitPrice = customPriceMap[item.productId] || (prod ? prod.price : (item.price || 0));
        const quantity = parseFloat(item.quantity) || 0;
        const lineTotal = Math.round(unitPrice * quantity);
        serverTotal += lineTotal;
        return {
          productId: item.productId,
          name: item.name || (prod ? prod.name : ''),
          price: unitPrice,
          quantity,
          unit: (prod ? prod.unit : '') || item.unit || '米'
        };
      });

      updateData.items = validatedItems;
      updateData.totalAmount = serverTotal;
      if (!logAction) { logAction = 'order.edit'; logDetail = '修改商品明细' }
    }

    // === 原有的管理字段 ===
    const VALID_STATUS = ['processing', 'completed', 'cancelled'];
    if (body.status && !VALID_STATUS.includes(body.status)) return httpError(400, '无效的订单状态');
    if (body.status) { updateData.status = body.status; logAction = 'order.status'; logDetail = `订单状态改为${body.status === 'completed' ? '已完成' : body.status === 'cancelled' ? '已取消' : body.status}` }
    if (body.payment_status) {
      const VALID_PAYMENT = ['paid', 'unpaid'];
      if (!VALID_PAYMENT.includes(body.payment_status)) return httpError(400, '无效的付款状态');
      updateData.payment_status = body.payment_status;
      if (body.payment_status === 'paid') updateData.paid_amount = order.data.totalAmount
    }
    if (body.paid_amount !== undefined) {
      updateData.paid_amount = parseInt(body.paid_amount)
      updateData.payment_status = updateData.paid_amount >= (body.totalAmount !== undefined ? parseInt(body.totalAmount) : order.data.totalAmount) ? 'paid' : (updateData.paid_amount > 0 ? 'unpaid' : 'unpaid')
      if (!logAction) { logAction = 'order.payment'; logDetail = `已付改为${(updateData.paid_amount / 100).toFixed(2)}元` }
    }
    if (body.totalAmount !== undefined && updateData.totalAmount === undefined) { updateData.totalAmount = Math.round(parseFloat(body.totalAmount)); if (!logAction) { logAction = 'order.price'; logDetail = `金额改为${(body.totalAmount / 100).toFixed(2)}元` } }
    if (body.pickedUp !== undefined) updateData.pickedUp = body.pickedUp
    // returnRequest should only be modified through adminHandleReturn

    await db.collection('orders').doc(orderId).update({ data: updateData })
    if (logAction) await logOperation(db, user.username, logAction, `「${order.data.customerName||'顾客'}」订单${orderId.slice(-8)}`, logDetail)
    return httpOk({})
  } catch (err) { console.error('orders.update:', err); return httpError(500, '操作失败', 500) }
}

async function handleBatch(user, body) {
  try {
    const { ids, action } = body
    if (!ids || !ids.length) return httpError(400, '请选择订单')
    // 非管理员不能批量操作状态
    if (user.role !== 'manager' && action !== 'delete') return httpError(403, '无权限批量操作', 403)
    const updateData = { updatedAt: db.serverDate() }
    let logDetail = ''
    if (action === 'complete') { updateData.status = 'completed'; logDetail = `批量完成${ids.length}个订单` }
    else if (action === 'cancel') { updateData.status = 'cancelled'; logDetail = `批量取消${ids.length}个订单` }
    else if (action === 'delete') {
      if (user.role !== 'manager') return httpError(403, '仅管理员可批量删除订单', 403)
      await db.collection('orders').where({ _id: _.in(ids) }).remove()
      await logOperation(db, user.username, 'order.delete', `批量(${ids.length}单)`, `批量删除${ids.length}个订单`)
      return httpOk({ affected: ids.length })
    }
    else return httpError(400, '不支持的操作类型')
    await db.collection('orders').where({ _id: _.in(ids) }).update({ data: updateData })
    await logOperation(db, user.username, 'order.status', `批量(${ids.length}单)`, logDetail)
    return httpOk({ affected: ids.length })
  } catch (err) { console.error('orders.batch:', err); return httpError(500, '批量操作失败', 500) }
}

async function handleDelete(user, orderId) {
  try {
    if (user.role !== 'manager') return httpError(403, '仅管理员可删除订单', 403)
    const order = await db.collection('orders').doc(orderId).get()
    if (!order.data) return httpError(404, '订单不存在')
    await db.collection('orders').doc(orderId).remove()
    await logOperation(db, user.username, 'order.delete', `「${order.data.customerName||'顾客'}」订单${orderId.slice(-8)}`, `删除订单「${order.data.customerName||''}」`)
    return httpOk({ deleted: orderId })
  } catch (err) { console.error('orders.delete:', err); return httpError(500, '删除失败', 500) }
}

async function handleExport(user, qs) {
  try {
    const where = {}
    if (qs.status) where.status = qs.status
    if (qs.deliveryMethod) where.deliveryMethod = qs.deliveryMethod
    if (user.role === 'delivery') where.deliveryMethod = 'delivery'
    if (user.role === 'warehouse') where.deliveryMethod = 'logistics'
    if (qs.keyword) { const kw = security.escapeRegex(qs.keyword.trim()); where.$or = [{ customerName: db.RegExp({ regexp: kw, options: 'i' }) }, { phone: db.RegExp({ regexp: kw, options: 'i' }) }, { _id: db.RegExp({ regexp: kw, options: 'i' }) }] }
    const res = await db.collection('orders').where(where).limit(1000).orderBy('createdAt', 'desc').get()
    return httpOk({ list: res.data })
  } catch (err) { console.error('orders.export:', err); return httpError(500, '导出失败', 500) }
}
