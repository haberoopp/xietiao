const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const { requireJwt, httpOk, httpError } = require('./jwtAuth')

const CATEGORIES_DOC = 'productCategories'

// 从 settings 集合读取手动维护的分类列表
async function getStoredCategories() {
  const res = await db.collection('settings').doc(CATEGORIES_DOC).get()
  return (res.data && res.data.value) ? res.data.value : []
}

// 保存分类列表
async function saveStoredCategories(list) {
  try {
    await db.collection('settings').doc(CATEGORIES_DOC).update({ data: { value: list, updatedAt: db.serverDate() } })
  } catch (e) {
    // 文档不存在则创建
    await db.collection('settings').add({ data: { _id: CATEGORIES_DOC, key: CATEGORIES_DOC, value: list, createdAt: db.serverDate(), updatedAt: db.serverDate() } })
  }
}

exports.main = async (event) => {
  const auth = await requireJwt(event)
  if (!auth.authorized) return auth.response
  if (auth.user.role !== 'manager') return httpError(403, '无权限', 403)

  const method = event.httpMethod
  const path = (event.path || '').replace('/api/admin', '')
  let body = {}
  try { body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body || {}) } catch (e) {}

  if (method === 'GET' && path === '/settings') return handleGetCategories()
  if (method === 'POST' && path === '/settings/category') return handleAddCategory(body)
  if (method === 'PUT' && path === '/settings/category') return handleRenameCategory(body)
  if (method === 'DELETE' && path === '/settings/category') return handleDeleteCategory(body)

  return httpError(404, 'Not Found', 404)
}

async function handleGetCategories() {
  try {
    // 获取产品分类统计
    const productRes = await db.collection('products').field({ category: true }).limit(2000).get()
    const countMap = {}
    productRes.data.forEach(p => { const c = p.category || '其他'; countMap[c] = (countMap[c] || 0) + 1 })

    // 获取手动维护的分类列表
    let storedList = []
    try { storedList = await getStoredCategories() } catch (e) { /* 尚未初始化 */ }

    // 合并：手动列表中的分类 + 产品中实际存在但不在手动列表中的分类
    const storedSet = new Set(storedList)
    const merged = storedList.map(name => ({ name, count: countMap[name] || 0 }))
    // 添加产品中存在但不在手动列表中的分类
    Object.entries(countMap).forEach(([name, count]) => {
      if (!storedSet.has(name)) merged.push({ name, count })
    })

    return httpOk({ categories: merged })
  } catch (err) { console.error(err); return httpError(500, '加载失败', 500) }
}

async function handleAddCategory(body) {
  try {
    const { name } = body
    if (!name || !name.trim()) return httpError(400, '分类名不能为空')
    const trimmed = name.trim()
    let list = []
    try { list = await getStoredCategories() } catch (e) {}
    if (list.includes(trimmed)) return httpError(409, '分类已存在')
    list.push(trimmed)
    await saveStoredCategories(list)
    return httpOk({ name: trimmed })
  } catch (err) { console.error(err); return httpError(500, '添加失败', 500) }
}

async function handleRenameCategory(body) {
  try {
    const { oldName, newName } = body
    if (!oldName || !newName || !newName.trim()) return httpError(400, '分类名不能为空')
    if (oldName === newName.trim()) return httpOk({})
    // 更新手动列表
    let list = []
    try { list = await getStoredCategories() } catch (e) {}
    const idx = list.indexOf(oldName)
    if (idx >= 0) { list[idx] = newName.trim(); await saveStoredCategories(list) }
    // 更新所有使用该分类的产品
    await db.collection('products').where({ category: oldName }).update({ data: { category: newName.trim(), updatedAt: db.serverDate() } })
    return httpOk({})
  } catch (err) { console.error(err); return httpError(500, '重命名失败', 500) }
}

async function handleDeleteCategory(body) {
  try {
    const { name } = body
    if (!name) return httpError(400, '分类名不能为空')
    // 从手动列表删除
    let list = []
    try { list = await getStoredCategories() } catch (e) {}
    const idx = list.indexOf(name)
    if (idx >= 0) { list.splice(idx, 1); await saveStoredCategories(list) }
    // 将该分类的产品归为"其他"
    await db.collection('products').where({ category: name }).update({ data: { category: '其他', updatedAt: db.serverDate() } })
    return httpOk({})
  } catch (err) { console.error(err); return httpError(500, '删除失败', 500) }
}
