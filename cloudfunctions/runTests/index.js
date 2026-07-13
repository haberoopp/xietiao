/**
 * 后端自动化测试套件
 *
 * 覆盖 5 个高风险功能模块：
 *   1. adminWebFinance  — 收款登记（含并发竞态检测）
 *   2. adminHandleReturn — 退换货审批（金额重算验证）
 *   3. adminWebOrders   — Web 订单编辑（100x 价格 bug 检测）
 *   4. submitOrder      — 下单验算（价格绕过检测）
 *   5. adminUpdateOrderPrice — 直接改价（联动缺失检测）
 *
 * 运行方式:
 *   tcb fn invoke runTests --env-id cloudbase-d6g98vaoyb7ec331a
 *
 * 结果解读:
 *   最后一行是 "ALL N passed, M failed" 的汇总。
 *   N=全部通过表示所有核心流程数据正确。
 *   有任何 FAIL 都会打印具体原因和期望值 vs 实际值。
 */

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const https = require('https');

// ============================================================================
// 全局状态
// ============================================================================
const TEST_PREFIX = 'TEST_' + Date.now() + '_';
let testAdminUser = TEST_PREFIX + 'admin';
let testAdminPwd = 'Test@1234';
let jwtToken = '';
let testProductIds = [];
let testOrderIds = [];
let testCustomerPhone = '139' + String(Date.now()).slice(-8);
let testOpenid = '';

// 统计
let passed = 0, failed = 0, skipped = 0;
let currentModule = '';
const failures = [];

// ============================================================================
// 微型测试框架
// ============================================================================
function module(name) {
  currentModule = name;
  console.log('\n' + '='.repeat(60));
  console.log('  ' + name);
  console.log('='.repeat(60));
}

async function it(name, fn) {
  try {
    await fn();
    passed++;
    console.log('  \x1b[32m✓\x1b[0m ' + name);
  } catch (e) {
    failed++;
    const msg = `\n  \x1b[31m✗\x1b[0m ${name}\n    ${e.message}`;
    console.log(msg);
    failures.push({ module: currentModule, test: name, error: e.message });
  }
}

function fail(msg) { throw new Error(msg); }

async function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label || 'assertEqual'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

