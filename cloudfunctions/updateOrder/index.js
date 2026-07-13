const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const res = require('./response');
const logger = require('./logger');
const auth = require('./auth');

exports.main = async (event) => {
  const { orderId, customerName, phone, address, addressDetail, deliveryMethod, remark, location } = event;

  if (!orderId) {
    return res.badRequest('缺少订单ID');
  }

  try {
    const authResult = await auth.requireOpenid();
    if (!authResult.authorized) return authResult.response;
    const openid = authResult.openid;
    const order = await db.collection('orders').doc(orderId).get();
    if (!order.data) return res.notFound('订单不存在');
    if (order.data._openid !== openid) return res.forbidden('无权操作');

    // 安全限制：已进入处理流程或已付款的订单无法修改
    if (order.data.status !== 'processing') {
      return res.conflict('订单已进入处理流程，无法修改。如需修改请联系管理员');
    }
    if (order.data.payment_status === 'paid') {
      return res.conflict('已付款订单无法修改');
    }

    const data = { updatedAt: db.serverDate() };
    if (customerName !== undefined) data.customerName = customerName.trim();
    if (phone !== undefined) data.phone = phone.trim();
    if (address !== undefined) data.address = address.trim();
    if (addressDetail !== undefined) data.addressDetail = addressDetail.trim();
    if (deliveryMethod !== undefined) {
      const VALID_DELIVERY = ['pickup', 'delivery', 'logistics'];
      data.deliveryMethod = VALID_DELIVERY.includes(deliveryMethod) ? deliveryMethod : 'delivery';
    }
    if (remark !== undefined) data.remark = remark.trim();
    if (location !== undefined) data.location = location;

    // 允许客户修改商品明细和金额（服务端重新验算确保数据完整性）
    if (event.items !== undefined && Array.isArray(event.items) && event.items.length > 0) {
      const items = event.items;
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
      try {
        const customRes = await db.collection('customerPrices')
          .where({ customerPhone: (phone || order.data.phone), productId: db.command.in(productIds) })
          .get();
        customRes.data.forEach(cp => { customPriceMap[cp.productId] = cp.customPrice; });
      } catch (e) { /* customerPrices 集合可能不存在 */ }

      // 重新计算应收金额（分）
      let serverTotal = 0;
      const validatedItems = items.map(item => {
        const prod = priceMap[item.productId];
        const unitPrice = customPriceMap[item.productId] || (prod ? prod.price : (item.price || 0));
        const quantity = item.quantity || 0;
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

      data.items = validatedItems;
      data.totalAmount = serverTotal;
    }

    if (event.images !== undefined) {
      data.images = event.images;
    }
    if (event.logisticsCompany !== undefined) {
      data.logisticsCompany = event.logisticsCompany.trim();
    }

    await db.collection('orders').doc(orderId).update({ data });
    logger.info('updateOrder', { orderId, openid });
    return res.ok();
  } catch (err) {
    logger.error('updateOrder', err, { orderId, openid });
    return res.internalError();
  }
};
