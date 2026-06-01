/**
 * 应用共享常量
 */

const PRODUCT_CATEGORIES = ['色丁', '凉感丝', '丝纹', '全棉', '圆盘', '其他'];

const PRODUCT_CATEGORIES_WITH_ALL = ['全部', ...PRODUCT_CATEGORIES];

const PRODUCT_UNITS = ['米', '卷', '个', '公斤', '包'];

const PRODUCT_STATUSES = ['sufficient', 'low', 'out'];

const PRODUCT_STATUS_LABELS = {
  sufficient: '充足',
  low: '紧张',
  out: '缺货'
};

const ORDER_STATUS_LABELS = {
  processing: '处理中',
  completed: '已完成',
  cancelled: '已取消'
};

const DELIVERY_METHOD_LABELS = {
  pickup: '自取',
  delivery: '配送',
  logistics: '物流'
};

module.exports = {
  PRODUCT_CATEGORIES,
  PRODUCT_CATEGORIES_WITH_ALL,
  PRODUCT_UNITS,
  PRODUCT_STATUSES,
  PRODUCT_STATUS_LABELS,
  ORDER_STATUS_LABELS,
  DELIVERY_METHOD_LABELS
};
