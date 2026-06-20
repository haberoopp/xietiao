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
    'vcuCn2dNTkgg6Xf-P3xqYvXYLJJgtSqf_hhO7wRqiE0',  // 订单状态变更 thing1+name2+amount6+thing8
    'vcuCn2dNTkgg6Xf-P3xqYtrKc9DgUcN3g7LmZirw4Kw',  // 付款状态变更 thing1+name2+amount6
    'tlxN0JZIJyzJQbYrZZ5XTQMGorYXll2rBhRkRqgwBFg',  // 退货状态通知 character_string1+thing2
  ],
  // 管理员订阅（用在管理后台）
  ADMIN: [
    'XGD06qwAdw5mN9Nxu9NMkv0ywwtEluVnoRIb5hxIGGk',  // 新订单通知 character_string1+thing12+amount2+thing14
    'vcuCn2dNTkgg6Xf-P3xqYsQHCNH7oyZmYfbUzGn-d0Q',  // 订单状态变更 character_string4+name2+amount6+thing8
    'XGD06qwAdw5mN9Nxu9NMkvNS4DskjFB6njCzhuTziQA',  // 订单取消通知 character_string1+thing12+thing8
    'tlxN0JZIJyzJQbYrZZ5XTS8lL882gPR5wwMgSxE8iGQ',  // 退货申请审核 thing2+character_string1+thing5
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
