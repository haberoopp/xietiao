const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const res = require('./response');
const logger = require('./logger');
const auth = require('./auth');

exports.main = async (event) => {
  const { action } = event;
  const authResult = await auth.requireOpenid();
  if (!authResult.authorized) return authResult.response;
  const openid = authResult.openid;

  try {
    switch (action) {
      case 'list':
        return await listAddresses(openid, event);
      case 'add':
        return await addAddress(openid, event);
      case 'update':
        return await updateAddress(openid, event);
      case 'delete':
        return await deleteAddress(openid, event);
      case 'setDefault':
        return await setDefault(openid, event);
      default:
        return res.badRequest('未知操作');
    }
  } catch (err) {
    logger.error('addressCRUD error', { error: err.message, action: event.action, openid });
    return res.internalError();
  }
};

async function listAddresses(openid, event) {
  const page = parseInt(event.page) || 1;
  const pageSize = Math.min(parseInt(event.pageSize) || 20, 100);
  const skip = (page - 1) * pageSize;
  const [countResult, listResult] = await Promise.all([
    db.collection('addresses').where({ _openid: openid }).count(),
    db.collection('addresses')
      .where({ _openid: openid })
      .orderBy('isDefault', 'desc')
      .orderBy('updatedAt', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()
  ]);
  logger.info('List addresses', { openid, page, pageSize, total: countResult.total });
  return res.list(listResult.data, countResult.total, page, pageSize);
}

async function addAddress(openid, event) {
  const { name, phone, address, location } = event;
  if (!name || !phone || !address) {
    return res.badRequest('请填写完整信息');
  }

  const count = await db.collection('addresses').where({ _openid: openid }).count();
  const isDefault = count.total === 0;

  const data = {
    _openid: openid,
    name: name.trim(),
    phone: phone.trim(),
    address: address.trim(),
    isDefault,
    createdAt: db.serverDate(),
    updatedAt: db.serverDate()
  };
  if (location) data.location = location;
  if (event.addressDetail) data.addressDetail = event.addressDetail.trim();

  const result = await db.collection('addresses').add({ data });
  logger.info('Address added', { openid, addressId: result._id });
  return res.record({ _id: result._id, ...data, isDefault });
}

async function updateAddress(openid, event) {
  const { addressId, name, phone, address: addr, location } = event;
  if (!addressId) return res.badRequest('参数错误');

  const doc = db.collection('addresses').doc(addressId);
  const check = await doc.get();
  if (!check.data || check.data._openid !== openid) {
    return res.forbidden('无权操作');
  }

  const updateData = { updatedAt: db.serverDate() };
  if (name !== undefined) updateData.name = name.trim();
  if (phone !== undefined) updateData.phone = phone.trim();
  if (addr !== undefined) updateData.address = addr.trim();
  if (event.addressDetail !== undefined) updateData.addressDetail = event.addressDetail ? event.addressDetail.trim() : '';
  if (location !== undefined) updateData.location = location;

  await doc.update({ data: updateData });
  logger.info('Address updated', { openid, addressId });
  return res.ok();
}

async function deleteAddress(openid, event) {
  const { addressId } = event;
  if (!addressId) return res.badRequest('参数错误');

  const doc = db.collection('addresses').doc(addressId);
  const check = await doc.get();
  if (!check.data || check.data._openid !== openid) {
    return res.forbidden('无权操作');
  }

  await doc.remove();

  // 如果删除的是默认地址，把第一个设为默认
  if (check.data.isDefault) {
    const first = await db.collection('addresses')
      .where({ _openid: openid })
      .orderBy('updatedAt', 'desc')
      .limit(1)
      .get();
    if (first.data.length > 0) {
      await db.collection('addresses').doc(first.data[0]._id).update({
        data: { isDefault: true, updatedAt: db.serverDate() }
      });
    }
  }

  logger.info('Address deleted', { openid, addressId });
  return res.ok();
}

async function setDefault(openid, event) {
  const { addressId } = event;
  if (!addressId) return res.badRequest('参数错误');

  await db.collection('addresses').where({ _openid: openid, isDefault: true }).update({
    data: { isDefault: false, updatedAt: db.serverDate() }
  });

  await db.collection('addresses').doc(addressId).update({
    data: { isDefault: true, updatedAt: db.serverDate() }
  });

  logger.info('Default address set', { openid, addressId });
  return res.ok();
}
