constuni = {
  hideTabBar: () => {},
  showToast: (options) => {
    console.log('Toast:', options.title);
  },
  navigateTo: (options) => {
    console.log('Navigate to:', options.url);
  },
  switchTab: (options) => {
    console.log('Switch tab:', options.url);
  },
  redirectTo: (options) => {
    console.log('Redirect to:', options.url);
  },
  reLaunch: (options) => {
    console.log('ReLaunch:', options.url);
  },
  getStorageSync: (key) => {
    try {
      return localStorage.getItem(key) ? JSON.parse(localStorage.getItem(key)) : null;
    } catch {
      return localStorage.getItem(key);
    }
  },
  setStorageSync: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      localStorage.setItem(key, value);
    }
  },
  removeStorageSync: (key) => {
    localStorage.removeItem(key);
  },
  getCurrentPages: () => [],
  showLoading: () => {},
  hideLoading: () => {},
  chooseLocation: (options) => {
    if (options.fail) {
      options.fail({ errMsg: 'cancel' });
    }
  },
  setClipboardData: (options) => {
    if (options.success) {
      options.success();
    }
  },
  share: (options) => {
    if (options.fail) {
      options.fail({ errMsg: 'no wechat' });
    }
  },
  getStorage: (options) => {
    const key = options.key;
    try {
      const value = localStorage.getItem(key);
      options.success({ data: value ? JSON.parse(value) : null });
    } catch {
      options.success({ data: localStorage.getItem(key) });
    }
  },
  setStorage: (options) => {
    try {
      localStorage.setItem(options.key, JSON.stringify(options.data));
      options.success && options.success();
    } catch (e) {
      options.fail && options.fail(e);
    }
  },
  getSystemInfo: (options) => {
    if (options.success) {
      options.success({
        platform: 'h5',
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
        statusBarHeight: 20,
        safeArea: { bottom: 0 }
      });
    }
  },
  chooseImage: (options) => {
    if (options.success) {
      options.success({ tempFilePaths: [] });
    }
  },
  uploadFile: (options) => {
    if (options.success) {
      options.success({ data: '{}' });
    }
  },
  request: (options) => {
    fetch(options.url, {
      method: options.method || 'GET',
      headers: options.header || {},
      body: options.data
    }).then(res => res.json()).then(data => {
      if (options.success) options.success({ data });
    }).catch(err => {
      if (options.fail) options.fail(err);
    });
  },
  showModal: (options) => {
    if (options.success) {
      options.success({ confirm: true });
    }
  },
  showActionSheet: (options) => {
    if (options.success) {
      options.success({ tapIndex: 0 });
    }
  },
  setTabBarBadge: (options) => {
    console.log('TabBar badge:', options);
  },
  removeTabBarBadge: (options) => {
    console.log('Remove tabBar badge');
  },
  pageScrollTo: (options) => {
    if (options.scrollTop) {
      window.scrollTo({ top: options.scrollTop, behavior: 'smooth' });
    }
  },
  getLocation: (options) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (options.success) {
            options.success({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude
            });
          }
        },
        (err) => {
          if (options.fail) options.fail(err);
        }
      );
    } else if (options.fail) {
      options.fail({ errMsg: 'geolocation not supported' });
    }
  },
  onLocationChange: () => {},
  offLocationChange: () => {},
  startLocationUpdate: () => {},
  stopLocationUpdate: () => {},
  login: (options) => {
    if (options.success) {
      options.success({ code: 'mock-code' });
    }
  },
  getUserProfile: (options) => {
    if (options.success) {
      options.success({
        userInfo: {
          nickName: '模拟用户',
          avatarUrl: ''
        }
      });
    }
  },
  chooseAddress: (options) => {
    if (options.success) {
      options.success({
        cityName: '北京市',
        countyName: '朝阳区',
        detailInfo: '某街道某小区'
      });
    }
  },
  getPushClientId: (options) => {
    if (options.success) {
      options.success({ cid: 'mock-cid' });
    }
  },
  createPushMessage: () => {},
  reportAnalytics: () => {},
  canIUse: (api) => true,
  version: { compare: () => 0 },
  onAppRoute: () => {},
  offAppRoute: () => {},
  onAppRouteDone: () => {},
  offAppRouteDone: () => {},
  onKeyboardHeightChange: () => {},
  offKeyboardHeightChange: () => {},
  onAppShow: () => {},
  offAppShow: () => {},
  onAppHide: () => {},
  offAppHide: () => {},
  onPageScroll: () => {},
  offPageScroll: () => {},
  onReachBottom: () => {},
  offReachBottom: () => {},
  onPullDownRefresh: () => {},
  offPullDownRefresh: () => {},
  onAddToFavorites: () => {},
  offAddToFavorites: () => {},
  onShareAppMessage: () => {},
  offShareAppMessage: () => {},
  onShareTimeline: () => {},
  offShareTimeline: () => {},
  onTitleClick: () => {},
  offTitleClick: () => {},
  onOptionMenuButtonTap: () => {},
  offOptionMenuButtonTap: () => {},
  onNavigationBarButtonTap: () => {},
  offNavigationBarButtonTap: () => {},
  onNavigationBarSearchInputClicked: () => {},
  offNavigationBarSearchInputClicked: () => {},
  onNavigationBarSearchInputConfirmed: () => {},
  offNavigationBarSearchInputConfirmed: () => {},
  onNavigationBarSearchInputChanged: () => {},
  offNavigationBarSearchInputChanged: () => {},
  onBackPress: () => {},
  offBackPress: () => {},
  onHardwareBackPress: () => {},
  offHardwareBackPress: () => {},
  onTabItemTap: () => {},
  offTabItemTap: () => {},
  showTabBar: () => {},
  hideTabBar: () => {},
  setTabBarItem: () => {},
  setTabBarStyle: () => {},
  setNavigationBarTitle: (options) => {
    if (options.title) {
      document.title = options.title;
    }
  },
  setNavigationBarColor: () => {},
  showNavigationBarLoading: () => {},
  hideNavigationBarLoading: () => {},
  createAnimation: (options) => ({
    step: () => ({ step: () => {} }),
    export: () => ({})
  }),
  createSelectorQuery: () => ({
    select: () => ({
      boundingClientRect: () => ({ exec: (cb) => cb([]) }),
      context: () => ({ exec: (cb) => cb(null) }),
      fields: () => ({ exec: (cb) => cb({}) })
    }),
    selectAll: () => ({
      boundingClientRect: () => ({ exec: (cb) => cb([]) })
    }),
    in: () => ({
      select: () => ({
        boundingClientRect: () => ({ exec: (cb) => cb([]) })
      })
    }),
    exec: (cb) => cb([]),
    fields: () => ({ exec: (cb) => cb({}) })
  }),
  createIntersectionObserver: () => ({
    relativeTo: () => ({ relativeTo: () => ({}) }),
    relativeToViewport: () => ({ relativeToViewport: () => ({}) }),
    observe: () => {},
    unobserve: () => {},
    disconnect: () => {}
  }),
  nextTick: (fn) => setTimeout(fn, 0),
  arrayBufferToBase64: (buffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  },
  base64ToArrayBuffer: (base64) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  },
  addInterceptor: () => {},
  removeInterceptor: () => {},
  loadFontFace: () => {},
  getDeviceInfo: () => ({
    brand: 'Chrome',
    model: 'Desktop',
    platform: 'h5'
  }),
  getAppBaseInfo: () => ({
    appId: '__UNI__9D33044',
    appName: '我来帮',
    appVersion: '1.4.0',
    appVersionCode: 140,
    language: 'zh-Hans',
    version: '1.4.0'
  }),
  getSystemSetting: () => ({
    audioEnabled: true,
    locationEnabled: true,
    wifiEnabled: true,
    bluetoothEnabled: false,
    safeAreaEnabled: false
  }),
  getBatteryInfo: () => ({
    level: '100',
    isCharging: false
  }),
  getNetworkType: () => ({
    networkType: 'wifi'
  }),
  getClipboardData: (options) => {
    navigator.clipboard.readText().then(text => {
      if (options.success) options.success({ data: text });
    }).catch(() => {
      if (options.fail) options.fail({ errMsg: 'fail' });
    });
  },
  makePhoneCall: () => {},
  openLocation: () => {},
  getUpdateManager: () => ({
    onCheckForUpdate: () => {},
    onUpdateReady: () => {},
    onUpdateFailed: () => {},
    applyUpdate: () => {}
  }),
  connectSocket: () => {},
  closeSocket: () => {},
  sendSocketMessage: () => {},
  onSocketOpen: () => {},
  offSocketOpen: () => {},
  onSocketClose: () => {},
  offSocketClose: () => {},
  onSocketMessage: () => {},
  offSocketMessage: () => {},
  onSocketError: () => {},
  offSocketError: () => {},
  previewImage: (options) => {
    if (options.urls && options.urls.length > 0) {
      window.open(options.urls[0], '_blank');
    }
  },
  closeSocketTask: () => {},
  vibrate: () => {},
  vibrateShort: () => {},
  getScreenBrightness: () => {},
  setScreenBrightness: () => {},
  setKeepScreenOn: () => {},
  onUserCaptureScreen: () => {},
  offUserCaptureScreen: () => {},
  getFileInfo: () => {},
  getSavedFileList: () => {},
  getSavedFileInfo: () => {},
  saveFile: () => {},
  removeSavedFile: () => {},
  openDocument: () => {},
  chooseMessageFile: () => {},
  saveImageToPhotosAlbum: () => {},
  saveVideoToPhotosAlbum: () => {},
  getImageInfo: (options) => {
    if (options.success) {
      options.success({
        width: 0,
        height: 0,
        path: options.src
      });
    }
  },
  compressImage: () => {},
  getLocation: (options) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (options.success) {
            options.success({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              address: ''
            });
          }
        },
        (err) => {
          if (options.fail) options.fail(err);
        }
      );
    } else if (options.fail) {
      options.fail({ errMsg: 'not supported' });
    }
  },
  openLocation: (options) => {
    const lat = options.latitude;
    const lng = options.longitude;
    window.open(`https://maps.google.com/?q=${lat},${lng}`, '_blank');
  },
  getSystemInfoSync: () => ({
    platform: 'h5',
    screenWidth: window.innerWidth,
    screenHeight: window.innerHeight,
    statusBarHeight: 20,
    safeAreaInsets: { top: 0, bottom: 0, left: 0, right: 0 }
  }),
  canIUse: (api) => {
    const checks = {
      'button.open-type.contact': true,
      'button.open-type.getPhoneNumber': true,
      'button.open-type.getUserInfo': true,
      'button.open-type.openSetting': true,
      'button.open-type.share': true
    };
    return checks[api] !== undefined ? checks[api] : true;
  }
};

export default constuni;
