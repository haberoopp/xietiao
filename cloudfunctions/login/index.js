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
      return {
        code: 0,
        data: {
          isNew: false,
          openid,
          profile: {
            name: user.name || '',
            avatarUrl: user.avatarUrl || '',
            phone: user.phone || '',
            discount: user.discount || 1
          }
        }
      };
    }

    // 新用户：创建记录
    const newUser = {
      _openid: openid,
      name: '',
      avatarUrl: '',
      phone: '',
      discount: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const addRes = await db.collection('customers').add({ data: newUser });
    logger.info('login', { openid, isNew: true, userId: addRes._id });

    return {
      code: 0,
      data: {
        isNew: true,
        openid,
        profile: {
          name: '',
          avatarUrl: '',
          phone: '',
          discount: 1
        }
      }
    };
  } catch (err) {
    logger.error('login', err);
    return res.internalError();
  }
};
