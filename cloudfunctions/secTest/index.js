/**
 * 后端安全渗透测试套件 (Security Penetration Test Suite)
 *
 * 站在攻击者角度测试 8 大类安全漏洞：
 *   1. 数据越权 (IDOR)          — 访问/修改他人数据
 *   2. 功能越权 (Privilege Escalation) — 低权限调用高权限接口
 *   3. 身份认证 (Auth Bypass)   — 无登录/伪造凭证
 *   4. 偷改字段 (Mass Assignment) — 额外字段注入
 *   5. 恶意输入 (Injection)     — XSS / NoSQL / Command 注入
 *   6. 绕过前端 (Frontend Bypass) — 直接调接口跳过前端校验
 *   7. 敏感信息泄露 (Info Leak)  — 密码/密钥/他人手机号
 *   8. 资源滥用 (Rate Limit)     — 高频/高并发请求
 *
 * 运行方式:
 *   方法一（推荐）: tcb fn invoke secTest --env-id cloudbase-d6g98vaoyb7ec331a
 *   方法二: bash test-security.sh
 *
 * 注意: 本测试会真枪实弹对接口发起攻击性请求。
 *       所有测试数据带 TEST_SEC_ 前缀，结束后自动清理。
 *
 * 结果解读:
 *   最后一行是汇总。测试失败 = 发现漏洞，需要紧急修复。
 */

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const https = require('https');

// ============================================================================
// 配置
// ============================================================================
const HTTP_HOST = 'cloudbase-d6g98vaoyb7ec331a.service.tcloudbase.com';
const TEST_PREFIX = 'TEST_SEC_' + Date.now() + '_';

// 全局状态
let adminJwt = '';        // 管理员 JWT
let deliveryJwt = '';     // 配送员 JWT
let testOpenid = '';      // 普通用户 OPENID
let testAdminUser = '';
let testDeliveryUser = '';
let testPwd = 'SecTest@123';
let testOrderIds = [];    // 创建的测试订单
let testProductIds = [];  // 创建的测试产品
let testAdminIds = [];    // 创建的测试管理员（需清理）

// 统计
let passed = 0, failed = 0;
let currentModule = '';
const vulnerabilities = [];

// ============================================================================
// 微型测试框架
// ============================================================================
function module(name) {
  currentModule = name;
  console.log('\n' + '='.repeat(66));
  console.log('  ' + name);
  console.log('='.repeat(66));
}

