const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const res = require('./response');
const logger = require('./logger');

exports.main = async (event) => {
  try {
    const openid = cloud.getWXContext().OPENID;
    if (!openid) {
      return res.unauthorized();
    }

    // 查询是否已有用户记录
    const userRes = await db.collection('customers')
      .where({ _openid: openid })
      .get();

    if (userRes.data.length > 0) {
      const user = userRes.data[0];
      logger.info('login', { openid, isNew: false });
      return res.record({
        isNew: false,
        openid,
        profile: {
          name: user.name || '',
          avatarUrl: user.avatarUrl || '',
          phone: user.phone || ''
        }
      });
    }

    // 新用户：不创建空记录，待下单或完善资料时再创建
    logger.info('login', { openid, isNew: true });
    return res.record({
      isNew: true,
      openid,
      profile: {
        name: '',
        avatarUrl: '',
        phone: ''
      }
    });
  } catch (err) {
    logger.error('login', err);
    return res.internalError();
  }
};
