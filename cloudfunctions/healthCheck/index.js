/**
 * 健康检查 — 验证数据库连接
 * 独立运行，不依赖 lib/ 共享模块（确保能单独部署）
 */

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const res = require('./response');

exports.main = async () => {
  const start = Date.now();

  try {
    const collections = ['products', 'orders', 'admins', 'addresses', 'customers', 'returnRequests'];
    const probes = collections.map(name =>
      db.collection(name).count()
        .then(r => ({ name, status: 'ok', count: r.total }))
        .catch(e => ({ name, status: 'error' }))
    );
    const results = await Promise.all(probes);

    const status = {};
    let allOk = true;
    results.forEach(r => {
      status[r.name] = r;
      if (r.status === 'error') allOk = false;
    });

    if (!allOk) {
      return res.badRequest('部分集合不可用', status);
    }

    return res.record({
      db: 'ok',
      collections: status,
      uptime: Date.now() - start
    });
  } catch (err) {
    return res.internalError();
  }
};
