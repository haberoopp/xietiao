const cloud = require('wx-server-sdk');
const XLSX = require('xlsx');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const res = require('./response');
const logger = require('./logger');
const auth = require('./auth');

exports.main = async (event) => {
  const authResult = await auth.requireOpenid();
  const admin = await db.collection('admins').where({ lastLoginOpenid: authResult.openid, loggedIn: true }).get();
  if (admin.data.length === 0) return res.forbidden('无管理员权限');

  const { fileID } = event;

  try {
    const downloadRes = await cloud.downloadFile({ fileID });
    const buffer = downloadRes.fileContent;

    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rows.length === 0) {
      return res.badRequest('Excel文件中没有数据，请检查第一行为表头');
    }

    const results = { success: 0, errors: [] };
    const toInsert = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const name = (row['名称'] || row['name'] || '').toString().trim();
      const category = (row['分类'] || row['category'] || '其他').toString().trim();
      const price = parseFloat(row['单价(元)'] || row['单价'] || row['销售价'] || row['price'] || 0);
      const unit = (row['单位'] || row['unit'] || '米').toString().trim();
      const stock = parseInt(row['库存'] || row['盘点库存数量'] || row['stock'] || 0) || 0;
      const description = (row['描述'] || row['商品备注'] || row['description'] || '').toString().trim();
      const image = (row['图片'] || row['图片链接'] || row['商品图片链接'] || row['image'] || '').toString().trim();

      if (!name) {
        results.errors.push({ row: i + 2, msg: '名称为空' });
        continue;
      }
      if (isNaN(price) || price <= 0) {
        results.errors.push({ row: i + 2, name, msg: '价格无效' });
        continue;
      }

      toInsert.push({
        _row: i + 2,  // Excel 行号
        name, category,
        price: Math.round(price * 100),
        unit, stock, description, image,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      });
    }

    // 并行批量写入（每批最多20个并发）
    const BATCH = 20;
    for (let i = 0; i < toInsert.length; i += BATCH) {
      const batch = toInsert.slice(i, i + BATCH);
      const batchResults = await Promise.allSettled(
        batch.map(item => {
          const { _row, ...data } = item;
          return db.collection('products').add({ data }).then(() => true).catch(err => ({ _row, err }));
        })
      );
      batchResults.forEach(r => {
        if (r.status === 'fulfilled' && r.value === true) {
          results.success++;
        } else if (r.status === 'fulfilled' && r.value && r.value.err) {
          results.errors.push({ row: r.value._row, msg: '导入失败' });
        } else {
          results.errors.push({ row: '?', msg: '写入失败' });
        }
      });
    }

    // 清理临时文件
    try {
      await cloud.deleteFile({ fileList: [fileID] });
    } catch (e) {
      // 静默清理失败
    }

    logger.info('Products imported', { success: results.success, errors: results.errors.length, total: rows.length });
    return res.ok(results);
  } catch (err) {
    logger.error('importProducts error', { error: err.message });
    return res.internalError();
  }
};
