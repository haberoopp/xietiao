const util = require('../../utils/util');

Page({
  data: {
    addresses: [],
    showForm: false,
    editingId: null,
    currentLocation: null,
    pickedLocation: null,
    form: {
      name: '',
      phone: '',
      address: '',
      addressDetail: ''
    }
  },

  onLoad() {
    this.loadAddresses();
    this.getLocation();
  },

  onShow() {
    this.loadAddresses();
  },

  async getLocation() {
    const loc = await new Promise((resolve) => {
      wx.getLocation({
        type: 'gcj02',
        success: (res) => resolve({ lat: res.latitude, lng: res.longitude }),
        fail: () => resolve(null)
      });
    });
    if (loc) {
      this.setData({ currentLocation: loc });
    } else {
      this.setData({ currentLocation: { lat: 31.9545, lng: 121.0793 } });
    }
  },

  async loadAddresses() {
    const app = getApp();

    if (app.globalData.demoMode) {
      let addresses = wx.getStorageSync('addresses') || [];
      if (addresses.length === 0) {
        addresses.push(
          { _id: 'a001', name: '陈大明', phone: '13900139002', address: '浙江省温州市瓯海区梧田街道月乐西街58号', isDefault: true, createdAt: Date.now() - 86400000 * 10 },
          { _id: 'a002', name: '温州服装厂', phone: '13800138001', address: '浙江省温州市鹿城区双屿街道工业区3号', isDefault: false, createdAt: Date.now() - 86400000 * 5 }
        );
        wx.setStorageSync('addresses', addresses);
      }
      this.setData({ addresses });
      return;
    }

    try {
      const res = await wx.cloud.callFunction({ name: 'addressCRUD', data: { action: 'list' } });
      if (res.result.code === 0) {
        this.setData({ addresses: res.result.data.list });
      }
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  async onSetDefault(e) {
    const addressId = e.currentTarget.dataset.id;
    const app = getApp();

    if (app.globalData.demoMode) {
      const addresses = this.data.addresses.map(a => ({ ...a, isDefault: a._id === addressId }));
      wx.setStorageSync('addresses', addresses);
      this.setData({ addresses });
      wx.showToast({ title: '已设为默认', icon: 'success' });
      return;
    }

    try {
      const res = await wx.cloud.callFunction({ name: 'addressCRUD', data: { action: 'setDefault', addressId } });
      if (res.result.code === 0) {
        this.loadAddresses();
        wx.showToast({ title: '已设为默认', icon: 'success' });
      }
    } catch (err) {
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  onAdd() {
    this.setData({
      showForm: true,
      editingId: null,
      pickedLocation: null,
      form: { name: '', phone: '', address: '', addressDetail: '' }
    });
  },

  onEdit(e) {
    const addr = e.currentTarget.dataset.address;
    this.setData({
      showForm: true,
      editingId: addr._id,
      pickedLocation: addr.location || null,
      form: { name: addr.name, phone: addr.phone, address: addr.address, addressDetail: addr.addressDetail || '' }
    });
  },

  onDelete(e) {
    const addressId = e.currentTarget.dataset.id;
    if (!addressId) {
      wx.showToast({ title: '地址信息异常', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '确认删除',
      content: '确定要删除该地址吗？',
      success: async (res) => {
        if (!res.confirm) return;
        const app = getApp();
        if (app.globalData.demoMode) {
          let addresses = this.data.addresses.filter(a => a._id !== addressId);
          if (addresses.length > 0 && !addresses.some(a => a.isDefault)) {
            addresses[0].isDefault = true;
          }
          wx.setStorageSync('addresses', addresses);
          this.setData({ addresses });
          wx.showToast({ title: '已删除', icon: 'success' });
          return;
        }
        try {
          const result = await wx.cloud.callFunction({ name: 'addressCRUD', data: { action: 'delete', addressId } });
          if (result.result.code === 0) {
            wx.showToast({ title: '已删除', icon: 'success' });
            this.loadAddresses();
          } else {
            wx.showToast({ title: result.result.msg || '删除失败', icon: 'none' });
          }
        } catch (err) {
          wx.showToast({ title: '删除失败', icon: 'none' });
        }
      }
    });
  },


  onFormInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    const data = { ['form.' + field]: value };
    if (field === 'address') data.pickedLocation = null;
    this.setData(data);
  },

  async onChooseLocation() {
    const { currentLocation } = this.data;
    const result = await new Promise((resolve) => {
      wx.chooseLocation({
        latitude: currentLocation ? currentLocation.lat : 31.9545,
        longitude: currentLocation ? currentLocation.lng : 121.0793,
        success: (res) => resolve({
          name: res.name || '',
          address: res.address || res.name || '',
          lat: res.latitude,
          lng: res.longitude
        }),
        fail: (err) => {
          if (err.errMsg.includes('cancel')) resolve(null);
          else { wx.showToast({ title: '定位失败，请授权位置权限', icon: 'none' }); resolve(null); }
        }
      });
    });
    if (result) {
      this.setData({
        'form.address': result.address || result.name,
        'form.addressDetail': '',
        pickedLocation: result.lat ? { lat: result.lat, lng: result.lng } : null
      });
    }
  },

  async onSave() {
    const { name, phone, address, addressDetail } = this.data.form;

    if (!name.trim()) {
      wx.showToast({ title: '请填写联系人', icon: 'none' });
      return;
    }
    if (!util.isValidPhone(phone)) {
      wx.showToast({ title: '请填写正确的手机号', icon: 'none' });
      return;
    }
    if (!address.trim()) {
      wx.showToast({ title: '请填写地址', icon: 'none' });
      return;
    }

    const app = getApp();

    if (app.globalData.demoMode) {
      let addresses = this.data.addresses;
      const addrData = {
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        addressDetail: addressDetail.trim() || undefined,
        location: this.data.pickedLocation || undefined
      };
      if (this.data.editingId) {
        addresses = addresses.map(a =>
          a._id === this.data.editingId ? { ...a, ...addrData, location: this.data.pickedLocation || a.location } : a
        );
      } else {
        addresses.push({
          _id: 'a' + Date.now(),
          ...addrData,
          isDefault: addresses.length === 0,
          createdAt: Date.now()
        });
      }
      wx.setStorageSync('addresses', addresses);
      this.setData({ showForm: false, addresses });
      wx.showToast({ title: '已保存', icon: 'success' });
      return;
    }

    wx.showLoading({ title: '保存中...' });
    try {
      const action = this.data.editingId ? 'update' : 'add';
      const data = {
        action,
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        addressDetail: addressDetail.trim() || undefined
      };
      if (this.data.pickedLocation) {
        data.location = this.data.pickedLocation;
      } else if (this.data.editingId) {
        data.location = null; // 允许清除已保存的定位
      }
      if (this.data.editingId) data.addressId = this.data.editingId;

      const res = await wx.cloud.callFunction({ name: 'addressCRUD', data });
      wx.hideLoading();
      if (res.result.code === 0) {
        this.setData({ showForm: false });
        this.loadAddresses();
        wx.showToast({ title: '已保存', icon: 'success' });
      } else {
        wx.showToast({ title: res.result.msg || '保存失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '网络错误', icon: 'none' });
    }
  },

  onCancel() {
    this.setData({ showForm: false });
  }
});
