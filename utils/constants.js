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

const NOTIFY_TEMPLATES = {
  // 客户订阅（用在结算页）
  CUSTOMER: [
    'vcuCn2dNTkgg6Xf-P3xqYvXYLJJgtSqf_hhO7wRqiE0',  // 订单状态变更 thing1+phrase2+amount3+thing4
    'vcuCn2dNTkgg6Xf-P3xqYtrKc9DgUcN3g7LmZirw4Kw',  // 付款状态变更 thing1+phrase2+amount3
    'tlxN0JZIJyzJQbYrZZ5XTQMGorYXll2rBhRkRqgwBFg',  // 退换货结果 thing1+phrase2
  ],
  // 管理员订阅（用在管理后台）
  ADMIN: [
    'XGD06qwAdw5mN9Nxu9NMkv0ywwtEluVnoRIb5hxIGGk',  // 新订单通知 thing1+thing2+amount3
    'vcuCn2dNTkgg6Xf-P3xqYsQHCNH7oyZmYfbUzGn-d0Q',  // 订单状态变更 thing1+phrase2+amount3+thing4
    'XGD06qwAdw5mN9Nxu9NMkvNS4DskjFB6njCzhuTziQA',  // 订单取消通知 thing1+thing2+thing3
    'tlxN0JZIJyzJQbYrZZ5XTS8lL882gPR5wwMgSxE8iGQ',  // 退换货通知 thing1+thing2+thing3
  ]
};

module.exports = {
  PRODUCT_CATEGORIES,
  PRODUCT_CATEGORIES_WITH_ALL,
  PRODUCT_UNITS,
  PRODUCT_STATUSES,
  PRODUCT_STATUS_LABELS,
  ORDER_STATUS_LABELS,
  DELIVERY_METHOD_LABELS,
  NOTIFY_TEMPLATES
};
