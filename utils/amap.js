/**
 * 高德地图服务封装
 * 使用高德 Web API，不需要额外下载 SDK 文件
 *
 * 使用前：前往 https://console.amap.com/ 申请 Web服务 Key
 * 将 Key 填入 utils/config.js 中
 */
let config = {};
try {
  config = require('./config');
} catch (e) {
  console.warn('config.js 未找到。请复制 config.example.js 为 config.js 并填入你的 AMAP_KEY。');
}
const AMAP_KEY = config.AMAP_KEY || '';

/**
 * POI 搜索建议（输入提示）
 * 用户在输入地址时实时显示匹配结果
 */
function searchTips(keyword, city) {
  if (!keyword || keyword.trim().length < 2) {
    return Promise.resolve([]);
  }

  const params = {
    key: AMAP_KEY,
    keywords: keyword.trim(),
    city: city || '',
    citylimit: 'false',
    datatype: 'all'
  };

  const query = Object.keys(params).map(k => `${k}=${encodeURIComponent(params[k])}`).join('&');

  return new Promise((resolve, reject) => {
    wx.request({
      url: `https://restapi.amap.com/v3/assistant/inputtips?${query}`,
      success: (res) => {
        if (res.data && res.data.status === '1' && res.data.tips) {
          const tips = res.data.tips
            .filter(t => t.location && t.location !== '0,0')
            .map(t => ({
              name: t.name,
              district: t.district || '',
              address: t.district + t.name,
              location: t.location // "lng,lat"
            }));
          resolve(tips);
        } else {
          resolve([]);
        }
      },
      fail: () => resolve([])
    });
  });
}

/**
 * 周边 POI 搜索
 */
function searchNearby(lng, lat, keyword, radius) {
  const params = {
    key: AMAP_KEY,
    location: `${lng},${lat}`,
    keywords: keyword || '',
    radius: radius || 1000,
    offset: 20,
    page: 1
  };

  const query = Object.keys(params).map(k => `${k}=${encodeURIComponent(params[k])}`).join('&');

  return new Promise((resolve, reject) => {
    wx.request({
      url: `https://restapi.amap.com/v3/place/around?${query}`,
      success: (res) => {
        if (res.data && res.data.status === '1' && res.data.pois) {
          resolve(res.data.pois.map(p => ({
            name: p.name,
            address: p.address || p.name,
            location: p.location
          })));
        } else {
          resolve([]);
        }
      },
      fail: () => resolve([])
    });
  });
}

/**
 * 逆地理编码：坐标 → 地址
 */
function reverseGeocode(lng, lat) {
  const params = {
    key: AMAP_KEY,
    location: `${lng},${lat}`
  };
  const query = Object.keys(params).map(k => `${k}=${encodeURIComponent(params[k])}`).join('&');

  return new Promise((resolve, reject) => {
    wx.request({
      url: `https://restapi.amap.com/v3/geocode/regeo?${query}`,
      success: (res) => {
        if (res.data && res.data.status === '1' && res.data.regeocode) {
          const addr = res.data.regeocode.formatted_address || '';
          const pois = (res.data.regeocode.pois || []).map(p => ({
            name: p.name,
            address: p.name,
            location: p.location
          }));
          resolve({ address: addr, pois });
        } else {
          resolve({ address: '', pois: [] });
        }
      },
      fail: () => resolve({ address: '', pois: [] })
    });
  });
}

/**
 * 打开微信地图选择位置
 * 不需要高德 Key，直接使用微信原生能力
 */
function chooseLocation(currentLat, currentLng) {
  return new Promise((resolve, reject) => {
    wx.chooseLocation({
      latitude: currentLat || 27.9939,  // 默认温州市中心
      longitude: currentLng || 120.6993,
      success: (res) => {
        resolve({
          name: res.name || '',
          address: res.address || res.name || '',
          lat: res.latitude,
          lng: res.longitude
        });
      },
      fail: (err) => {
        if (err.errMsg.includes('cancel')) {
          resolve(null);
        } else {
          wx.showToast({ title: '定位失败，请授权位置权限', icon: 'none' });
          resolve(null);
        }
      }
    });
  });
}

/**
 * 获取当前定位
 */
function getCurrentLocation() {
  return new Promise((resolve) => {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => resolve({ lat: res.latitude, lng: res.longitude }),
      fail: () => resolve(null)
    });
  });
}

/**
 * 地理编码：地址 → 坐标
 */
function geocode(address) {
  const params = {
    key: AMAP_KEY,
    address: address
  };
  const query = Object.keys(params).map(k => `${k}=${encodeURIComponent(params[k])}`).join('&');

  return new Promise((resolve) => {
    wx.request({
      url: `https://restapi.amap.com/v3/geocode/geo?${query}`,
      success: (res) => {
        if (res.data && res.data.status === '1' && res.data.geocodes && res.data.geocodes.length > 0) {
          const loc = res.data.geocodes[0].location.split(',');
          resolve({ lat: parseFloat(loc[1]), lng: parseFloat(loc[0]) });
        } else {
          resolve(null);
        }
      },
      fail: () => resolve(null)
    });
  });
}

/**
 * 打开微信地图导航
 * 先用高德地理编码获取坐标，再调用微信原生地图
 */
async function openNavigation(address) {
  // 尝试用高德地理编码获取坐标
  if (isConfigured()) {
    const coords = await geocode(address);
    if (coords) {
      wx.openLocation({
        latitude: coords.lat,
        longitude: coords.lng,
        address: address,
        scale: 16,
        fail: () => {
          wx.showToast({ title: '请安装地图应用', icon: 'none' });
        }
      });
      return;
    }
  }

  // 未配置高德Key：用微信原生地图选点，让用户手动搜索地址
  wx.showModal({
    title: '导航提示',
    content: `未配置地图Key，将打开地图选点。\n客户地址：${address}\n请在地图中搜索该地址。`,
    confirmText: '打开地图',
    success: (res) => {
      if (res.confirm) {
        wx.chooseLocation({
          latitude: 27.9939,
          longitude: 120.6993,
          success: (result) => {
            // 已选好位置，再打开地图查看
            wx.openLocation({
              latitude: result.latitude,
              longitude: result.longitude,
              address: result.address || address,
              scale: 16,
              fail: () => {
                wx.showToast({ title: '请安装地图应用', icon: 'none' });
              }
            });
          },
          fail: () => {
            // 用户取消选点，用默认坐标打开
            wx.openLocation({
              latitude: 27.9939,
              longitude: 120.6993,
              address: address,
              scale: 16,
              fail: () => {
                wx.showToast({ title: '请安装地图应用', icon: 'none' });
              }
            });
          }
        });
      }
    }
  });
}

/**
 * 检查高德 Key 是否已配置
 */
function isConfigured() {
  return AMAP_KEY && AMAP_KEY !== 'your-amap-key-here';
}

/**
 * 解析高德返回的位置字符串 "lng,lat" → {lat, lng}
 */
function parseLocation(locationStr) {
  if (!locationStr) return null;
  const parts = locationStr.split(',');
  if (parts.length !== 2) return null;
  const lng = parseFloat(parts[0]);
  const lat = parseFloat(parts[1]);
  if (isNaN(lng) || isNaN(lat)) return null;
  return { lat, lng };
}

module.exports = {
  AMAP_KEY,
  searchTips,
  searchNearby,
  reverseGeocode,
  geocode,
  chooseLocation,
  getCurrentLocation,
  openNavigation,
  parseLocation,
  isConfigured
};
