const cloud = require('wx-server-sdk');
const XLSX = require('xlsx');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  if (!wxContext.OPENID) return { code: -1, msg: '未登录' };
  const admin = await db.collection('admins').where({ lastLoginOpenid: wxContext.OPENID, loggedIn: true }).get();
  if (admin.data.length === 0) return { code: -1, msg: '无管理员权限' };

  const { fileID } = event;

  try {
    const res = await cloud.downloadFile({ fileID });
    const buffer = res.fileContent;

    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rows.length === 0) {
      return { code: -1, msg: 'Excel文件中没有数据，请检查第一行为表头' };
    }

    const results = { success: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const name = (row['名称'] || row['name'] || '').toString().trim();
      const category = (row['分类'] || row['category'] || '其他').toString().trim();
      const price = parseFloat(row['单价(元)'] || row['单价'] || row['price'] || 0);
      const unit = (row['单位'] || row['unit'] || '米').toString().trim();
      const stock = parseInt(row['库存'] || row['stock'] || 0) || 0;
      const description = (row['描述'] || row['description'] || '').toString().trim();

      if (!name) {
        results.errors.push({ row: i + 2, msg: '名称为空' });
        continue;
      }
      if (isNaN(price) || price <= 0) {
        results.errors.push({ row: i + 2, name, msg: '价格无效' });
        continue;
      }

      try {
        await db.collection('products').add({
          data: {
            name,
            category,
            price: Math.round(price * 100),
            unit,
            stock,
            description,
            image: '',
            createdAt: db.serverDate(),
            updatedAt: db.serverDate()
          }
        });
        results.success++;
      } catch (err) {
        results.errors.push({ row: i + 2, name, msg: err.message });
      }
    }

    // 清理临时文件
    try {
      await cloud.deleteFile({ fileList: [fileID] });
    } catch (e) {
      // 静默清理失败
    }

    return { code: 0, data: results };
  } catch (err) {
    return { code: -1, msg: '解析Excel失败：' + err.message };
  }
};
