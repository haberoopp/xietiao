/**
 * 演示数据 - 未配置云开发时使用
 */
const mockProducts = [
  { _id: 'p001', name: '色丁精品缎面 2cm', category: '色丁', price: 150, unit: '米', status: 'sufficient', last_produced_at: Date.now() - 86400000 * 3, recent_sales: 25000, description: '高档色丁面料，宽度2cm，光泽亮丽', image: '', createdAt: Date.now() - 86400000 * 7 },
  { _id: 'p002', name: '色丁格子斜条 1.5cm', category: '色丁', price: 80, unit: '米', status: 'low', last_produced_at: Date.now() - 86400000 * 10, recent_sales: 45000, description: '色丁材质格子纹，宽度1.5cm', image: '', createdAt: Date.now() - 86400000 * 6 },
  { _id: 'p003', name: '凉感丝包边条 3cm', category: '凉感丝', price: 200, unit: '米', status: 'sufficient', last_produced_at: Date.now() - 86400000 * 5, recent_sales: 18000, description: '凉感丝面料，凉爽透气，宽度3cm', image: '', createdAt: Date.now() - 86400000 * 5 },
  { _id: 'p004', name: '凉感丝斜条 2.5cm', category: '凉感丝', price: 180, unit: '米', status: 'sufficient', last_produced_at: Date.now() - 86400000 * 2, recent_sales: 12000, description: '凉感丝人字纹，宽度2.5cm', image: '', createdAt: Date.now() - 86400000 * 4 },
  { _id: 'p005', name: '丝纹缎面条 5cm', category: '丝纹', price: 60, unit: '米', status: 'out', last_produced_at: Date.now() - 86400000 * 20, recent_sales: 32000, description: '丝纹纹理面料，宽度5cm', image: '', createdAt: Date.now() - 86400000 * 3 },
  { _id: 'p006', name: '丝纹仿真丝条 4cm', category: '丝纹', price: 120, unit: '米', status: 'low', last_produced_at: Date.now() - 86400000 * 12, recent_sales: 38000, description: '仿真丝处理丝纹面料，宽度4cm', image: '', createdAt: Date.now() - 86400000 * 2 },
  { _id: 'p007', name: '全棉斜纹包边条 2cm', category: '全棉', price: 50, unit: '米', status: 'sufficient', last_produced_at: Date.now() - 86400000 * 1, recent_sales: 60000, description: '100%全棉材质，柔软亲肤，宽度2cm', image: '', createdAt: Date.now() - 86400000 },
  { _id: 'p008', name: '全棉本白条 1.5cm', category: '全棉', price: 35, unit: '米', status: 'sufficient', last_produced_at: Date.now() - 86400000 * 4, recent_sales: 28000, description: '全棉本白，宽度1.5cm，基础款', image: '', createdAt: Date.now() - 172800000 },
  { _id: 'p009', name: '圆盘花边缎带 15mm', category: '圆盘', price: 90, unit: '米', status: 'low', last_produced_at: Date.now() - 86400000 * 15, recent_sales: 55000, description: '圆盘花边设计，直径15mm', image: '', createdAt: Date.now() - 259200000 },
  { _id: 'p010', name: '圆盘刺绣缎带', category: '圆盘', price: 120, unit: '米', status: 'out', last_produced_at: Date.now() - 86400000 * 25, recent_sales: 42000, description: '圆盘刺绣花纹，精致工艺', image: '', createdAt: Date.now() - 345600000 },
  { _id: 'p011', name: '弹性松紧带 1cm', category: '其他', price: 35, unit: '米', status: 'sufficient', last_produced_at: Date.now() - 86400000 * 6, recent_sales: 15000, description: '高弹力松紧带，宽度1cm', image: '', createdAt: Date.now() - 432000000 },
  { _id: 'p012', name: '蕾丝花边条 0.8cm', category: '其他', price: 45, unit: '米', status: 'sufficient', last_produced_at: Date.now() - 86400000 * 8, recent_sales: 10000, description: '精致蕾丝花边，宽度0.8cm', image: '', createdAt: Date.now() - 518400000 },
];

const mockOrders = [
  {
    _id: 'o001',
    customerName: '温州服装厂',
    phone: '13800138001',
    address: '浙江省温州市鹿城区双屿街道工业区3号',
    items: [
      { productId: 'p001', name: '纯棉斜纹布条 2cm', price: 150, quantity: 100, unit: '米' },
      { productId: 'p003', name: '弹力斜纹包边条 3cm', price: 200, quantity: 50, unit: '米' },
    ],
    totalAmount: 25000,
    deliveryMethod: 'delivery',
    status: 'completed',
    pickedUp: true,
    location: { lat: 28.0185, lng: 120.6505 },
    remark: '颜色选黑色和白色各一半',
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    _id: 'o002',
    customerName: '陈大明',
    phone: '13900139002',
    address: '浙江省温州市瓯海区梧田街道月乐西街58号',
    items: [
      { productId: 'p007', name: '尼龙拉链 20cm', price: 50, quantity: 200, unit: '个' },
      { productId: 'p009', name: '树脂纽扣 15mm', price: 10, quantity: 500, unit: '个' },
    ],
    totalAmount: 15000,
    deliveryMethod: 'pickup',
    status: 'processing',
    location: { lat: 28.0045, lng: 120.5619 },
    remark: '',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    _id: 'o003',
    customerName: '丽水纺织品公司',
    phone: '13700137003',
    address: '浙江省丽水市莲都区水阁工业区绿谷大道102号',
    items: [
      { productId: 'p002', name: '涤纶斜条 1.5cm', price: 80, quantity: 300, unit: '米' },
      { productId: 'p011', name: '织带 1cm', price: 35, quantity: 500, unit: '米' },
      { productId: 'p012', name: '弹性松紧带 0.8cm', price: 45, quantity: 200, unit: '米' },
    ],
    totalAmount: 50500,
    deliveryMethod: 'logistics',
    status: 'processing',
    location: { lat: 28.4716, lng: 119.9156 },
    remark: '急单，请尽快发货',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

const mockCustomers = [
  { _id: 'c001', name: '温州服装厂', phone: '13800138001', discount: 0.9, totalOrders: 3, totalAmount: 25500, createdAt: Date.now() - 86400000 * 30 },
  { _id: 'c002', name: '陈大明', phone: '13900139002', discount: 0.85, totalOrders: 1, totalAmount: 15000, createdAt: Date.now() - 86400000 * 15 },
];

module.exports = {
  mockProducts,
  mockOrders,
  mockCustomers,
};
