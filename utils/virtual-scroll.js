/**
 * 虚拟滚动工具模块
 * 在 scroll-view 中使用，只渲染可视区附近的列表项
 *
 * 用法：
 *   const vs = new VirtualScroll({ itemHeight: 240, buffer: 5 });
 *   vs.init();
 *   page.onScroll(e) {
 *     const r = vs.calc(e.detail.scrollTop, page.data.allData);
 *     page.setData({ visibleItems: r.visibleItems, topPad: r.topPad, bottomPad: r.bottomPad });
 *   }
 */

class VirtualScroll {
  constructor(options = {}) {
    this.itemHeight = options.itemHeight || 200;  // rpx
    this.buffer = options.buffer || 5;
    this.viewportHeight = 0;
    this._itemHeightPx = 0;
  }

  /** 初始化时调用一次，计算 px 值 */
  init() {
    const sysInfo = wx.getSystemInfoSync();
    const rpxRate = sysInfo.windowWidth / 750;
    this._itemHeightPx = Math.round(this.itemHeight * rpxRate);
    this.viewportHeight = sysInfo.windowHeight;
  }

  /** 每次滚动时调用 */
  calc(scrollTop, allItems) {
    if (!allItems || allItems.length === 0) {
      return { visibleItems: [], topPad: 0, bottomPad: 0 };
    }
    const startIndex = Math.max(0,
      Math.floor(scrollTop / this._itemHeightPx) - this.buffer
    );
    const endIndex = Math.min(allItems.length,
      Math.ceil((scrollTop + this.viewportHeight) / this._itemHeightPx) + this.buffer
    );
    const visibleItems = [];
    for (let i = startIndex; i < endIndex; i++) {
      visibleItems.push(allItems[i]);
    }
    return {
      visibleItems,
      topPad: startIndex * this._itemHeightPx,
      bottomPad: Math.max(0, (allItems.length - endIndex) * this._itemHeightPx)
    };
  }
}

module.exports = { VirtualScroll };