async function it(name, fn) {
  try {
    await fn();
    passed++;
    console.log('  \x1b[32mPASS\x1b[0m ' + name);
  } catch (e) {
    failed++;
    console.log('  \x1b[31mFAIL\x1b[0m ' + name);
    console.log('        \x1b[31m' + e.message + '\x1b[0m');
    vulnerabilities.push({ module: currentModule, test: name, detail: e.message });
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertContains(haystack, needle, label) {
  if (!haystack || !haystack.includes(needle)) {
    throw new Error(`${label}: expected to contain "${needle}"`);
  }
}

function assertNotContains(haystack, needle, label) {
  if (haystack && haystack.includes(needle)) {
    throw new Error(`${label}: found forbidden "${needle}" — LEAK!`);
  }
}

function assertStatus(res, expected, label) {
  if (res.status !== expected) {
    throw new Error(`${label}: expected HTTP ${expected}, got ${res.status}, body: ${JSON.stringify(res.body).substring(0, 200)}`);
  }
}

// ============================================================================
// HTTP 工具
// ============================================================================
function httpRequest(method, path, token, body, extraHeaders) {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json', ...(extraHeaders || {}) };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const options = {
      hostname: HTTP_HOST,
      path: '/api/admin' + path,
      method,
      headers,
      timeout: 15000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, headers: res.headers, body: data }); }
      });
    });
    req.on('error', (e) => reject(new Error('HTTP error: ' + e.message)));
    req.on('timeout', () => { req.destroy(); reject(new Error('HTTP timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// 调用云函数
async function callFn(name, data) {
  try {
    const r = await cloud.callFunction({ name, data });
    return r.result;
  } catch (e) {
    return { error: e.message, _exception: true };
  }
}

// ============================================================================
// DB 工具
// ============================================================================
async function dbGet(collection, id) {
  const r = await db.collection(collection).doc(id).get();
  return r.data;
}

async function dbCleanup(collection, prefix) {
  try {
    const res = await db.collection(collection)
      .where({ name: db.RegExp({ regexp: '^' + prefix, options: 'i' }) })
      .limit(100).get();
    for (const item of res.data) {
      try { await db.collection(collection).doc(item._id).remove(); } catch (e) {}
    }
  } catch (e) {}
}

// ============================================================================
// 测试数据准备
// ============================================================================
async function setup() {
  console.log('\n>>> 准备测试环境...\n');

  // 获取 OPENID
  try { testOpenid = cloud.getWXContext().OPENID || 'sec-test-openid'; }
  catch (e) { testOpenid = 'sec-test-openid'; }
  console.log('  OPENID: ' + testOpenid);

  // 创建测试产品
  for (const p of [
    { name: TEST_PREFIX + '安全测试产品A', category: '色丁', price: 2000, unit: '米', stock: 50, status: 'sufficient' },
    { name: TEST_PREFIX + '安全测试产品B', category: '全棉', price: 800, unit: '米', stock: 30, status: 'sufficient' },
  ]) {
    const r = await db.collection('products').add({
      data: { ...p, description: 'security test', createdAt: db.serverDate(), updatedAt: db.serverDate() }
    });
    testProductIds.push(r._id);
  }
  console.log('  产品: ' + testProductIds.length + ' 个');

  // 创建测试管理员（直接写 DB）
  const pwHash = require('./passwordHash');
  const { salt, hash } = pwHash.hashPassword(testPwd);

  testAdminUser = TEST_PREFIX + 'admin';
  const adminRes = await db.collection('admins').add({
    data: { username: testAdminUser, nickname: 'SecAdmin', role: 'manager',
      passwordHash: hash, salt, status: 'active', createdAt: db.serverDate(), updatedAt: db.serverDate() }
  });
  testAdminIds.push(adminRes._id);
  console.log('  管理员: ' + testAdminUser);

  testDeliveryUser = TEST_PREFIX + 'delivery';
  const deliveryRes = await db.collection('admins').add({
    data: { username: testDeliveryUser, nickname: 'SecDelivery', role: 'delivery',
      passwordHash: hash, salt, status: 'active', createdAt: db.serverDate(), updatedAt: db.serverDate() }
  });
  testAdminIds.push(deliveryRes._id);
  console.log('  配送员: ' + testDeliveryUser);

  // 登录获取 JWT
  const adminLogin = await httpRequest('POST', '/login', '', { username: testAdminUser, password: testPwd });
  adminJwt = adminLogin.body?.data?.token || '';
  console.log('  管理员 JWT: ' + (adminJwt ? 'OK (' + adminJwt.substring(0, 20) + '...)' : 'FAILED'));

  const deliveryLogin = await httpRequest('POST', '/login', '', { username: testDeliveryUser, password: testPwd });
  deliveryJwt = deliveryLogin.body?.data?.token || '';
  console.log('  配送员 JWT: ' + (deliveryJwt ? 'OK (' + deliveryJwt.substring(0, 20) + '...)' : 'FAILED'));

  // 创建测试订单（通过调用 submitOrder 云函数）
  try {
    const orderResult = await callFn('submitOrder', {
      customerName: TEST_PREFIX + '张三',
      phone: '13800138000',
      address: '测试地址',
      items: [{ productId: testProductIds[0], name: '产品A', price: 2000, quantity: 2, unit: '米' }],
      totalAmount: 4000,
      deliveryMethod: 'delivery',
      remark: '安全测试订单'
    });
    if (orderResult?.data?.orderId) {
      testOrderIds.push(orderResult.data.orderId);
      console.log('  测试订单: ' + orderResult.data.orderId);
    } else {
      console.log('  测试订单: 创建失败 (使用直接写入)');
      const directOrder = await db.collection('orders').add({
        data: {
          _openid: testOpenid,
          customerName: TEST_PREFIX + '张三',
          phone: '13800138000',
          address: '测试地址',
          items: [{ productId: testProductIds[0], name: '产品A', price: 2000, quantity: 2, unit: '米' }],
          totalAmount: 4000,
          deliveryMethod: 'delivery',
          paid_amount: 0,
          payment_status: 'unpaid',
          status: 'processing',
          remark: '安全测试订单',
          createdAt: db.serverDate()
        }
      });
      testOrderIds.push(directOrder._id);
      console.log('  测试订单(DB): ' + directOrder._id);
    }
  } catch (e) {
    console.log('  测试订单创建异常: ' + e.message);
    // 直接写 DB 保底
    const directOrder = await db.collection('orders').add({
      data: {
        _openid: testOpenid,
        customerName: TEST_PREFIX + '张三',
        phone: '13800138000',
        address: '测试地址',
        items: [{ productId: testProductIds[0], name: '产品A', price: 2000, quantity: 2, unit: '米' }],
        totalAmount: 4000, deliveryMethod: 'delivery', paid_amount: 0,
        payment_status: 'unpaid', status: 'processing',
        remark: '安全测试订单', createdAt: db.serverDate()
      }
    });
    testOrderIds.push(directOrder._id);
    console.log('  测试订单(保底): ' + directOrder._id);
  }
}

// ============================================================================
// 测试用例
// ============================================================================

// ---------------------------------------------------------------------------
// 模块一：身份认证 (Authentication Bypass)
// ---------------------------------------------------------------------------
async function testAuthBypass() {
  module('1. 身份认证绕过 (Authentication Bypass)');

  await it('1.1 无 Token 访问管理接口 → 应返回 401', async () => {
    const r = await httpRequest('GET', '/orders', '', null);
    assertStatus(r, 401, '无Token访问/orders');
    assertEqual(r.body?.code, 401, '错误码应为401');
  });

  await it('1.2 空 Token 访问管理接口 → 应返回 401', async () => {
    const r = await httpRequest('GET', '/orders', ' ', null);
    assertStatus(r, 401, '空Token访问/orders');
  });

  await it('1.3 伪造 Token 访问管理接口 → 应返回 401', async () => {
    const r = await httpRequest('GET', '/orders',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjoiZmFrZSJ9.fakesignature', null);
    assertStatus(r, 401, '伪造Token访问/orders');
  });

  await it('1.4 伪造 role=manager 的 Token → 应被拒绝', async () => {
    // 自签 JWT 不太可能成功，但值得验证
    const fakeToken = 'eyJhbGciOiJIUzI1NiJ9.' +
      Buffer.from(JSON.stringify({ username: 'hacker', role: 'manager', exp: Date.now()/1000 + 3600 })).toString('base64') +
      '.fakesig';
    const r = await httpRequest('GET', '/orders', fakeToken, null);
    assertStatus(r, 401, '自签manager Token应被拒绝');
  });

  await it('1.5 错误密码登录 → 应返回 401 而非区分用户是否存在', async () => {
    const r = await httpRequest('POST', '/login', '', {
      username: testAdminUser, password: 'WrongPassword999'
    });
    assertStatus(r, 401, '错误密码应返回401');
    // 不应泄露账号是否存在
    assertEqual(r.body?.msg, '账号或密码错误', '错误消息应统一');
  });

  await it('1.6 不存在的用户登录 → 应返回同样的 401', async () => {
    const r = await httpRequest('POST', '/login', '', {
      username: 'nonexistent_user_' + Date.now(), password: 'anything'
    });
    assertStatus(r, 401, '不存在的用户应返回401');
    assertEqual(r.body?.msg, '账号或密码错误', '错误消息应与错误密码一致');
  });
}

// ---------------------------------------------------------------------------
// 模块二：功能越权 (Vertical Privilege Escalation)
// ---------------------------------------------------------------------------
async function testPrivilegeEscalation() {
  module('2. 功能越权 (Privilege Escalation)');

  await it('2.1 配送员访问财务数据 → 应返回 403', async () => {
    const r = await httpRequest('GET', '/finance', deliveryJwt, null);
    assertStatus(r, 403, '配送员访问/finance');
  });

  await it('2.2 配送员访问管理员列表 → 应返回 403', async () => {
    const r = await httpRequest('GET', '/admins', deliveryJwt, null);
    assertStatus(r, 403, '配送员访问/admins');
  });

  await it('2.3 配送员修改订单金额 → 应返回 403', async () => {
    if (testOrderIds.length === 0) throw new Error('无可用测试订单');
    const r = await httpRequest('PUT', '/orders/' + testOrderIds[0], deliveryJwt, {
      totalAmount: 100
    });
    assertStatus(r, 403, '配送员修改订单金额');
  });

  await it('2.4 配送员批量完成订单 → 应返回 403', async () => {
    const r = await httpRequest('POST', '/orders/batch', deliveryJwt, {
      ids: testOrderIds, action: 'complete'
    });
    assertStatus(r, 403, '配送员批量操作');
  });

  await it('2.5 配送员设置付款状态 → 应返回 403', async () => {
    if (testOrderIds.length === 0) throw new Error('无可用测试订单');
    const r = await httpRequest('PUT', '/orders/' + testOrderIds[0], deliveryJwt, {
      payment_status: 'paid'
    });
    assertStatus(r, 403, '配送员修改付款状态');
  });

  await it('2.6 未登录用户调用云函数 adminUpdateOrderPrice → 应被拒绝', async () => {
    if (testOrderIds.length === 0) throw new Error('无可用测试订单');
    const r = await callFn('adminUpdateOrderPrice', {
      orderId: testOrderIds[0], totalAmount: 100
    });
    // 小程序云函数通过 auth 模块验证，未登录应返回错误
    const isRejected = r?.code !== 0 || r?.error || !r?.ok;
    assertEqual(isRejected, true, '未登录调用adminUpdateOrderPrice应被拒绝');
  });

  await it('2.7 配送员尝试通过非 manager 角色创建管理员 → 应被拒绝', async () => {
    // 配送员的 role 不是 manager，调用 adminWebAdmins 应返回 403
    const r = await httpRequest('POST', '/admins', deliveryJwt, {
      username: 'hacker_admin', password: 'Hack1234', role: 'manager'
    });
    // 可能返回 403（路由拦截）或成功但写入时受角色限制
    const blocked = r.status === 403 || r.body?.code === 403;
    assertEqual(blocked, true, '配送员创建管理员应被拦截');
  });
}

// ---------------------------------------------------------------------------
// 模块三：数据越权 (IDOR)
// ---------------------------------------------------------------------------
async function testIDOR() {
  module('3. 数据越权 (IDOR - Insecure Direct Object Reference)');

  await it('3.1 无 JWT 直接查看订单详情 → 应返回 401', async () => {
    if (testOrderIds.length === 0) throw new Error('无可用测试订单');
    const r = await httpRequest('GET', '/orders/' + testOrderIds[0], '', null);
    assertStatus(r, 401, '无Token查看订单详情');
  });

  await it('3.2 尝试通过 getMyOrders 获取他人订单 → 应只返回自己的', async () => {
    const r = await callFn('getMyOrders', {});
    // 返回的订单应该都属于当前用户的 OPENID
    if (r?.orders && Array.isArray(r.orders)) {
      for (const o of r.orders) {
        if (o._openid !== testOpenid) {
          throw new Error('getMyOrders 返回了他人的订单！IDOR漏洞！订单ID: ' + o._id);
        }
      }
    }
  });

  await it('3.3 尝试取消不属于自己的订单 → 应被拒绝', async () => {
    // 先获取一个另一个用户的订单 ID（如果存在的话）
    // 这里用一个不存在的但格式正确的订单ID
    const fakeOrderId = '0123456789abcdef01234567'; // 合法格式，但不是当前用户的
    const r = await callFn('cancelOrder', { orderId: fakeOrderId });
    // 应返回错误（订单不存在或无权限）
    const isRejected = r?.code !== 0;
    assertEqual(isRejected, true, '取消他人订单应被拒绝');
  });

  await it('3.4 尝试修改不属于自己的订单信息 → 应被拒绝', async () => {
    const fakeOrderId = '0123456789abcdef01234567';
    const r = await callFn('updateOrder', {
      orderId: fakeOrderId, address: '黑客地址'
    });
    const isRejected = r?.code !== 0;
    assertEqual(isRejected, true, '修改他人订单应被拒绝');
  });

  await it('3.5 配送员尝试查看不属自己配送范围的订单详情 → 应返回 403', async () => {
    if (testOrderIds.length === 0) throw new Error('无可用测试订单');
    // 测试订单 deliveryMethod=delivery，配送员(role=delivery) 应该能看
    // 但 logistics 订单配送员不能看
    // 先改订单为 logistics 测试
    await db.collection('orders').doc(testOrderIds[0]).update({
      data: { deliveryMethod: 'logistics', updatedAt: db.serverDate() }
    });
    const r = await httpRequest('GET', '/orders/' + testOrderIds[0], deliveryJwt, null);
    // 配送员(delivery) 不应能查看 logistics 订单
    assertStatus(r, 403, '配送员查看logistics订单应返回403');
    // 恢复
    await db.collection('orders').doc(testOrderIds[0]).update({
      data: { deliveryMethod: 'delivery', updatedAt: db.serverDate() }
    });
  });
}

// ---------------------------------------------------------------------------
// 模块四：偷改字段 (Mass Assignment)
// ---------------------------------------------------------------------------
async function testMassAssignment() {
  module('4. 偷改字段 (Mass Assignment)');

  await it('4.1 登录时尝试注入 role=manager → 应被忽略', async () => {
    const r = await httpRequest('POST', '/login', '', {
      username: testDeliveryUser, password: testPwd, role: 'manager'
    });
    if (r.body?.data?.token) {
      // 用这个 token 尝试访问管理员接口
      const injectedJwt = r.body.data.token;
      const adminCheck = await httpRequest('GET', '/admins', injectedJwt, null);
      // 如果成功了说明 role 注入有效
      assertStatus(adminCheck, 403, '注入role=manager的token不应有管理员权限');
    }
  });

  await it('4.2 创建订单时注入 status=completed → 应被忽略', async () => {
    // submitOrder 固定 status='processing'
    const r = await callFn('submitOrder', {
      customerName: TEST_PREFIX + '注入测试',
      phone: '13900000001',
      address: '测试地址',
      items: [{ productId: testProductIds[0], name: '产品A', price: 2000, quantity: 1, unit: '米' }],
      totalAmount: 2000,
      status: 'completed',  // 企图注入
      paid_amount: 999999   // 企图注入
    });
    // 如果订单创建成功，验证 status 是否是 processing
    if (r?.data?.orderId) {
      testOrderIds.push(r.data.orderId); // 加入清理列表
      const order = await dbGet('orders', r.data.orderId);
      if (order) {
        assertEqual(order.status, 'processing', '注入status=completed应被忽略');
        assertEqual(order.payment_status, 'unpaid', '注入paid_amount应被忽略');
      }
    }
  });

  await it('4.3 修改订单时尝试注入 role 字段 → 应无影响', async () => {
    if (testOrderIds.length === 0) throw new Error('无可用测试订单');
    const r = await httpRequest('PUT', '/orders/' + testOrderIds[0], adminJwt, {
      customerName: '合法修改',
      _id: 'malicious_new_id' // 尝试修改ID
    });
    // 应成功但 _id 字段不应被修改
    if (r.status === 200) {
      const order = await dbGet('orders', testOrderIds[0]);
      assertEqual(order.customerName, '合法修改', '正常修改应生效');
      assertEqual(order._id, testOrderIds[0], '_id不应被修改');
    }
  });

  await it('4.4 管理员创建时注入 status=deleted → 应被拒绝', async () => {
    const r = await httpRequest('POST', '/admins', adminJwt, {
      username: TEST_PREFIX + 'hack_status',
      password: 'Hack@1234',
      role: 'delivery',
      status: 'deleted'  // 非法状态，修复后应有校验
    });
    // 修复后应返回 400（状态值无效）
    if (r.status === 200) {
      throw new Error('注入非法status=deleted未被拦截！需要修复 adminWebAdmins 状态校验');
    }
  });

  await it('4.5 修改产品价格时尝试注入负数 → 应被拒绝', async () => {
    if (testProductIds.length === 0) return;
    const r = await httpRequest('PUT', '/products/' + testProductIds[0], adminJwt, {
      _id: testProductIds[0], price: -100
    });
    assertStatus(r, 400, '负数价格应返回400');
  });
}

// ---------------------------------------------------------------------------
// 模块五：恶意输入与注入 (Injection)
// ---------------------------------------------------------------------------
async function testInjection() {
  module('5. 恶意输入与注入 (Injection Attacks)');

  await it('5.1 XSS: 订单客户名注入 script 标签 → 应被清洗', async () => {
    const r = await callFn('submitOrder', {
      customerName: '<script>alert("XSS")</script>',
      phone: '13900000002',
      address: '测试地址',
      items: [{ productId: testProductIds[0], name: '产品A', price: 2000, quantity: 1, unit: '米' }],
      totalAmount: 2000
    });
    if (r?.data?.orderId) {
      testOrderIds.push(r.data.orderId);
      const order = await dbGet('orders', r.data.orderId);
      if (order) {
        const cleaned = order.customerName || '';
        assertNotContains(cleaned, '<script>', 'XSS script标签应被清洗');
        assertNotContains(cleaned, 'alert', 'XSS alert应被清洗');
      }
    }
  });

  await it('5.2 XSS: 备注注入 onerror 事件 → 应被清洗', async () => {
    const r = await callFn('submitOrder', {
      customerName: TEST_PREFIX + '事件注入',
      phone: '13900000003',
      address: '<img src=x onerror=alert(1)>',
      items: [{ productId: testProductIds[0], name: '产品A', price: 2000, quantity: 1, unit: '米' }],
      totalAmount: 2000,
      remark: '<img src=x onerror=alert(1)>'
    });
    if (r?.data?.orderId) {
      testOrderIds.push(r.data.orderId);
      const order = await dbGet('orders', r.data.orderId);
      if (order) {
        const addr = order.address || '';
        const remark = order.remark || '';
        assertNotContains(addr, 'onerror', '地址中onerror应被清洗');
        assertNotContains(remark, 'onerror', '备注中onerror应被清洗');
      }
    }
  });

  await it('5.3 NoSQL 注入: 搜索参数传入 $gt 操作符 → 应被类型检查拦截', async () => {
    // 尝试通过查询参数传入 NoSQL 操作符
    // safeKeyword 会将非字符串类型转为空串
    const r = await httpRequest('GET', '/orders?keyword[$gt]=', adminJwt, null);
    // 应正常返回（查询参数被当作字符串）或返回错误
    // 关键是不应泄露全部数据
    const ok = r.status === 200 || r.status === 400;
    assertEqual(ok, true, 'NoSQL注入应被正常处理而非报错500');
  });

  await it('5.4 SQL 注入: 登录用户名尝试注入 OR 1=1 → 应被安全处理', async () => {
    const r = await httpRequest('POST', '/login', '', {
      username: "' OR '1'='1", password: "' OR '1'='1"
    });
    // 应返回 401，不是数据库错误
    assertStatus(r, 401, 'SQL注入尝试应返回401');
  });

  await it('5.5 超长输入: 客户名 10000 字符 → 不应导致崩溃', async () => {
    const longName = 'A'.repeat(10000);
    const r = await callFn('submitOrder', {
      customerName: longName,
      phone: '13900000004',
      address: '测试地址',
      items: [{ productId: testProductIds[0], name: '产品A', price: 2000, quantity: 1, unit: '米' }],
      totalAmount: 2000
    });
    // 不应返回 500 内部错误
    const isNot500 = !r?._exception && (typeof r?.code === 'number');
    assertEqual(isNot500, true, '超长输入不应导致服务端崩溃');
  });

  await it('5.6 Unicode 字符: 客户名使用特殊 Unicode → 应正常处理', async () => {
    const r = await callFn('submitOrder', {
      customerName: '😀🎉 测试\x00客户',
      phone: '13900000005',
      address: '测试地址',
      items: [{ productId: testProductIds[0], name: '产品A', price: 2000, quantity: 1, unit: '米' }],
      totalAmount: 2000
    });
    // 不应崩溃
    const notCrash = !r?._exception;
    assertEqual(notCrash, true, '特殊Unicode不应导致崩溃');
    if (r?.data?.orderId) testOrderIds.push(r.data.orderId);
  });
}

// ---------------------------------------------------------------------------
// 模块六：绕过前端限制 (Frontend Bypass)
// ---------------------------------------------------------------------------
async function testFrontendBypass() {
  module('6. 绕过前端限制 (Frontend Bypass)');

  await it('6.1 直接调用 API 创建价格为 0 的订单 → 应被服务端验算拦截', async () => {
    const r = await callFn('submitOrder', {
      customerName: TEST_PREFIX + '零元购',
      phone: '13900000006',
      address: '测试地址',
      items: [{ productId: testProductIds[0], name: '产品A', price: 2000, quantity: 1, unit: '米' }],
      totalAmount: 0  // 前端会校验价格，但直接调 API 绕过
    });
    // 服务端应验算发现价格不匹配
    const isRejected = r?.code !== 0;
    assertEqual(isRejected, true, '价格为0的订单应被服务端拒绝');
  });

  await it('6.2 直接调 API 创建负数金额订单 → 应被拒绝', async () => {
    const r = await callFn('submitOrder', {
      customerName: TEST_PREFIX + '负价订单',
      phone: '13900000007',
      address: '测试地址',
      items: [{ productId: testProductIds[0], name: '产品A', price: 2000, quantity: 1, unit: '米' }],
      totalAmount: -5000
    });
    const isRejected = r?.code !== 0;
    assertEqual(isRejected, true, '负数金额订单应被拒绝');
  });

  await it('6.3 绕过前端字段长度限制 → 服务端应有基本校验', async () => {
    const r = await httpRequest('PUT', '/orders/' + (testOrderIds[0] || 'fake'), adminJwt, {
      customerName: 'A'.repeat(5000),
      phone: '1'.repeat(2000),
      address: 'X'.repeat(10000)
    });
    // 不应返回 500
    assertEqual(r.status !== 500, true, '前端绕过超长字段不应返回500');
  });

  await it('6.4 直接 POST JSON 而非前端 form → 应正常处理', async () => {
    const r = await httpRequest('POST', '/login', '', { username: 'test', password: 'test' });
    // 应正常响应（不会崩溃，返回401）
    const ok = r.status === 401 || r.status === 400;
    assertEqual(ok, true, 'JSON格式登录不应崩溃');
  });
}

// ---------------------------------------------------------------------------
// 模块七：敏感信息泄露 (Information Disclosure)
// ---------------------------------------------------------------------------
async function testInfoLeak() {
  module('7. 敏感信息泄露 (Information Disclosure)');

  await it('7.1 登录响应不应返回密码哈希', async () => {
    const r = await httpRequest('POST', '/login', '', {
      username: testAdminUser, password: testPwd
    });
    const body = JSON.stringify(r.body);
    assertNotContains(body, 'passwordHash', '响应不应含passwordHash');
    assertNotContains(body, 'password', '响应不应含password字段');
    assertNotContains(body, 'salt', '响应不应含salt');
  });

  await it('7.2 订单列表不应返回用户的 _openid', async () => {
    const r = await httpRequest('GET', '/orders?pageSize=5', adminJwt, null);
    if (r.status === 200 && r.body?.data?.list) {
      for (const o of r.body.data.list) {
        assertEqual(o._openid === undefined, true, '订单列表不应暴露_openid: ' + (o._id || ''));
      }
    }
  });

  await it('7.3 非管理员查看订单应脱敏手机号', async () => {
    if (testOrderIds.length === 0) throw new Error('无可用测试订单');
    const r = await httpRequest('GET', '/orders/' + testOrderIds[0], deliveryJwt, null);
    if (r.status === 200 && r.body?.data?.record) {
      const phone = r.body.data.record.phone || '';
      // 脱敏后应包含 ****
      assertContains(phone, '****', '配送员看到的手机号应脱敏含****');
    }
  });

  await it('7.4 错误响应不应暴露堆栈信息', async () => {
    const r = await httpRequest('GET', '/orders/notavalidid%%%', adminJwt, null);
    const body = JSON.stringify(r.body);
    assertNotContains(body, 'Error:', '错误响应不应含Error堆栈');
    assertNotContains(body, 'at ', '错误响应不应含调用栈');
    assertNotContains(body, 'node_modules', '错误响应不应暴露node_modules路径');
  });

  await it('7.5 管理员列表不应返回密码信息', async () => {
    const r = await httpRequest('GET', '/admins', adminJwt, null);
    if (r.status === 200) {
      const body = JSON.stringify(r.body);
      assertNotContains(body, 'passwordHash', '管理员列表不应含passwordHash');
      assertNotContains(body, 'salt', '管理员列表不应含salt');
    }
  });

  await it('7.6 云函数调用不应在错误消息中泄露内部路径', async () => {
    // 故意传错误的参数看返回
    const r = await callFn('submitOrder', { invalidField: true });
    const msg = JSON.stringify(r);
    assertNotContains(msg, '/cloudfunctions/', '错误消息不应含文件路径');
    assertNotContains(msg, 'node_modules', '错误消息不应暴露依赖');
  });
}

// ---------------------------------------------------------------------------
// 模块八：资源滥用与防刷 (Rate Limiting)
// ---------------------------------------------------------------------------
async function testRateLimit() {
  module('8. 资源滥用与防刷 (Rate Limiting & DoS)');

  await it('8.1 高频登录请求 → 应被限流', async () => {
    // 连续发送 15 次错误密码登录请求
    let blocked = false;
    for (let i = 0; i < 15; i++) {
      const r = await httpRequest('POST', '/login', '', {
        username: TEST_PREFIX + 'ratetest', password: 'wrong'
      });
      if (r.status === 429) {
        blocked = true;
        console.log('\n        第' + (i+1) + '次被限流拦截 (HTTP 429)');
        break;
      }
    }
    assertEqual(blocked, true, '高频登录应触发限流 (HTTP 429)');
  });

  await it('8.2 高频下订单请求 → 应被限流', async () => {
    // submitOrder 限流为每分钟5单
    let blocked = false;
    let createdCount = 0;
    let errorCount = 0;
    for (let i = 0; i < 8; i++) {
      const r = await callFn('submitOrder', {
        customerName: TEST_PREFIX + '压测' + i,
        phone: '13900000010',
        address: '压测地址',
        items: [{ productId: testProductIds[0], name: '产品A', price: 2000, quantity: 1, unit: '米' }],
        totalAmount: 2000
      });
      if (r?.data?.orderId) {
        testOrderIds.push(r.data.orderId);
        createdCount++;
      } else if (r?.code !== 0) {
        errorCount++;
        if (createdCount >= 5) blocked = true; // 第6+次被拒才是真限流
      }
    }
    // 如果成功创建超5个且未被拦截，限流未生效
    if (createdCount > 5 && !blocked) {
      throw new Error('限流未生效！创建了 ' + createdCount + ' 个订单，预期最多5个/分钟');
    }
    // 如果一个都没创建成功，可能是模块缺失（不算真限流）
    if (createdCount === 0) {
      console.log('        注意: 未能创建任何订单，可能是rateLimiter模块未部署');
      throw new Error('submitOrder 缺少 rateLimiter 模块，请先部署');
    }
    console.log('        创建 ' + createdCount + ' 个后触发限流拦截');
  });

  await it('8.3 并发写同一订单（竞态检测）→ paid_amount 应正确', async () => {
    if (testOrderIds.length === 0) throw new Error('无可用测试订单');
    const orderId = testOrderIds[0];
    // 先确保订单payment_status是unpaid
    await db.collection('orders').doc(orderId).update({
      data: { paid_amount: 0, payment_status: 'unpaid', updatedAt: db.serverDate() }
    });
    // 发送3个并发收款请求
    const payments = await Promise.all([
      httpRequest('POST', '/finance/payment', adminJwt, { orderId, amount: 100 }),
      httpRequest('POST', '/finance/payment', adminJwt, { orderId, amount: 100 }),
      httpRequest('POST', '/finance/payment', adminJwt, { orderId, amount: 100 }),
    ]);
    // 读取最终状态
    const order = await dbGet('orders', orderId);
    if (order) {
      // 使用 _.inc() 后，并发安全，paid_amount 应为 300 (元) * 100 = 30000 (分)
      // 注意 amount 是元，amountInCents = amount * 100
      const expectedPaid = 300 * 100; // 3 x 100元 = 30000分
      assertEqual(order.paid_amount, expectedPaid, '并发收款应正确累加（原子递增）');
    }
  });
}

// ============================================================================
// 清理
// ============================================================================
async function cleanup() {
  console.log('\n>>> 清理测试数据...');

  // 删除测试订单
  for (const id of testOrderIds) {
    try { await db.collection('orders').doc(id).remove(); } catch (e) {}
  }
  console.log('  删除 ' + testOrderIds.length + ' 个测试订单');

  // 删除测试产品
  for (const id of testProductIds) {
    try { await db.collection('products').doc(id).remove(); } catch (e) {}
  }
  console.log('  删除 ' + testProductIds.length + ' 个测试产品');

  // 删除测试管理员
  for (const id of testAdminIds) {
    try { await db.collection('admins').doc(id).remove(); } catch (e) {}
  }
  console.log('  删除 ' + testAdminIds.length + ' 个测试管理员');

  // 清理其他 TEST_SEC_ 前缀的残留数据
  await dbCleanup('orders', 'TEST_SEC_');
  await dbCleanup('products', 'TEST_SEC_');
  await dbCleanup('admins', 'TEST_SEC_');
  await dbCleanup('customers', 'TEST_SEC_');
}

// ============================================================================
// 主入口
// ============================================================================
exports.main = async (event) => {
  const startTime = Date.now();
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║      后端安全渗透测试套件 (Security Penetration Test)       ║');
  console.log('║      ' + new Date().toISOString() + '                           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  // 准备测试环境
  try {
    await setup();
  } catch (e) {
    console.log('\n!!! 测试环境准备失败: ' + e.message);
    console.log('!!! 部分测试将跳过，继续执行...\n');
  }

  // 执行所有测试模块
  await testAuthBypass();
  await testPrivilegeEscalation();
  await testIDOR();
  await testMassAssignment();
  await testInjection();
  await testFrontendBypass();
  await testInfoLeak();
  await testRateLimit();

  // 清理
  try { await cleanup(); } catch (e) {
    console.log('清理失败: ' + e.message);
  }

  // 汇总报告
  const total = passed + failed;
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                      测试结果汇总                            ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  ' + ('总计: ' + total + ' | 通过: ' + passed + ' | 失败: ' + failed).padEnd(54) + ' ║');
  console.log('║  ' + ('耗时: ' + elapsed + 's').padEnd(54) + ' ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  if (vulnerabilities.length > 0) {
    console.log('\n!!! 发现安全漏洞 ' + vulnerabilities.length + ' 个:');
    for (const v of vulnerabilities) {
      console.log('  [' + v.module + '] ' + v.test);
      console.log('    详情: ' + v.detail);
    }
    console.log('\n!!! 请立即修复以上漏洞后再部署到生产环境 !!!\n');
  } else {
    console.log('\n✓ 所有安全测试通过，未发现已知漏洞。\n');
  }

  return {
    total, passed, failed, elapsed: elapsed + 's',
    vulnerabilities: vulnerabilities.map(v => ({ module: v.module, test: v.test, detail: v.detail })),
    verdict: failed === 0 ? 'SECURE' : 'VULNERABLE'
  };
};
