const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event) => {
  const { action } = event;
  // 仅管理操作需要鉴权（list/add/update/delete）
  if (action !== 'getByPhone' && action !== 'upsert') {
    const wxContext = cloud.getWXContext();
    if (!wxContext.OPENID) return { code: -1, msg: '未登录' };
    const admin = await db.collection('admins').where({ lastLoginOpenid: wxContext.OPENID, loggedIn: true }).get();
    if (admin.data.length === 0) return { code: -1, msg: '无管理员权限' };
  }

  try {
    switch (action) {
      case 'list': {
        const res = await db.collection('customers')
          .orderBy('createdAt', 'desc')
          .limit(200)
          .get();
        return { code: 0, data: res.data };
      }

      case 'getByPhone': {
        const { phone } = event;
        if (!phone) return { code: -1, msg: '手机号不能为空' };
        const res = await db.collection('customers')
          .where({ phone })
          .limit(1)
          .get();
        return { code: 0, data: res.data[0] || null };
      }

      case 'add': {
        const { name, phone, discount } = event;
        const existing = await db.collection('customers').where({ phone }).count();
        if (existing.total > 0) {
          return { code: -1, msg: '该手机号已存在' };
        }
        const res = await db.collection('customers').add({
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
        return { code: 0, data: { _id: res._id } };
      }

      case 'update': {
        const { customerId, name, phone, discount } = event;
        const data = { updatedAt: db.serverDate() };
        if (name !== undefined) data.name = name.trim();
        if (phone !== undefined) data.phone = phone.trim();
        if (discount !== undefined) data.discount = parseFloat(discount);
        await db.collection('customers').doc(customerId).update({ data });
        return { code: 0 };
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
        return { code: 0 };
      }

      case 'delete': {
        const { customerId } = event;
        await db.collection('customers').doc(customerId).remove();
        return { code: 0 };
      }

      default:
        return { code: -1, msg: '未知操作' };
    }
  } catch (err) {
    return { code: -1, msg: err.message };
  }
};
