const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const res = require('./response');
const logger = require('./logger');
const auth = require('./auth');

exports.main = async (event) => {
  const { action } = event;
  // 仅管理操作需要鉴权（list/add/update/delete）
  if (action !== 'getByPhone' && action !== 'upsert') {
    const authResult = auth.requireOpenid();
    const admin = await db.collection('admins').where({ lastLoginOpenid: authResult.openid, loggedIn: true }).get();
    if (admin.data.length === 0) return res.forbidden('无管理员权限');
  }

  try {
    switch (action) {
      case 'list': {
        const page = parseInt(event.page) || 1;
        const pageSize = Math.min(parseInt(event.pageSize) || 20, 100);
        const skip = (page - 1) * pageSize;
        const [countResult, listResult] = await Promise.all([
          db.collection('customers').count(),
          db.collection('customers')
            .orderBy('createdAt', 'desc')
            .skip(skip)
            .limit(pageSize)
            .get()
        ]);
        logger.info('List customers', { page, pageSize, total: countResult.total });
        return res.list(listResult.data, countResult.total, page, pageSize);
      }

      case 'getByPhone': {
        const { phone } = event;
        if (!phone) return res.badRequest('手机号不能为空');
        const result = await db.collection('customers')
          .where({ phone })
          .limit(1)
          .get();
        const customer = result.data[0] || null;
        logger.info('Get customer by phone', { phone, found: !!customer });
        return res.record(customer);
      }

      case 'add': {
        const { name, phone, discount } = event;
        const existing = await db.collection('customers').where({ phone }).count();
        if (existing.total > 0) {
          return res.conflict('该手机号已存在');
        }
        const result = await db.collection('customers').add({
          data: {
            name: name.trim(),
            phone: phone.trim(),
            discount: parseFloat(discount) || 1.0,
            totalOrders: 0,
            totalAmount: 0,
            createdAt: db.serverDate(),
            updatedAt: db.serverDate()
          }
        });
        logger.info('Customer added', { customerId: result._id, phone });
        return res.record({ _id: result._id });
      }

      case 'update': {
        const { customerId, name, phone, discount } = event;
        const data = { updatedAt: db.serverDate() };
        if (name !== undefined) data.name = name.trim();
        if (phone !== undefined) data.phone = phone.trim();
        if (discount !== undefined) data.discount = parseFloat(discount);
        await db.collection('customers').doc(customerId).update({ data });
        logger.info('Customer updated', { customerId });
        return res.ok();
      }

      // 下单后自动录入/更新客户统计
      case 'upsert': {
        const { name: cName, phone: cPhone, orderAmount } = event;
        const existing = await db.collection('customers').where({ phone: cPhone }).limit(1).get();
        if (existing.data.length > 0) {
          const c = existing.data[0];
          await db.collection('customers').doc(c._id).update({
            data: {
              name: cName.trim() || c.name,
              totalOrders: _.inc(1),
              totalAmount: _.inc(Math.round(orderAmount)),
              updatedAt: db.serverDate()
            }
          });
        } else {
          await db.collection('customers').add({
            data: {
              name: cName.trim(),
              phone: cPhone.trim(),
              discount: 1.0,
              totalOrders: 1,
              totalAmount: Math.round(orderAmount),
              createdAt: db.serverDate(),
              updatedAt: db.serverDate()
            }
          });
        }
        logger.info('Customer upserted', { phone: cPhone });
        return res.ok();
      }

      case 'delete': {
        const { customerId } = event;
        await db.collection('customers').doc(customerId).remove();
        logger.info('Customer deleted', { customerId });
        return res.ok();
      }

      default:
        return res.badRequest('未知操作');
    }
  } catch (err) {
    logger.error('customerCRUD error', { error: err.message, action: event.action });
    return res.internalError();
  }
};
