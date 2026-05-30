const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { action } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  try {
    switch (action) {
      case 'list':
        return await listAddresses(openid);
      case 'add':
        return await addAddress(openid, event);
      case 'update':
        return await updateAddress(openid, event);
      case 'delete':
        return await deleteAddress(openid, event);
      case 'setDefault':
        return await setDefault(openid, event);
      default:
        return { code: -1, msg: '未知操作' };
    }
  } catch (err) {
    return { code: -1, msg: err.message };
  }
};

async function listAddresses(openid) {
  const list = await db.collection('addresses')
    .where({ _openid: openid })
    .orderBy('isDefault', 'desc')
    .orderBy('updatedAt', 'desc')
    .get();
  return { code: 0, data: list.data };
}

async function addAddress(openid, event) {
  const { name, phone, address, location } = event;
  if (!name || !phone || !address) {
    return { code: -1, msg: '请填写完整信息' };
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
  return { code: 0, data: { _id: result._id, ...data, isDefault } };
}

async function updateAddress(openid, event) {
  const { addressId, name, phone, address: addr, location } = event;
  if (!addressId) return { code: -1, msg: '参数错误' };

  const doc = db.collection('addresses').doc(addressId);
  const check = await doc.get();
  if (!check.data || check.data._openid !== openid) {
    return { code: -1, msg: '无权操作' };
  }

  const updateData = { updatedAt: db.serverDate() };
  if (name !== undefined) updateData.name = name.trim();
  if (phone !== undefined) updateData.phone = phone.trim();
  if (addr !== undefined) updateData.address = addr.trim();
  if (event.addressDetail !== undefined) updateData.addressDetail = event.addressDetail ? event.addressDetail.trim() : '';
  if (location !== undefined) updateData.location = location;

  await doc.update({ data: updateData });
  return { code: 0 };
}

async function deleteAddress(openid, event) {
  const { addressId } = event;
  if (!addressId) return { code: -1, msg: '参数错误' };

  const doc = db.collection('addresses').doc(addressId);
  const check = await doc.get();
  if (!check.data || check.data._openid !== openid) {
    return { code: -1, msg: '无权操作' };
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

  return { code: 0 };
}

async function setDefault(openid, event) {
  const { addressId } = event;
  if (!addressId) return { code: -1, msg: '参数错误' };

  await db.collection('addresses').where({ _openid: openid, isDefault: true }).update({
    data: { isDefault: false, updatedAt: db.serverDate() }
  });

  await db.collection('addresses').doc(addressId).update({
    data: { isDefault: true, updatedAt: db.serverDate() }
  });

  return { code: 0 };
}
