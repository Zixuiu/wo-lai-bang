window.uni = {
  hideTabBar: () => {},
  showToast: (options) => {
    if (typeof options === 'string') {
      console.log('[Toast]', options);
    } else {
      console.log('[Toast]', options.title);
    }
  },
  navigateTo: (options) => {
    console.log('[Navigate]', options.url);
    window.dispatchEvent(new CustomEvent('uni-navigate', { detail: options }));
  },
  switchTab: (options) => {
    console.log('[SwitchTab]', options.url);
    window.dispatchEvent(new CustomEvent('uni-switch-tab', { detail: options }));
  },
  redirectTo: (options) => {
    console.log('[Redirect]', options.url);
  },
  reLaunch: (options) => {
    console.log('[ReLaunch]', options.url);
    window.dispatchEvent(new CustomEvent('uni-relaunch', { detail: options }));
  },
  getStorageSync: (key) => {
    try {
      const val = localStorage.getItem(key);
      if (val === null) return '';
      try { return JSON.parse(val); } catch { return val; }
    } catch { return ''; }
  },
  setStorageSync: (key, value) => {
    try {
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    } catch {}
  },
  removeStorageSync: (key) => {
    localStorage.removeItem(key);
  },
  getCurrentPages: () => [],
  showLoading: (options) => {
    if (typeof options === 'string') console.log('[Loading]', options);
    else if (options && options.title) console.log('[Loading]', options.title);
  },
  hideLoading: () => {},
  chooseLocation: (options) => {
    if (options && options.success) {
      options.success({ name: '当前位置', latitude: 39.908823, longitude: 116.397470, address: '' });
    }
    if (options && options.fail) options.fail({ errMsg: 'cancel' });
  },
  setClipboardData: (options) => {
    if (options && options.data) {
      navigator.clipboard.writeText(options.data).then(() => {
        if (options.success) options.success();
      }).catch(() => {
        if (options.fail) options.fail({ errMsg: 'fail' });
      });
    }
  },
  share: (options) => {
    console.log('[Share]', options);
    if (options && options.fail) options.fail({ errMsg: 'no wechat' });
  },
  getStorage: (options) => {
    if (!options || !options.key) return;
    const val = localStorage.getItem(options.key);
    if (options.success) {
      options.success({ data: val || '' });
    }
  },
  setStorage: (options) => {
    if (!options || !options.key) return;
    localStorage.setItem(options.key, options.data || '');
    if (options && options.success) options.success();
  },
  getSystemInfo: (options) => {
    if (options && options.success) {
      options.success({
        platform: 'h5',
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
        statusBarHeight: 20,
        safeArea: { bottom: 0, top: 0, left: 0, right: 0 },
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        language: 'zh_CN',
        version: '1.4.0',
        system: navigator.userAgent
      });
    }
  },
  chooseImage: (options) => {
    if (options && options.success) {
      options.success({ tempFilePaths: [] });
    }
    if (options && options.fail) options.fail({ errMsg: 'cancel' });
  },
  uploadFile: (options) => {
    console.log('[Upload]', options);
    if (options && options.success) {
      options.success({ data: '{}' });
    }
  },
  request: (options) => {
    if (!options || !options.url) return;
    fetch(options.url, {
      method: options.method || 'GET',
      headers: options.header || {},
      body: options.data
    }).then(res => res.json())
      .then(data => {
        if (options.success) options.success({ data });
      })
      .catch(err => {
        if (options.fail) options.fail(err);
      });
  },
  showModal: (options) => {
    if (options && options.success) {
      options.success({ confirm: true, cancel: false });
    }
  },
  showActionSheet: (options) => {
    if (options && options.success) {
      options.success({ tapIndex: 0 });
    }
  },
  setTabBarBadge: (options) => {
    console.log('[TabBar Badge]', options);
  },
  removeTabBarBadge: () => {},
  pageScrollTo: (options) => {
    if (options && options.scrollTop) {
      window.scrollTo({ top: options.scrollTop, behavior: 'smooth' });
    }
  },
  getLocation: (options) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (options && options.success) {
            options.success({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude
            });
          }
        },
        (err) => {
          if (options && options.fail) options.fail(err);
        }
      );
    } else {
      if (options && options.fail) {
        options.fail({ errMsg: 'geolocation not supported' });
      }
    }
  },
  login: (options) => {
    if (options && options.success) {
      options.success({ code: 'mock-code-' + Date.now() });
    }
  },
  getUserProfile: (options) => {
    if (options && options.success) {
      options.success({
        userInfo: { nickName: '模拟用户', avatarUrl: '' }
      });
    }
  },
  setNavigationBarTitle: (options) => {
    if (options && options.title) {
      document.title = options.title;
    }
  },
  createSelectorQuery: () => ({
    select: () => ({
      boundingClientRect: (cb) => ({ exec: (fn) => fn && fn([null]) }),
      context: () => ({ exec: (fn) => fn && fn(null) }),
      fields: () => ({ exec: (fn) => fn && fn({}) }),
      scrollOffset: () => ({ exec: (fn) => fn && fn([{ scrollTop: 0 }]) })
    }),
    selectAll: () => ({
      boundingClientRect: () => ({ exec: (fn) => fn && fn([]) })
    }),
    in: () => ({
      select: () => ({
        boundingClientRect: () => ({ exec: (fn) => fn && fn([]) })
      })
    }),
    exec: (cb) => cb && cb([]),
    fields: () => ({ exec: (fn) => fn && fn({}) })
  }),
  createIntersectionObserver: () => ({
    relativeTo: () => ({ relativeTo: () => ({}) }),
    relativeToViewport: () => ({ relativeToViewport: () => ({}) }),
    observe: () => {},
    unobserve: () => {},
    disconnect: () => {}
  }),
  nextTick: (fn) => setTimeout(fn || (() => {}), 0),
  previewImage: (options) => {
    if (options && options.urls && options.urls.length > 0) {
      window.open(options.urls[0], '_blank');
    }
  },
  getClipboardData: (options) => {
    navigator.clipboard.readText().then(text => {
      if (options && options.success) options.success({ data: text });
    }).catch(() => {
      if (options && options.fail) options.fail({ errMsg: 'fail' });
    });
  },
  showTabBar: () => {},
  hideTabBar: () => {},
  setTabBarItem: () => {},
  setTabBarStyle: () => {},
  showNavigationBarLoading: () => {},
  hideNavigationBarLoading: () => {},
  setNavigationBarColor: () => {},
  createAnimation: () => ({
    step: () => ({ step: () => {} }),
    export: () => ({})
  }),
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
  onShareAppMessage: () => {},
  offShareAppMessage: () => {},
  onTabItemTap: () => {},
  offTabItemTap: () => {},
  getDeviceInfo: () => ({
    brand: 'Chrome',
    model: 'Desktop',
    platform: 'h5'
  }),
  getAppBaseInfo: () => ({
    appId: '__UNI__9D33044',
    appName: '我来帮',
    appVersion: '1.4.0'
  }),
  getSystemSetting: () => ({
    locationEnabled: true,
    wifiEnabled: true
  }),
  getNetworkType: () => ({ networkType: 'wifi' }),
  makePhoneCall: () => {},
  openLocation: (options) => {
    if (options && options.latitude && options.longitude) {
      window.open(`https://maps.google.com/?q=${options.latitude},${options.longitude}`, '_blank');
    }
  },
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
  vibrate: () => {},
  getImageInfo: (options) => {
    if (options && options.success) {
      options.success({ width: 0, height: 0, path: options.src });
    }
  },
  canIUse: () => true,
  version: { compare: () => 0 },
  addInterceptor: () => {},
  removeInterceptor: () => {},
  loadFontFace: () => {},
  arrayBufferToBase64: (buffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  },
  base64ToArrayBuffer: (base64) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }
};

window.getCurrentPages = () => [];
window.plus = {
  runtime: {
    launchScene: ''
  }
};
