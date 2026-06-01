/**
 * 订单导出 & 对账单工具
 */

const fs = wx.getFileSystemManager();

/**
 * 将订单列表转为 CSV 字符串（UTF-8 BOM，Excel 可直接打开）
 * @param {Array} orders
 * @returns {string} CSV
 */
function ordersToCSV(orders) {
  const BOM = '﻿';
  const header = '订单号,客户名称,电话,地址,商品明细,金额(元),付款状态,订单状态,拿货方式,下单时间,备注';
  const rows = [header];

  orders.forEach(o => {
    const itemsText = (o.items || []).map(i => `${i.name}×${i.quantity}${i.unit}`).join('; ');
    const row = [
      o._id || '',
      csvEscape(o.customerName || ''),
      o.phone || '',
      csvEscape(o.address || ''),
      csvEscape(itemsText),
      ((o.totalAmount || 0) / 100).toFixed(2),
      o.payment_status === 'paid' ? '已付款' : '未付款',
      statusText(o.status),
      deliveryText(o.deliveryMethod),
      o.createdAt ? formatTime(o.createdAt) : '',
      csvEscape(o.remark || '')
    ];
    rows.push(row.join(','));
  });

  return BOM + rows.join('\n');
}

function csvEscape(str) {
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function statusText(s) {
  if (s === 'processing') return '处理中';
  if (s === 'completed') return '已完成';
  if (s === 'cancelled') return '已取消';
  return s || '';
}

function deliveryText(d) {
  if (d === 'delivery') return '配送';
  if (d === 'pickup') return '自取';
  if (d === 'logistics') return '物流';
  return d || '';
}

function formatTime(iso) {
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 写入临时文件并分享到微信聊天
 * @param {string} content - CSV 内容
 * @param {string} fileName - 文件名
 */
function shareCSV(content, fileName) {
  const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`;
  fs.writeFile({
    filePath,
    data: content,
    encoding: 'utf8',
    success: () => {
      // 先尝试分享文件（仅真机支持）
      wx.shareFileMessage({
        filePath,
        fileName,
        success: () => {
          wx.showToast({ title: '已分享', icon: 'success' });
        },
        fail: (err) => {
          if (err.errMsg && err.errMsg.includes('cancel')) return;
          // 分享不可用时（模拟器/不支持的文件分享），降级为复制内容
          copyCSVToClipboard(content);
        }
      });
    },
    fail: () => {
      // 文件写入失败也尝试直接复制
      copyCSVToClipboard(content);
    }
  });
}

function copyCSVToClipboard(content) {
  wx.setClipboardData({
    data: content,
    success: () => {
      wx.showModal({
        title: '已复制到剪贴板',
        content: 'CSV 数据已复制，可粘贴到 Excel 或记事本中保存。',
        showCancel: false
      });
    },
    fail: () => {
      wx.showToast({ title: '分享失败，请重试', icon: 'none' });
    }
  });
}

/**
 * 对账单 Canvas 绑制（生成图片后回调）
 * @param {Object} order - 订单对象
 * @param {Function} callback - callback(err, tempFilePath)
 */
function drawBillOnCanvas(order, callback) {
  const query = wx.createSelectorQuery();
  query.select('#billCanvas')
    .fields({ node: true, size: true })
    .exec((res) => {
      if (!res[0] || !res[0].node) {
        wx.showToast({ title: '当前环境不支持Canvas', icon: 'none' });
        return;
      }
      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      const dpr = wx.getSystemInfoSync().pixelRatio;
      const width = 375;
      const height = Math.max(500, 280 + (order.items || []).length * 32);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);

      // 白色背景
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // 标题
      ctx.fillStyle = '#333333';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('对账单', 16, 36);

      // 日期
      ctx.fillStyle = '#999999';
      ctx.font = '12px sans-serif';
      ctx.fillText(formatTime(order.createdAt || new Date().toISOString()), 220, 36);

      // 分隔线
      ctx.strokeStyle = '#eeeeee';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(16, 50);
      ctx.lineTo(width - 16, 50);
      ctx.stroke();

      // 客户信息
      ctx.fillStyle = '#333333';
      ctx.font = '15px sans-serif';
      ctx.fillText(`客户：${order.customerName || ''}`, 16, 78);
      ctx.font = '13px sans-serif';
      ctx.fillStyle = '#666666';
      ctx.fillText(`电话：${order.phone || ''}`, 16, 100);
      ctx.fillText(`订单号：${order._id || ''}`, 16, 120);

      // 表头背景
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(16, 135, width - 32, 26);
      ctx.fillStyle = '#333333';
      ctx.font = '13px sans-serif';
      ctx.fillText('商品', 24, 153);
      ctx.fillText('数量', 180, 153);
      ctx.fillText('单价', 240, 153);
      ctx.fillText('小计', 300, 153);

      // 商品行
      let y = 177;
      ctx.font = '12px sans-serif';
      (order.items || []).forEach((item, i) => {
        if (i % 2 === 0) {
          ctx.fillStyle = '#fafafa';
          ctx.fillRect(16, y - 14, width - 32, 28);
        }
        ctx.fillStyle = '#333333';
        ctx.fillText(item.name || '', 24, y + 4);
        ctx.fillText(String(item.quantity || 0) + (item.unit || ''), 180, y + 4);
        ctx.fillText('¥' + ((item.price || 0) / 100).toFixed(2), 240, y + 4);
        ctx.fillText('¥' + ((item.price || 0) * (item.quantity || 0) / 100).toFixed(2), 300, y + 4);
        y += 30;
      });

      // 合计
      ctx.strokeStyle = '#eeeeee';
      ctx.beginPath();
      ctx.moveTo(16, y + 10);
      ctx.lineTo(width - 16, y + 10);
      ctx.stroke();

      ctx.fillStyle = '#333333';
      ctx.font = 'bold 18px sans-serif';
      const totalText = '合计：¥' + ((order.totalAmount || 0) / 100).toFixed(2);
      ctx.fillText(totalText, width - 16 - ctx.measureText(totalText).width, y + 38);

      // 付款状态
      ctx.font = '13px sans-serif';
      ctx.fillStyle = order.payment_status === 'paid' ? '#2e7d32' : '#e65100';
      ctx.fillText(order.payment_status === 'paid' ? '✓ 已付款' : '○ 未付款', 16, y + 38);

      // 底部
      ctx.fillStyle = '#999999';
      ctx.font = '11px sans-serif';
      ctx.fillText('温州斜条批发 · 感谢您的信任', width / 2 - 70, height - 16);

      // 延时输出（等绑制完成）
      setTimeout(() => {
        wx.canvasToTempFilePath({
          canvas,
          success: (res) => callback(null, res.tempFilePath),
          fail: (err) => callback(err)
        });
      }, 400);
    });
}

/**
 * 分享对账单图片（备选：showShareImageMenu 不可用时）
 */
function shareBillImage(tempFilePath) {
  wx.shareFileMessage({
    filePath: tempFilePath,
    fail: (err) => {
      if (err.errMsg.includes('cancel')) return;
      wx.showToast({ title: '分享失败', icon: 'none' });
    }
  });
}

module.exports = {
  ordersToCSV,
  shareCSV,
  drawBillOnCanvas,
  shareBillImage
};