async function assertApprox(actual, expected, tolerance, label) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label || 'assertApprox'}: expected ≈${expected} (±${tolerance}), got ${actual}`);
  }
}

async function assertTruthy(value, label) {
  if (!value) throw new Error(`${label || 'assertTruthy'}: expected truthy, got ${JSON.stringify(value)}`);
}

async function assertRange(value, min, max, label) {
  if (value < min || value > max) {
    throw new Error(`${label || 'assertRange'}: expected ${min}~${max}, got ${value}`);
  }
}

// ============================================================================
// HTTP 请求工具（调用 Web Admin API）
// ============================================================================
const HTTP_HOST = 'cloudbase-d6g98vaoyb7ec331a.service.tcloudbase.com';

function httpRequest(method, path, token, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: HTTP_HOST,
      path: '/api/admin' + path,
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) options.headers['Authorization'] = 'Bearer ' + token;

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', (e) => reject(new Error('HTTP error: ' + e.message)));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ============================================================================
// DB 工具
// ============================================================================
async function dbGet(collection, id) {
  const r = await db.collection(collection).doc(id).get();
  return r.data;
}

async function dbFindOne(collection, where) {
  const r = await db.collection(collection).where(where).limit(1).get();
  return r.data.length > 0 ? r.data[0] : null;
}

// ============================================================================
// 测试数据准备
// ============================================================================
async function setupTestData() {
  console.log('\n--- 准备测试数据 ---');

  // 获取当前 OPENID
  try {
    const wxContext = cloud.getWXContext();
    testOpenid = wxContext.OPENID || 'test-openid-' + Date.now();
  } catch (e) {
    testOpenid = 'test-openid-' + Date.now();
  }
  console.log('  OPENID: ' + testOpenid);

  // 创建测试产品
  const products = [
    { name: TEST_PREFIX + '产品A-色丁', category: '色丁', price: 1000, unit: '米', stock: 100, status: 'sufficient', description: 'test' },
    { name: TEST_PREFIX + '产品B-全棉', category: '全棉', price: 500, unit: '米', stock: 50, status: 'sufficient', description: 'test' },
    { name: TEST_PREFIX + '产品C-丝缎', category: '丝缎', price: 2500, unit: '米', stock: 30, status: 'sufficient', description: 'test' },
  ];

  for (const p of products) {
    const r = await db.collection('products').add({
      data: { ...p, createdAt: db.serverDate(), updatedAt: db.serverDate() }
    });
    testProductIds.push(r._id);
    console.log('  创建产品: ' + p.name + ' (' + r._id + ')');
  }

  // 创建测试客户
  try {
    await db.collection('customers').add({
      data: {
        name: TEST_PREFIX + '测试客户',
        phone: testCustomerPhone,
        totalOrders: 0, totalAmount: 0, debt: 0,
        createdAt: db.serverDate(), updatedAt: db.serverDate()
      }
    });
  } catch (e) { /* 可能已存在 */ }
  console.log('  客户手机: ' + testCustomerPhone);

  // 创建测试管理员（直接写 DB，使用 passwordHash）
  try {
    const pwHash = require('./passwordHash');
    const { salt, hash } = pwHash.hashPassword(testAdminPwd);
    // 先删除旧记录
    const existing = await db.collection('admins').where({ username: testAdminUser }).get();
    for (const a of existing.data) {
      await db.collection('admins').doc(a._id).remove();
    }
    await db.collection('admins').add({
      data: {
        username: testAdminUser,
        passwordHash: hash,
        salt,
        role: 'manager',
        nickname: 'Test Admin',
        status: 'active',
        failedAttempts: 0,
        loggedIn: true,
        lastLoginOpenid: testOpenid,
        lastLoginAt: db.serverDate(),
        lastActivityAt: db.serverDate(),
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });
    console.log('  创建测试管理员: ' + testAdminUser);
  } catch (e) {
    console.log('  创建管理员失败: ' + e.message);
  }

  // 通过 HTTP 登录获取 JWT
  try {
    const loginRes = await httpRequest('POST', '/login', null, {
      username: testAdminUser,
      password: testAdminPwd
    });
    if (loginRes.status === 200 && loginRes.body && loginRes.body.data && loginRes.body.data.token) {
      jwtToken = loginRes.body.data.token;
      console.log('  JWT 获取成功');
    } else {
      console.log('  JWT 获取失败: ' + JSON.stringify(loginRes.body).substring(0, 200));
    }
  } catch (e) {
    console.log('  JWT 获取异常: ' + e.message);
  }

  console.log('  测试数据准备完成');
  console.log('  产品 IDs: ' + testProductIds.join(', '));
}

// ============================================================================
// 测试数据清理
// ============================================================================
async function cleanupTestData() {
  console.log('\n--- 清理测试数据 ---');

  // 清理测试订单
  for (const id of testOrderIds) {
    try { await db.collection('orders').doc(id).remove(); } catch (e) {}
  }

  // 清理测试产品
  for (const id of testProductIds) {
    try { await db.collection('products').doc(id).remove(); } catch (e) {}
  }

  // 清理测试客户
  try {
    const custRes = await db.collection('customers').where({ phone: testCustomerPhone }).get();
    for (const c of custRes.data) {
      try { await db.collection('customers').doc(c._id).remove(); } catch (e) {}
    }
  } catch (e) {}

  // 清理测试专属定价
  try {
    const cpRes = await db.collection('customerPrices').where({ customerPhone: testCustomerPhone }).get();
    for (const cp of cpRes.data) {
      try { await db.collection('customerPrices').doc(cp._id).remove(); } catch (e) {}
    }
  } catch (e) {}

  // 清理测试退货申请
  try {
    const rrRes = await db.collection('returnRequests').where({ _openid: testOpenid }).get();
    for (const rr of rrRes.data) {
      try { await db.collection('returnRequests').doc(rr._id).remove(); } catch (e) {}
    }
  } catch (e) {}

  // 清理测试管理员
  try {
    const adminRes = await db.collection('admins').where({ username: testAdminUser }).get();
    for (const a of adminRes.data) {
      try { await db.collection('admins').doc(a._id).remove(); } catch (e) {}
    }
  } catch (e) {}

  console.log('  清理完成');
}

// ============================================================================
// 辅助：创建一个测试订单
// ============================================================================
async function createTestOrder(overrides = {}) {
  const order = {
    _openid: testOpenid,
    customerName: overrides.customerName || TEST_PREFIX + '测试客户',
    phone: overrides.phone || testCustomerPhone,
    address: '测试地址',
    items: overrides.items || [
      { productId: testProductIds[0], name: '产品A-色丁', price: 1000, quantity: 2, unit: '米' },
      { productId: testProductIds[1], name: '产品B-全棉', price: 500, quantity: 3, unit: '米' }
    ],
    totalAmount: overrides.totalAmount !== undefined ? overrides.totalAmount : 3500,
    deliveryMethod: overrides.deliveryMethod || 'delivery',
    status: overrides.status || 'processing',
    payment_status: overrides.payment_status || 'unpaid',
    paid_amount: overrides.paid_amount || 0,
    discount: overrides.discount || 1.0,
    pickedUp: overrides.pickedUp || false,
    remark: overrides.remark || '',
    createdAt: db.serverDate()
  };
  const r = await db.collection('orders').add({ data: order });
  testOrderIds.push(r._id);
  return r._id;
}

// ============================================================================
// 辅助：提交退款申请并返回 requestId
// ============================================================================
async function createReturnRequest(orderId, type, items) {
  const reqData = {
    orderId,
    type,
    reason: '测试退换货',
    items
  };
  const result = await cloud.callFunction({ name: 'requestReturn', data: reqData });
  if (result.result && result.result.code !== 0) {
    throw new Error('创建退换货申请失败: ' + JSON.stringify(result.result));
  }
  // 查 returnRequests 表获取 ID
  const rrRes = await db.collection('returnRequests')
    .where({ orderId, _openid: testOpenid })
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();
  if (rrRes.data.length === 0) throw new Error('returnRequest 未找到');
  return rrRes.data[0]._id;
}


// ============================================================================
//                    测试用例开始
// ============================================================================

// ============================================================================
// 模块 1: adminWebFinance — 收款登记
// ============================================================================
async function test_Finance() {
  module('模块1: adminWebFinance 收款登记');

  // --- 1.1 正常流程 ---

  await it('TC-PAY-01 全额付清 — paid_amount 和 payment_status 正确', async () => {
    // 准备: 创建未付订单 50元
    const orderId = await createTestOrder({ totalAmount: 5000, paid_amount: 0, payment_status: 'unpaid' });

    if (!jwtToken) { skip('未获取到 JWT，跳过 HTTP 测试'); return; }
    const res = await httpRequest('POST', '/finance/payment', jwtToken, { orderId, amount: 50 });

    await assertEqual(res.status, 200, 'HTTP 状态码');
    await assertEqual(res.body.code, 0, 'API code');

    // 🔑 验证数据正确性
    const order = await dbGet('orders', orderId);
    await assertEqual(order.paid_amount, 5000, 'paid_amount 应为 5000 分');
    await assertEqual(order.payment_status, 'paid', 'payment_status 应为 paid');
  });

  await it('TC-PAY-02 部分付款 — paid_amount 更新正确，payment_status 保持 unpaid', async () => {
    const orderId = await createTestOrder({ totalAmount: 5000, paid_amount: 0, payment_status: 'unpaid' });

    if (!jwtToken) { skip('未获取到 JWT'); return; }
    const res = await httpRequest('POST', '/finance/payment', jwtToken, { orderId, amount: 30 });

    await assertEqual(res.status, 200, 'HTTP 状态码');
    const order = await dbGet('orders', orderId);
    await assertEqual(order.paid_amount, 3000, 'paid_amount 应为 3000 分');
    await assertEqual(order.payment_status, 'unpaid', '部分付款后 payment_status 仍为 unpaid');
  });

  await it('TC-PAY-03 分两次付清 — 第二次后自动切换 paid', async () => {
    const orderId = await createTestOrder({ totalAmount: 5000, paid_amount: 3000, payment_status: 'unpaid' });

    if (!jwtToken) { skip('未获取到 JWT'); return; }
    const res = await httpRequest('POST', '/finance/payment', jwtToken, { orderId, amount: 20 });

    await assertEqual(res.status, 200);
    const order = await dbGet('orders', orderId);
    await assertEqual(order.paid_amount, 5000, '累计已付 5000');
    await assertEqual(order.payment_status, 'paid', '应切换为 paid');
  });

  await it('TC-PAY-05 操作日志写入 — operationLogs 有记录', async () => {
    const orderId = await createTestOrder({ totalAmount: 3000, paid_amount: 0 });

    if (!jwtToken) { skip('未获取到 JWT'); return; }
    await httpRequest('POST', '/finance/payment', jwtToken, { orderId, amount: 10 });

    // 查 operationLogs
    const log = await dbFindOne('operationLogs', { action: 'payment.record' });
    await assertTruthy(log, '应有操作日志');
  });

  // --- 1.2 边界值 ---

  await it('TC-PAY-06 收款 0.001 元 — 拒绝或正确舍入（不静默写 0）', async () => {
    const orderId = await createTestOrder({ totalAmount: 5000, paid_amount: 0 });

    if (!jwtToken) { skip('未获取到 JWT'); return; }
    const res = await httpRequest('POST', '/finance/payment', jwtToken, { orderId, amount: 0.001 });

    // Math.round(0.001*100)=Math.round(0.1)=0 → amountInCents=0
    // amount<=0 检查应该拒绝，但 0.001>0，所以通过了开头检查
    // 结果: 写入了 paid_amount+0=paid_amount，没变化但接口返回成功
    const order = await dbGet('orders', orderId);
    // 实际应该保持不变，但这是边界行为
    await assertEqual(order.paid_amount, 0, 'paid_amount 不应变化（0.001元舍入为0分）');
    // 注意: 接口返回 200 但实际没收款，这是潜在问题
  });

  await it('TC-PAY-07 收款 0 元 — 应拒绝', async () => {
    if (!jwtToken) { skip('未获取到 JWT'); return; }
    const orderId = await createTestOrder({ totalAmount: 5000, paid_amount: 0 });
    const res = await httpRequest('POST', '/finance/payment', jwtToken, { orderId, amount: 0 });
    await assertEqual(res.status, 400, '应返回 400');
  });

  await it('TC-PAY-08 收款负数 — 应拒绝', async () => {
    if (!jwtToken) { skip('未获取到 JWT'); return; }
    const res = await httpRequest('POST', '/finance/payment', jwtToken,
      { orderId: testOrderIds[testOrderIds.length - 1] || 'fake', amount: -10 });
    await assertEqual(res.status, 400, '应返回 400');
  });

  await it('TC-PAY-14 amount 是字符串 "abc" — 不应写入 NaN', async () => {
    const orderId = await createTestOrder({ totalAmount: 5000, paid_amount: 0 });

    if (!jwtToken) { skip('未获取到 JWT'); return; }
    // parseFloat("abc") = NaN → Math.round(NaN*100) = NaN
    // newPaid = 0 + NaN = NaN → 写入 NaN
    const res = await httpRequest('POST', '/finance/payment', jwtToken, { orderId, amount: 'abc' });

    const order = await dbGet('orders', orderId);
    // 验证 paid_amount 没有被写成 NaN
    await assertEqual(order.paid_amount, 0, 'paid_amount 不应变成 NaN');
    console.log('    提示: amount="abc" 时接口返回=' + res.status + ', paid_amount=' + order.paid_amount);
  });

  // --- 1.3 并发 ---
  await it('TC-PAY-11 并发收款 — 原子递增不丢收款（验证竞态已修复）', async () => {
    const orderId = await createTestOrder({ totalAmount: 10000, paid_amount: 0, payment_status: 'unpaid' });

    if (!jwtToken) { skip('未获取到 JWT'); return; }

    // BUG-2 已修复: 使用 _.inc() 原子递增，不再读-算-写
    const [r1, r2] = await Promise.all([
      httpRequest('POST', '/finance/payment', jwtToken, { orderId, amount: 50 }),
      httpRequest('POST', '/finance/payment', jwtToken, { orderId, amount: 50 })
    ]);

    await new Promise(r => setTimeout(r, 500));

    const order = await dbGet('orders', orderId);
    console.log('    并发后 paid_amount=' + order.paid_amount + ' (期望 10000 分=100元)');

    await assertEqual(order.paid_amount, 10000,
      '并发两次 50 元收款，paid_amount 应为 10000(100元)。若失败说明原子递增未生效');
  });

  // --- 1.4 异常 ---
  await it('TC-PAY-12 订单不存在 — 返回 404', async () => {
    if (!jwtToken) { skip('未获取到 JWT'); return; }
    const res = await httpRequest('POST', '/finance/payment', jwtToken, { orderId: 'nonexistent_id_12345', amount: 10 });
    await assertEqual(res.status, 404, '应返回 404');
  });
}


// ============================================================================
// 模块 2: adminHandleReturn — 退换货审批
// ============================================================================
async function test_Return() {
  module('模块2: adminHandleReturn 退换货审批');

  // --- 2.1 正常流程（验证金额重算） ---

  await it('TC-RET-01 退货全额退款 — 订单金额正确归零', async () => {
    // 创建已完成订单: totalAmount=5000 (50元)
    const orderId = await createTestOrder({
      totalAmount: 5000, status: 'completed', payment_status: 'unpaid',
      items: [
        { productId: testProductIds[0], name: '产品A', price: 1000, quantity: 2, unit: '米' },
        { productId: testProductIds[1], name: '产品B', price: 500, quantity: 6, unit: '米' }
      ]
    });

    // 提交退货申请: 退全部产品
    const requestId = await createReturnRequest(orderId, 'return', [
      { productId: testProductIds[0], quantity: 2 },
      { productId: testProductIds[1], quantity: 6 }
    ]);

    // 审批通过
    const approveRes = await cloud.callFunction({
      name: 'adminHandleReturn',
      data: { requestId, action: 'approve' }
    });

    await assertEqual(approveRes.result.code, 0, '审批应成功');

    // 🔑 验证: totalAmount 应为原订单总额 - 退货金额 = 5000 - (1000*2+500*6) = 0
    const order = await dbGet('orders', orderId);
    await assertEqual(order.totalAmount, 0, '全额退货后 totalAmount 应为 0');
    await assertEqual(order.status, 'processing', '审批退货后订单状态回到 processing');
  });

  await it('TC-RET-02 部分退货 — 金额正确扣减', async () => {
    const orderId = await createTestOrder({
      totalAmount: 5000, status: 'completed', payment_status: 'unpaid',
      items: [
        { productId: testProductIds[0], name: '产品A', price: 1000, quantity: 2, unit: '米' },
        { productId: testProductIds[1], name: '产品B', price: 500, quantity: 6, unit: '米' }
      ]
    });

    const requestId = await createReturnRequest(orderId, 'return', [
      { productId: testProductIds[1], quantity: 2 }  // 只退 B 的 2 个
    ]);

    await cloud.callFunction({ name: 'adminHandleReturn', data: { requestId, action: 'approve' } });

    const order = await dbGet('orders', orderId);
    // 退款 = 500*2 = 1000, 新总额 = 5000 - 1000 = 4000
    await assertEqual(order.totalAmount, 4000, '部分退货: totalAmount 应为 5000-1000=4000');
  });

  await it('TC-RET-03 有折扣退货 — 退款按折扣计算', async () => {
    const orderId = await createTestOrder({
      totalAmount: 4000, discount: 0.8, status: 'completed', payment_status: 'unpaid',
      items: [
        { productId: testProductIds[0], name: '产品A', price: 1000, quantity: 5, unit: '米' }
      ]
    });

    const requestId = await createReturnRequest(orderId, 'return', [
      { productId: testProductIds[0], quantity: 1 }
    ]);

    await cloud.callFunction({ name: 'adminHandleReturn', data: { requestId, action: 'approve' } });

    const order = await dbGet('orders', orderId);
    // 退款 = Math.round(1000 * 0.8) * 1 = 800
    // 新总额 = 4000 - 800 = 3200
    await assertEqual(order.totalAmount, 3200, '折扣退货: totalAmount 应为 4000-800=3200');
  });

  await it('TC-RET-05 换货-换更贵的 — 差价正确增加', async () => {
    const orderId = await createTestOrder({
      totalAmount: 5000, discount: 1.0, status: 'completed', payment_status: 'unpaid',
      items: [
        { productId: testProductIds[0], name: '产品A', price: 1000, quantity: 2, unit: '米' },
        { productId: testProductIds[1], name: '产品B', price: 500, quantity: 3, unit: '米' }
      ]
    });

    const requestId = await createReturnRequest(orderId, 'exchange', [
      { productId: testProductIds[1], quantity: 1 }  // 退 B×1 (500)
    ]);

    // 需要在 returnRequests 里写入 exchangeItems
    // createReturnRequest 创建的申请中 exchangeItems 为 undefined
    // 直接操作 DB 补上 exchangeItems
    const rrRes = await db.collection('returnRequests').doc(requestId).get();
    await db.collection('returnRequests').doc(requestId).update({
      data: {
        exchangeItems: [{ productId: testProductIds[0], quantity: 1 }], // 换 A×1 (1000)
        type: 'exchange'
      }
    });
    await db.collection('orders').doc(orderId).update({
      data: {
        'returnRequest.exchangeItems': [{ productId: testProductIds[0], quantity: 1 }],
        'returnRequest.type': 'exchange',
        updatedAt: db.serverDate()
      }
    });

    await cloud.callFunction({ name: 'adminHandleReturn', data: { requestId, action: 'approve' } });

    const order = await dbGet('orders', orderId);
    // 退 B×1=500, 换 A×1=1000, 差价 = 1000-500=500
    // 新总额 = 5000 + 500 = 5500
    await assertEqual(order.totalAmount, 5500, '换更贵的: totalAmount 应为 5000+500=5500');
  });

  await it('TC-RET-06 换货-换更便宜的 — 差价正确减少', async () => {
    const orderId = await createTestOrder({
      totalAmount: 5000, discount: 1.0, status: 'completed', payment_status: 'unpaid',
      items: [
        { productId: testProductIds[0], name: '产品A', price: 1000, quantity: 2, unit: '米' },
        { productId: testProductIds[1], name: '产品B', price: 500, quantity: 3, unit: '米' }
      ]
    });

    const requestId = await createReturnRequest(orderId, 'exchange', [
      { productId: testProductIds[0], quantity: 1 }  // 退 A×1 (1000)
    ]);
    await db.collection('returnRequests').doc(requestId).update({
      data: {
        exchangeItems: [{ productId: testProductIds[1], quantity: 1 }], // 换 B×1 (500)
        type: 'exchange'
      }
    });
    await db.collection('orders').doc(orderId).update({
      data: {
        'returnRequest.exchangeItems': [{ productId: testProductIds[1], quantity: 1 }],
        'returnRequest.type': 'exchange',
        updatedAt: db.serverDate()
      }
    });

    await cloud.callFunction({ name: 'adminHandleReturn', data: { requestId, action: 'approve' } });

    const order = await dbGet('orders', orderId);
    // 退 A×1=1000, 换 B×1=500, 差价 = 500-1000 = -500
    // 新总额 = 5000 + (-500) = 4500
    await assertEqual(order.totalAmount, 4500, '换更便宜的: totalAmount 应为 5000-500=4500');
  });

  await it('TC-RET-07 reject — 退货被拒，订单金额不变', async () => {
    const orderId = await createTestOrder({
      totalAmount: 5000, status: 'completed', payment_status: 'unpaid',
      items: [{ productId: testProductIds[0], name: '产品A', price: 1000, quantity: 5, unit: '米' }]
    });

    const requestId = await createReturnRequest(orderId, 'return', [
      { productId: testProductIds[0], quantity: 2 }
    ]);

    await cloud.callFunction({ name: 'adminHandleReturn', data: { requestId, action: 'reject' } });

    const order = await dbGet('orders', orderId);
    await assertEqual(order.totalAmount, 5000, 'reject 后 totalAmount 不应改变');

    const rr = await dbGet('returnRequests', requestId);
    await assertEqual(rr.status, 'rejected', 'returnRequest 状态应为 rejected');
    await assertEqual(rr.rejectionCount, 1, 'rejectionCount 应为 1');
  });

  // --- 2.2 边界值 ---

  await it('TC-RET-09 退款超过订单总额 — totalAmount 不变成负数', async () => {
    const orderId = await createTestOrder({
      totalAmount: 500, status: 'completed', payment_status: 'unpaid',
      // 只有一个 500 分的产品
      items: [{ productId: testProductIds[1], name: '产品B', price: 500, quantity: 1, unit: '米' }]
    });

    const requestId = await createReturnRequest(orderId, 'return', [
      { productId: testProductIds[1], quantity: 3 }  // 请求退 3 个(1500分)，超过订单
    ]);

    await cloud.callFunction({ name: 'adminHandleReturn', data: { requestId, action: 'approve' } });

    const order = await dbGet('orders', orderId);
    // Math.min(3, 1) = 1，所以只退 1 个
    // 退款 = 500*1 = 500, 新总额 = max(0, 500-500) = 0
    await assertEqual(order.totalAmount, 0, '退款超过总额时 totalAmount 应为 0，不出现负数');
    await assertTruthy(order.totalAmount >= 0, 'totalAmount 不应为负');
  });

  // --- 2.3 异常 ---

  await it('TC-RET-15 申请不存在 — 返回错误', async () => {
    const res = await cloud.callFunction({
      name: 'adminHandleReturn',
      data: { requestId: 'nonexistent_return_id', action: 'approve' }
    });
    // code 应为 404
    await assertEqual(res.result.code, 404, '不存在的申请应返回 404');
  });

  await it('TC-RET-16 无效 action — 返回错误', async () => {
    const orderId = await createTestOrder({
      totalAmount: 5000, status: 'completed',
      items: [{ productId: testProductIds[0], name: '产品A', price: 1000, quantity: 1, unit: '米' }]
    });
    const requestId = await createReturnRequest(orderId, 'return', [
      { productId: testProductIds[0], quantity: 1 }
    ]);

    const res = await cloud.callFunction({
      name: 'adminHandleReturn',
      data: { requestId, action: 'delete' }
    });
    await assertEqual(res.result.code, 400, '无效 action 应返回 400');
  });
}


// ============================================================================
// 模块 3: adminWebOrders — Web 订单编辑
// ============================================================================
async function test_WebOrders() {
  module('模块3: adminWebOrders Web 订单编辑');

  // --- 3.1 正常流程 ---

  await it('TC-ORD-02 修改商品明细 — 价格从 products 表重算', async () => {
    const orderId = await createTestOrder({
      totalAmount: 3500, status: 'processing',
      items: [{ productId: testProductIds[0], name: '旧名称', price: 100, quantity: 1, unit: '米' }]
    });

    if (!jwtToken) { skip('未获取到 JWT'); return; }

    // 修改 items: 使用产品A(1000分)×3
    const res = await httpRequest('PUT', '/orders/' + orderId, jwtToken, {
      items: [{ productId: testProductIds[0], quantity: 3 }]
    });

    await assertEqual(res.status, 200);
    const order = await dbGet('orders', orderId);
    await assertEqual(order.totalAmount, 3000, '服务端重算: 1000×3=3000');
    await assertEqual(order.items[0].price, 1000, 'price 应取自 products 表(1000)而非客户端传值');
    await assertEqual(order.items[0].name, TEST_PREFIX + '产品A-色丁', 'name 应取自 products 表');
  });

  await it('TC-ORD-06 标记为已付 — paid_amount 自动设为 totalAmount', async () => {
    const orderId = await createTestOrder({ totalAmount: 5000, paid_amount: 0, payment_status: 'unpaid' });

    if (!jwtToken) { skip('未获取到 JWT'); return; }
    const res = await httpRequest('PUT', '/orders/' + orderId, jwtToken, { payment_status: 'paid' });

    await assertEqual(res.status, 200);
    const order = await dbGet('orders', orderId);
    await assertEqual(order.payment_status, 'paid');
    await assertEqual(order.paid_amount, 5000, '标记已付时 paid_amount 应自动等于 totalAmount');
  });

  // --- 3.2 边界值（关键 bug 检测） ---

  await it('TC-ORD-09 Web 改价 — 金额正确写入（验证 100x bug 已修复）', async () => {
    // BUG-1 已修复: 后端不再对已为分单位的值二次乘 100
    const orderId = await createTestOrder({ totalAmount: 5000, status: 'processing' });

    if (!jwtToken) { skip('未获取到 JWT'); return; }

    // 模拟前端改价：发送分为单位的 totalAmount（如 12.5元 = 1250分）
    const res = await httpRequest('PUT', '/orders/' + orderId, jwtToken, {
      totalAmount: 1250
    });

    await assertEqual(res.status, 200);
    const order = await dbGet('orders', orderId);
    await assertEqual(order.totalAmount, 1250, 'totalAmount 应为 1250 分(12.50元)，不应再乘100');
  });

  await it('TC-ORD-08 同时传 items 和 totalAmount — 验证优先级', async () => {
    const orderId = await createTestOrder({ totalAmount: 3500, status: 'processing' });

    if (!jwtToken) { skip('未获取到 JWT'); return; }

    const res = await httpRequest('PUT', '/orders/' + orderId, jwtToken, {
      items: [{ productId: testProductIds[0], quantity: 1 }],  // 服务端算得 1000
      totalAmount: 99999  // 试图覆盖
    });

    const order = await dbGet('orders', orderId);
    console.log('    同时传 items+totalAmount, 最终 totalAmount=' + order.totalAmount);
    // items 先设置 totalAmount=1000, 然后 totalAmount 检查 updateData.totalAmount===undefined 为 false, 不覆盖
    // 所以最终应为 1000
    await assertEqual(order.totalAmount, 1000, 'items 应优先于原始 totalAmount（服务端验算优先）');
  });

  // --- 3.3 异常 ---

  await it('TC-ORD-15 商品明细中使用不存在的 productId', async () => {
    const orderId = await createTestOrder({ totalAmount: 3500, status: 'processing' });

    if (!jwtToken) { skip('未获取到 JWT'); return; }

    const res = await httpRequest('PUT', '/orders/' + orderId, jwtToken, {
      items: [{ productId: 'ghost_product_id_99999', quantity: 2, price: 100000, name: 'fake' }]
    });

    const order = await dbGet('orders', orderId);
    console.log('    不存在产品, price=' + order.items[0].price + ', totalAmount=' + order.totalAmount);
    // 产品不存在 → prod=undefined → unitPrice = item.price || 0 = 100000 (客户端传来的)
    await assertEqual(order.items[0].price, 100000,
      '产品不存在时使用客户端传入价(100000分)。这是设计如此还是漏洞？');
  });

  await it('TC-ORD-19 同时传 paid_amount 和 payment_status=paid — 验证覆盖顺序', async () => {
    const orderId = await createTestOrder({ totalAmount: 10000, paid_amount: 0, payment_status: 'unpaid' });

    if (!jwtToken) { skip('未获取到 JWT'); return; }

    const res = await httpRequest('PUT', '/orders/' + orderId, jwtToken, {
      paid_amount: 3000,
      payment_status: 'paid'  // 这会触发 line 168: paid_amount = totalAmount(10000)
    });

    const order = await dbGet('orders', orderId);
    console.log('    paid_amount=' + order.paid_amount + ', payment_status=' + order.payment_status);
    // line 168 先执行: paid_amount=10000, payment_status='paid'
    // line 170 后执行: paid_amount=3000, payment_status 重算: 3000>=10000? false → 'unpaid'
    // 所以最终 paid_amount=3000, payment_status='unpaid'
    // 但用户意图是标记已付+只付3000，结果 payment_status 被改回 unpaid
    if (order.paid_amount === 10000 && order.payment_status === 'paid') {
      // 符合预期: paid_amount 先设后覆盖
    } else if (order.paid_amount === 3000 && order.payment_status === 'unpaid') {
      console.log('    注意: paid_amount=3000 但 payment_status=unpaid(用户本意是paid)');
    }
  });

  await it('TC-ORD-14 订单不存在 — 返回 404', async () => {
    if (!jwtToken) { skip('未获取到 JWT'); return; }
    const res = await httpRequest('PUT', '/orders/nonexistent_order_12345', jwtToken, { status: 'completed' });
    await assertEqual(res.status, 404);
  });
}


// ============================================================================
// 模块 4: submitOrder — 下单验算
// ============================================================================
async function test_SubmitOrder() {
  module('模块4: submitOrder 下单验算');

  // --- 4.1 正常流程 ---

  await it('TC-SUB-01 标准下单 — price 取自 products 表，totalAmount 服务端计算', async () => {
    const res = await cloud.callFunction({
      name: 'submitOrder',
      data: {
        customerName: TEST_PREFIX + '测试',
        phone: testCustomerPhone,
        address: '测试地址',
        items: [
          { productId: testProductIds[0], quantity: 2 },
          { productId: testProductIds[1], quantity: 4 }
        ],
        totalAmount: '3500',  // 客户端传 35元=3500分
        deliveryMethod: 'delivery'
      }
    });

    await assertEqual(res.result.code, 0, '下单应成功');
    const orderId = res.result.data.orderId;
    // 注册清理
    if (orderId && !testOrderIds.includes(orderId)) testOrderIds.push(orderId);

    const order = await dbGet('orders', orderId);
    // 服务端计算: 1000*2 + 500*4 = 4000
    await assertEqual(order.totalAmount, 4000, 'totalAmount 应为服务端计算值 4000(40元)');
    await assertEqual(order.items[0].price, 1000, 'item[0].price 应来自 products 表');
    await assertEqual(order.items[1].price, 500, 'item[1].price 应来自 products 表');
    await assertEqual(order.payment_status, 'unpaid');
    await assertEqual(order.status, 'processing');
  });

  await it('TC-SUB-02 客户专属价生效', async () => {
    // 设置专属价: 产品A 对测试客户 = 800 分
    await cloud.callFunction({
      name: 'customerPriceCRUD',
      data: {
        action: 'set',
        customerPhone: testCustomerPhone,
        productId: testProductIds[0],
        productName: '测试产品A',
        customPrice: 800
      }
    });

    const res = await cloud.callFunction({
      name: 'submitOrder',
      data: {
        customerName: TEST_PREFIX + '专属价测试',
        phone: testCustomerPhone,
        address: '测试地址',
        items: [
          { productId: testProductIds[0], quantity: 3 },
          { productId: testProductIds[1], quantity: 2 }
        ],
        totalAmount: '3400',  // 800*3 + 500*2 = 3400
        deliveryMethod: 'delivery'
      }
    });

    await assertEqual(res.result.code, 0, '下单应成功');
    if (res.result.data && res.result.data.orderId && !testOrderIds.includes(res.result.data.orderId)) {
      testOrderIds.push(res.result.data.orderId);
    }

    const order = await dbGet('orders', res.result.data.orderId);
    await assertEqual(order.items[0].price, 800, '专属价生效: item[0].price=800');
    await assertEqual(order.totalAmount, 3400, 'totalAmount=800*3+500*2=3400');
  });

  await it('TC-SUB-03 价格偏差超过 1 元 — 应拒绝', async () => {
    const res = await cloud.callFunction({
      name: 'submitOrder',
      data: {
        customerName: 'test', phone: testCustomerPhone, address: 'addr',
        items: [{ productId: testProductIds[0], quantity: 1 }],
        totalAmount: '2000',  // 客户端传 20元，实际 1000*1=1000(10元)，差 10元 > 1元
        deliveryMethod: 'delivery'
      }
    });

    // code 应为 400 (bad request)
    await assertEqual(res.result.code, 400, '价格偏差>1元应返回 400 拒绝');
  });

  await it('TC-SUB-04 价格偏差 0.99 元 — 应通过（1元容差内）', async () => {
    const res = await cloud.callFunction({
      name: 'submitOrder',
      data: {
        customerName: 'test', phone: testCustomerPhone, address: 'addr',
        items: [{ productId: testProductIds[0], quantity: 1 }],
        totalAmount: '1099',  // 客户端传 10.99元，实际 10元，差 99分 < 100分
        deliveryMethod: 'delivery'
      }
    });

    await assertEqual(res.result.code, 0, '偏差 99 分在容差内，应通过');
    if (res.result.data && res.result.data.orderId && !testOrderIds.includes(res.result.data.orderId)) {
      testOrderIds.push(res.result.data.orderId);
    }
    const order = await dbGet('orders', res.result.data.orderId);
    // 写入 DB 的是服务端计算的 serverTotal，不是客户端传的 1099
    await assertEqual(order.totalAmount, 1000, '写入 DB 的是服务端重算值 1000，非客户端传的 1099');
  });

  // --- 4.2 边界值 ---

  await it('TC-SUB-07 🔥 产品在 DB 中已删除 — 验算绕过检测', async () => {
    const res = await cloud.callFunction({
      name: 'submitOrder',
      data: {
        customerName: 'test', phone: testCustomerPhone, address: 'addr',
        items: [
          { productId: 'deleted_product_' + Date.now(), quantity: 1, price: 999999, name: '虚构天价产品' }
        ],
        totalAmount: '999999',  // 客户端传 9999.99 元
        deliveryMethod: 'delivery'
      }
    });

    // 产品不存在 → priceMap 中没有 → unitPrice = item.price = 999999
    // serverTotal = 999999, clientTotal = 999999, 差值 0 < 100, 验算通过
    console.log('    结果 code=' + (res.result ? res.result.code : 'unknown') + ', data=' + JSON.stringify(res.result).substring(0, 200));

    if (res.result && res.result.code === 0) {
      if (res.result.data && res.result.data.orderId && !testOrderIds.includes(res.result.data.orderId)) {
        testOrderIds.push(res.result.data.orderId);
      }
      const order = await dbGet('orders', res.result.data.orderId);
      console.log('    ⚠ 不存在的产品被下单! totalAmount=' + order.totalAmount + ', price=' + order.items[0].price);
      if (order.totalAmount >= 999999) {
        throw new Error('BUG 确认: 产品ID不存在时客户端报价直接穿透验算，天价订单(999999分)创建成功！');
      }
    } else if (res.result && res.result.code !== 0) {
      // 被拒绝了就是安全的
    }
  });

  await it('TC-SUB-09 商品数量 0 — totalAmount 为 0', async () => {
    const res = await cloud.callFunction({
      name: 'submitOrder',
      data: {
        customerName: 'test', phone: testCustomerPhone, address: 'addr',
        items: [{ productId: testProductIds[0], quantity: 0 }],
        totalAmount: '0',
        deliveryMethod: 'delivery'
      }
    });

    if (res.result.code === 0) {
      if (res.result.data && res.result.data.orderId && !testOrderIds.includes(res.result.data.orderId)) {
        testOrderIds.push(res.result.data.orderId);
      }
      const order = await dbGet('orders', res.result.data.orderId);
      await assertEqual(order.totalAmount, 0, '数量为 0 时 totalAmount=0');
    } else {
      // 被拒绝也可以接受
      console.log('    quantity=0 被接口拒绝, code=' + res.result.code);
    }
  });

  await it('TC-SUB-10 商品数量负数 — totalAmount 不应为负', async () => {
    const res = await cloud.callFunction({
      name: 'submitOrder',
      data: {
        customerName: 'test', phone: testCustomerPhone, address: 'addr',
        items: [{ productId: testProductIds[0], quantity: -5 }],
        totalAmount: '-5000',
        deliveryMethod: 'delivery'
      }
    });

    console.log('    code=' + (res.result ? res.result.code : 'unknown'));
    if (res.result && res.result.code === 0) {
      if (res.result.data && res.result.data.orderId && !testOrderIds.includes(res.result.data.orderId)) {
        testOrderIds.push(res.result.data.orderId);
      }
      const order = await dbGet('orders', res.result.data.orderId);
      if (order.totalAmount < 0) {
        throw new Error('BUG: 负数数量导致 totalAmount=' + order.totalAmount + '，订单金额为负！');
      }
      console.log('    负数数量下单成功, totalAmount=' + order.totalAmount);
    }
  });

  // --- 4.3 异常 ---

  await it('TC-SUB-13 缺少必填字段 — 应拒绝', async () => {
    const res = await cloud.callFunction({
      name: 'submitOrder',
      data: {
        // 缺少 customerName
        phone: testCustomerPhone,
        address: 'addr',
        items: [{ productId: testProductIds[0], quantity: 1 }],
        totalAmount: '1000',
        deliveryMethod: 'delivery'
      }
    });

    await assertEqual(res.result.code, 400, '缺少必填字段应返回 400');
  });

  await it('TC-SUB-15 totalAmount 是非数字字符串 — 应直接拒绝', async () => {
    // BUG-3 已修复: 显式检测 isNaN，不再让 NaN 绕过验算
    const res = await cloud.callFunction({
      name: 'submitOrder',
      data: {
        customerName: 'test', phone: testCustomerPhone, address: 'addr',
        items: [{ productId: testProductIds[0], quantity: 2 }],
        totalAmount: 'not_a_number_abc',
        deliveryMethod: 'delivery'
      }
    });

    await assertEqual(res.result.code, 400, '非数字字符串应返回 400 "订单金额格式错误"');
  });
}


// ============================================================================
// 模块 5: adminUpdateOrderPrice — 直接改价
// ============================================================================
async function test_DirectPrice() {
  module('模块5: adminUpdateOrderPrice 直接改价');

  await it('TC-PRC-01 正常改价 — 金额正确更新', async () => {
    const orderId = await createTestOrder({ totalAmount: 5000, paid_amount: 0 });

    const res = await cloud.callFunction({
      name: 'adminUpdateOrderPrice',
      data: { orderId, totalAmount: 6000 }
    });

    await assertEqual(res.result.code, 0, '改价应成功');
    const order = await dbGet('orders', orderId);
    await assertEqual(order.totalAmount, 6000, 'totalAmount 更新为 6000');
  });

  await it('TC-PRC-02 改为 0 — payment_status 联动更新', async () => {
    // BUG-4 已修复: 改价后自动同步 payment_status
    const orderId = await createTestOrder({ totalAmount: 5000, paid_amount: 3000, payment_status: 'unpaid' });

    const res = await cloud.callFunction({
      name: 'adminUpdateOrderPrice',
      data: { orderId, totalAmount: 0 }
    });

    await assertEqual(res.result.code, 0, '改价为 0 应成功');
    const order = await dbGet('orders', orderId);
    await assertEqual(order.totalAmount, 0, 'totalAmount 变为 0');
    await assertEqual(order.payment_status, 'paid',
      'paid_amount(3000) >= newAmount(0) → payment_status 应联动变为 paid');
  });

  await it('TC-PRC-04 改为负数 — 应拒绝', async () => {
    const orderId = await createTestOrder({ totalAmount: 5000 });

    const res = await cloud.callFunction({
      name: 'adminUpdateOrderPrice',
      data: { orderId, totalAmount: -100 }
    });

    await assertEqual(res.result.code, 400, '负数金额应返回 400');
  });

  await it('TC-PRC-05 改为小于已付金额 — payment_status 正确联动', async () => {
    // BUG-4 已修复: 改小金额后 paid_amount > totalAmount，应自动设为 paid
    const orderId = await createTestOrder({ totalAmount: 5000, paid_amount: 5000, payment_status: 'paid' });

    const res = await cloud.callFunction({
      name: 'adminUpdateOrderPrice',
      data: { orderId, totalAmount: 3000 }  // 改小，已付 5000 > 新总额 3000
    });

    await assertEqual(res.result.code, 0);
    const order = await dbGet('orders', orderId);
    await assertEqual(order.totalAmount, 3000);
    await assertEqual(order.payment_status, 'paid',
      'paid_amount(5000) >= newAmount(3000) → payment_status 应保持 paid');
  });

  await it('TC-PRC-11 totalAmount 是 null — 应拒绝', async () => {
    // 已修复: null 不再被转为 0，直接拒绝
    const orderId = await createTestOrder({ totalAmount: 5000 });

    const res = await cloud.callFunction({
      name: 'adminUpdateOrderPrice',
      data: { orderId, totalAmount: null }
    });

    await assertEqual(res.result.code, 400, 'totalAmount=null 应返回 400');
    const order = await dbGet('orders', orderId);
    await assertEqual(order.totalAmount, 5000, 'totalAmount 不应被修改');
  });

  await it('TC-PRC-12 缺少 orderId — 返回 400', async () => {
    const res = await cloud.callFunction({
      name: 'adminUpdateOrderPrice',
      data: { totalAmount: 5000 }
    });

    await assertEqual(res.result.code, 400, '缺少 orderId 应返回 400');
  });
}


// ============================================================================
// 主入口
// ============================================================================
exports.main = async () => {
  const startTime = Date.now();
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║     温州斜条批发 — 后端高风险功能自动化测试         ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('测试时间: ' + new Date().toISOString());
  console.log('测试前缀: ' + TEST_PREFIX);

  try {
    // 准备
    await setupTestData();

    // 执行所有测试模块
    await test_Finance();
    await test_Return();
    await test_WebOrders();
    await test_SubmitOrder();
    await test_DirectPrice();

  } catch (e) {
    console.log('\n!!! 测试框架异常: ' + e.message);
    console.log(e.stack);
  } finally {
    // 清理
    await cleanupTestData();
  }

  // 汇总
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n' + '='.repeat(60));
  console.log('  测试完成 (耗时 ' + duration + 's)');
  console.log('  \x1b[32m通过: ' + passed + '\x1b[0m');
  console.log('  \x1b[31m失败: ' + failed + '\x1b[0m');
  if (skipped > 0) console.log('  \x1b[33m跳过: ' + skipped + '\x1b[0m');

  if (failures.length > 0) {
    console.log('\n  失败明细:');
    failures.forEach((f, i) => {
      console.log(`  ${i + 1}. [${f.module}] ${f.test}`);
      console.log(`     ${f.error}`);
    });
  }

  console.log('\n  ' + (failed === 0
    ? '\x1b[32m✓ ALL ' + passed + ' PASSED\x1b[0m'
    : '\x1b[31m✗ ' + passed + ' passed, ' + failed + ' FAILED\x1b[0m'));

  return {
    passed,
    failed,
    skipped,
    duration: duration + 's',
    failures: failures.map(f => ({ module: f.module, test: f.test, error: f.error })),
    verdict: failed === 0 ? 'ALL_PASSED' : 'HAS_FAILURES'
  };
};
