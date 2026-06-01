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
    '75qtI8wJVA6ocFKzJavAptlVwStWeJSyAt2-5fMFtx0',  // 订单状态变更 thing1+phrase2+amount3+thing4
    'qg1JsVy5f-CrmBj_2HyY9SIr5yZKFj0_7GXJqXryDIA',  // 付款状态变更 thing1+phrase2+amount3
    '5Z74_S8f7RM4aWLg-cwTXAPxAfTvnNpHStXAdlXJtQY',  // 退换货结果 thing1+phrase2
  ],
  // 管理员订阅（用在管理后台）
  ADMIN: [
    'xyc9X25If8igknu5ZKIKCdJ_ZCK_RKgIZ3fOVirVtMI',  // 新订单通知 thing1+thing2+amount3
    '75qtI8wJVA6ocFKzJavAptfD6u0f5aN2RIAh74kZi0s',  // 订单状态变更 thing1+phrase2+amount3+thing4
    'aZVEXaOmez6UvEg6Xas5lxGfXYRL0cpnssmkcQp7v5c',  // 订单取消通知 thing1+thing2+thing3
    '5Z74_S8f7RM4aWLg-cwTXIBweaqx_3gI9TsqHl2kYt0',  // 退换货通知 thing1+thing2+thing3
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
