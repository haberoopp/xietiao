/**
 * 操作日志模块
 * 所有关键操作通过此模块写入 operationLogs 集合
 */

async function logOperation(db, operator, action, target, detail) {
  try {
    await db.collection('operationLogs').add({
      data: { operator, action, target, detail, createdAt: db.serverDate() }
    })
  } catch (err) {
    console.error('logOperation failed:', err.message)
  }
}

module.exports = { logOperation }
