// Service Worker - 缓存策略 v3
const CACHE_NAME = 'wolaibang-cache-v3';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/requests.html',
    '/profile.html',
    '/history.html',
    '/about.html',
    '/contact.html',
    '/disclaimer.html',
    '/faq.html',
    '/feedback.html',
    '/guide.html',
    '/privacy.html',
    '/report.html',
    '/terms.html',
    '/test-login.html',
    '/test.html',
    '/css/style.css',
    '/css/mobile-redesign.css',
    '/css/form-modern.css',
    '/js/app.js',
    '/js/utils.js',
    '/favicon.ico'
];

// 安装时缓存静态资源
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: 开始缓存静态资源');
                // 使用 Promise.all 但忽略单个文件失败，避免整个安装失败
                const cachePromises = STATIC_ASSETS.map(asset => {
                    return cache.add(asset)
                        .then(() => {
                            console.log(`Service Worker: 成功缓存 ${asset}`);
                        })
                        .catch((error) => {
                            console.warn(`Service Worker: 缓存 ${asset} 失败（可忽略）:`, error.message);
                        });
                });
                return Promise.all(cachePromises);
            })
            .then(() => {
                console.log('Service Worker: 缓存安装完成');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('Service Worker: 缓存安装过程出错:', error);
                return self.skipWaiting();
            })
    );
});

// 激活时清理旧缓存
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        }).then(() => self.clients.claim())
    );
});

// 拦截请求并使用缓存策略
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // 跳过非 GET 请求
    if (request.method !== 'GET') {
        return;
    }

    // 跳过外部请求和特殊协议
    const currentOrigin = self.location.origin;
    if (url.origin !== currentOrigin || url.protocol === 'chrome-extension:' || url.protocol === 'data:' || url.protocol === 'blob:') {
        return;
    }

    // 跳过不存在的资源和可能失败的请求
    if ((url.pathname.endsWith('.svg') && url.pathname.includes('seed=')) ||
        url.pathname.includes('undefined') ||
        url.pathname === '') {
        return;
    }

    // 只缓存已知的静态资源路径
    const staticPaths = [
        '/index.html',
        '/requests.html',
        '/profile.html',
        '/history.html',
        '/about.html',
        '/contact.html',
        '/disclaimer.html',
        '/faq.html',
        '/feedback.html',
        '/guide.html',
        '/privacy.html',
        '/report.html',
        '/terms.html',
        '/test-login.html',
        '/test.html',
        '/css/',
        '/js/',
        '/images/',
        '/favicon.ico'
    ];

    const shouldCache = staticPaths.some(path => {
        if (path.endsWith('/')) {
            return url.pathname.startsWith(path);
        }
        return url.pathname === path || url.pathname.startsWith(path);
    });

    if (!shouldCache) {
        return;
    }

    // 缓存优先策略
    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
                // 返回缓存的同时，后台更新缓存（带错误处理）
                fetch(request)
                    .then((networkResponse) => {
                        if (networkResponse.ok) {
                            const responseToCache = networkResponse.clone();
                            caches.open(CACHE_NAME).then((cache) => {
                                cache.put(request, responseToCache);
                            });
                        }
                    })
                    .catch((error) => {
                        console.log('Service Worker: 后台缓存更新失败（可忽略）:', error.message);
                    });
                return cachedResponse;
            }

            // 缓存未命中，从网络获取
            return fetch(request)
                .then((networkResponse) => {
                    // 缓存新资源（即使响应不是200也返回，避免阻塞）
                    if (networkResponse.ok) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, responseToCache);
                        });
                    }
                    return networkResponse;
                })
                .catch((error) => {
                    console.error('Service Worker: 网络请求失败', error);
                    // 返回离线响应
                    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
                });
        })
    );
});
