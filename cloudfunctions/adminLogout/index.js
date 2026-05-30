const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async () => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) return { code: -1 };

  try {
    const admin = await db.collection('admins').where({ lastLoginOpenid: openid, loggedIn: true }).get();
    if (admin.data.length > 0) {
      await db.collection('admins').doc(admin.data[0]._id).update({
        data: { loggedIn: false, updatedAt: db.serverDate() }
      });
    }
    return { code: 0 };
  } catch (err) {
    return { code: -1, msg: err.message };
  }
};
