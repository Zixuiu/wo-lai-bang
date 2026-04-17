// 全局状态
var currentFilter = 'all';
var currentCategory = 'all';
var allRequests = [];
var currentUser = null;
var unreadCount = 0;
var currentPosition = null; // 当前位置
var mapMarker = null; // 地图标记
var authToken = null; // JWT令牌
var socket = null; // Socket.IO连接
var wsConnected = false; // WebSocket连接状态
var activeChats = {}; // 活跃的聊天会话
var selectedRequestImages = []; // 需求图片选择
var appVersion = '1.0.8'; // 版本号用于确认文件加载

// 页面跳转函数 - 使用 replace 避免添加历史记录
window.navigateTo = function(url) {
    window.location.replace(url);
};

// 带历史记录的跳转（用于需要返回的场景）
window.navigateToWithHistory = function(url) {
    window.location.href = url;
};

// 强制清除旧的admin登录状态（只有没有token时才清除）
(function() {
    const user = localStorage.getItem('current_user');
    const token = localStorage.getItem('auth_token');
    if (user && !token) {
        try {
            const parsedUser = JSON.parse(user);
            if (parsedUser && parsedUser.username === 'admin') {
                console.log('🚨 检测到admin数据无token，强制清除');
                localStorage.removeItem('auth_token');
                localStorage.removeItem('current_user');
                localStorage.removeItem('saved_username');
                localStorage.removeItem('remember_me');
            }
        } catch (e) {
            // 忽略
        }
    }
})();

// 工具函数 - 确保在全局可用
window.getAvatar = function(seed) {
    return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'%3E%3C/path%3E%3Ccircle cx='12' cy='7' r='4'%3E%3C/circle%3E%3C/svg%3E`;
};

window.calculateDistance = function(lat1, lng1, lat2, lng2) {
    const R = 6371; // 地球半径（公里）
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
};

// 页面预加载功能
(function() {
    // 预加载常用页面
    const pagesToPreload = [
        'index.html',
        'requests.html',
        'profile.html',
        'history.html'
    ];
    
    // 使用 IntersectionObserver 检测用户是否接近导航链接
    if ('IntersectionObserver' in window) {
        const preloadObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const href = entry.target.getAttribute('href');
                    if (href && pagesToPreload.includes(href)) {
                        const link = document.createElement('link');
                        link.rel = 'prefetch';
                        link.href = href;
                        document.head.appendChild(link);
                        preloadObserver.unobserve(entry.target);
                    }
                }
            });
        }, { rootMargin: '100px' });
        
        // 观察所有导航链接
        document.querySelectorAll('a[href]').forEach(link => {
            preloadObserver.observe(link);
        });
    }
    
    // 鼠标悬停预加载
    document.addEventListener('mouseover', function(e) {
        const target = e.target.closest('a[href]');
        if (target) {
            const href = target.getAttribute('href');
            if (href && pagesToPreload.includes(href) && !document.querySelector(`link[rel="prefetch"][href="${href}"]`)) {
                const link = document.createElement('link');
                link.rel = 'prefetch';
                link.href = href;
                document.head.appendChild(link);
            }
        }
    }, { passive: true });
})();

// 获取用户头像（使用本地SVG替代DiceBear API）
function getAvatar(seed) {
    // 使用base64编码的SVG头像，避免依赖外部API
    return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'%3E%3C/path%3E%3Ccircle cx='12' cy='7' r='4'%3E%3C/circle%3E%3C/svg%3E`;
}

// 模拟API对象 - 使用mockData.js中定义的完整mockAPI
// 注意：mockData.js中已经定义了完整的mockAPI对象，包含getRequests方法

// 计算两个坐标之间的距离（公里）
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // 地球半径（公里）
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// 安全检查：确保window.mockAPI具有所有必要的方法
if (typeof window.mockAPI === 'undefined') {
    console.warn('mockAPI未定义，使用默认mockAPI对象');
    window.mockAPI = {
        getCategories: () => ({ success: true, data: [] }),
        getRequests: () => ({ success: true, data: [] }),
        getNearbyRequests: (lat, lng, limit = 10) => {
            // 默认模拟数据
            const mockData = [
                { id: 1, user_id: 1, title: '帮忙搬家具', description: '周末搬家，需要2-3个壮劳力帮忙搬家具，从3楼搬到1楼，大概2小时，有偿！', category: '搬运', location: '北京市朝阳区', lat: 39.9, lng: 116.4, reward: '200元', status: 'pending', created_at: '2026-01-28 09:00:00', completed_at: null, helper_id: null, is_urgent: false, user_nickname: '张三', user_avatar: getAvatar('zhangsan'), user_rating: 4.8 },
                { id: 2, user_id: 2, title: '辅导小学数学', description: '孩子三年级，数学成绩不太好，需要一位有耐心的大学生辅导，每周两次', category: '教育', location: '上海市浦东新区', lat: 31.2, lng: 121.5, reward: '100元/小时', status: 'accepted', created_at: '2026-01-27 14:00:00', completed_at: null, helper_id: 1, is_urgent: false, user_nickname: '李四', user_avatar: getAvatar('lisi'), user_rating: 4.9 },
                { id: 3, user_id: 3, title: '电脑重装系统', description: '电脑中毒了，需要重装系统，最好是Win11，带激活', category: '技术', location: '广州市天河区', lat: 23.1, lng: 113.3, reward: '80元', status: 'completed', created_at: '2026-01-25 10:30:00', completed_at: '2026-01-26 16:00:00', helper_id: 4, is_urgent: false, user_nickname: '王五', user_avatar: getAvatar('wangwu'), user_rating: 4.7 },
                { id: 4, user_id: 4, title: '帮忙遛狗', description: '临时出差3天，需要有人帮忙照顾家里的金毛，每天遛两次', category: '宠物', location: '深圳市南山区', lat: 22.5, lng: 114.0, reward: '150元/天', status: 'pending', created_at: '2026-01-29 08:00:00', completed_at: null, helper_id: null, is_urgent: false, user_nickname: '赵六', user_avatar: getAvatar('zhaoliu'), user_rating: 5.0 }
            ];

            // 计算距离并排序
            const withDistance = mockData.map(req => ({
                ...req,
                distance: calculateDistance(lat, lng, req.lat, req.lng)
            })).sort((a, b) => a.distance - b.distance);

            return {
                success: true,
                data: withDistance.slice(0, limit)
            };
        },
        getUsers: () => ({ success: true, data: [] }),
        getUnreadNotificationCount: () => ({ success: true, data: { count: 0 } }),
        getUser: (id) => ({
            success: false,
            message: '用户不存在'
        }),
        getBadges: () => ({ success: true, data: [] }),
        getNotifications: (userId) => ({ success: true, data: [] }),
        markNotificationRead: (notificationId) => ({ success: true }),
        getMyRequests: (userId) => ({ success: true, data: [] })
    };
} else {
    // 补充缺失的方法
    if (typeof window.mockAPI.getCategories === 'undefined') {
        window.mockAPI.getCategories = () => ({ success: true, data: [] });
    }
    if (typeof window.mockAPI.getRequests === 'undefined') {
        window.mockAPI.getRequests = () => ({ success: true, data: [] });
    }
    if (typeof window.mockAPI.getNearbyRequests === 'undefined') {
        window.mockAPI.getNearbyRequests = (lat, lng, limit = 10) => {
            // 尝试从getRequests获取数据
            const allReqs = window.mockAPI.getRequests().data || [];
            const withDistance = allReqs
                .filter(req => req.lat && req.lng)
                .map(req => ({
                    ...req,
                    distance: calculateDistance(lat, lng, req.lat, req.lng)
                }))
                .sort((a, b) => a.distance - b.distance);

            return {
                success: true,
                data: withDistance.slice(0, limit)
            };
        };
    }
    if (typeof window.mockAPI.getUsers === 'undefined') {
        window.mockAPI.getUsers = () => ({ success: true, data: [] });
    }
    if (typeof window.mockAPI.getUnreadNotificationCount === 'undefined') {
        window.mockAPI.getUnreadNotificationCount = () => ({ success: true, data: { count: 0 } });
    }
    if (typeof window.mockAPI.getBadges === 'undefined') {
        window.mockAPI.getBadges = () => ({ success: true, data: [] });
    }
    if (typeof window.mockAPI.getNotifications === 'undefined') {
        window.mockAPI.getNotifications = (userId) => ({ success: true, data: [] });
    }
    if (typeof window.mockAPI.markNotificationRead === 'undefined') {
        window.mockAPI.markNotificationRead = (notificationId) => ({ success: true });
    }
    if (typeof window.mockAPI.getMyRequests === 'undefined') {
        window.mockAPI.getMyRequests = (userId) => ({ success: true, data: [] });
    }
}

// 确保在当前作用域中可以访问mockAPI
// 注意：不需要重新声明mockAPI，因为它已经在全局作用域中可用

// WebSocket 连接
let wsReconnectAttempts = 0;
const MAX_WS_RECONNECT_ATTEMPTS = 5;

// 常量配置
const CONFIG = {
    ANIMATION_DURATION: 1500,
    ANIMATION_STEPS: 50,
    ANIMATION_INTERVAL: 30,
    MAX_TITLE_LENGTH: 100,
    MAX_DESCRIPTION_LENGTH: 1000,
    API_BASE_URL: '/api',
    CACHE_DURATION: 5 * 60 * 1000, // 缓存5分钟
    DEBOUNCE_DELAY: 300, // 防抖延迟300ms
    THROTTLE_DELAY: 1000, // 节流延迟1s
    WS_URL: '/socket.io/?EIO=4&transport=websocket', // WebSocket 地址 (Socket.IO 格式)
    WS_RECONNECT_DELAY: 3000 // WebSocket 重连延迟
};

// 缓存管理器
const CacheManager = {
    cache: new Map(),
    
    set(key, value, duration = CONFIG.CACHE_DURATION) {
        this.cache.set(key, {
            value,
            expiry: Date.now() + duration
        });
    },
    
    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;
        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            return null;
        }
        return item.value;
    },
    
    clear() {
        this.cache.clear();
    },
    
    delete(key) {
        this.cache.delete(key);
    }
};

// 防抖函数
function debounce(func, wait = CONFIG.DEBOUNCE_DELAY) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 节流函数
function throttle(func, limit = CONFIG.THROTTLE_DELAY) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// 按钮loading状态
function setButtonLoading(btn, loading, originalText = null) {
    if (!btn) return;
    if (loading) {
        btn.disabled = true;
        btn.dataset.originalText = btn.textContent;
        btn.innerHTML = '<span class="btn-loading">⏳</span> 处理中...';
    } else {
        btn.disabled = false;
        btn.innerHTML = btn.dataset.originalText || originalText || btn.textContent;
    }
}

// 图片懒加载
function lazyLoadImages() {
    const images = document.querySelectorAll('img[data-src]');
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                observer.unobserve(img);
            }
        });
    });
    
    images.forEach(img => imageObserver.observe(img));
}

// HTML 转义函数 - 防止 XSS 攻击
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 统一登录检查装饰器
function requireAuth(callback) {
    return function(...args) {
        if (!currentUser) {
            showToast('请先登录', 'warning');
            showLoginModal();
            return;
        }
        return callback.apply(this, args);
    };
}

// 跳转到消息页面（未登录则提示并跳转登录）
function goToNotifications() {
    if (!currentUser) {
        showToast('请登录后再体验此功能！', 'warning');
        setTimeout(() => {
            window.location.href = 'index.html?showLogin=1';
        }, 1500);
        return;
    }
    window.location.href = 'notifications.html';
}

// 滚动到指定section
function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', async () => {
    await initApp();
});

// 创建交易
async function createTransaction(amount) {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/transaction`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken || localStorage.getItem('auth_token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ amount })
        });
        return await response.json();
    } catch (error) {
        console.error('交易失败:', error);
        return { success: false, message: '交易失败' };
    }
}

// 初始化应用
async function initApp() {
    try {
        console.log('=== initApp 开始 ===');
        console.log('localStorage auth_token:', localStorage.getItem('auth_token'));
        console.log('localStorage current_user:', localStorage.getItem('current_user'));
        // 从本地存储加载认证状态
        loadAuthState();
        console.log('loadAuthState 后 currentUser:', currentUser);
        await loadCurrentUser();
        console.log('loadCurrentUser 后 currentUser:', currentUser);
        
        // 只在有 categories-grid 元素的页面加载分类
        if (document.getElementById('categories-grid')) {
            console.log('页面有 categories-grid，调用 loadCategories()');
            await loadCategories();
        } else {
            console.log('页面没有 categories-grid，跳过 loadCategories()');
        }
        
        // 只在有 requests-grid 元素的页面加载需求列表
        if (document.getElementById('requests-grid')) {
            console.log('页面有 requests-grid，调用 loadRequests()');
            
            // 检查是否需要刷新（从发布页面跳转回来）
            if (localStorage.getItem('needsRefresh') === 'true') {
                console.log('从发布页面返回，强制刷新列表');
                localStorage.removeItem('needsRefresh');
                // 强制从API获取最新数据
                allRequests = [];
            }
            
            await loadRequests();
        } else {
            console.log('页面没有 requests-grid，跳过 loadRequests()');
        }
        
        loadUsersForHome();
        
        // 非首屏功能延迟加载（提升首屏加载速度）
        setTimeout(() => {
            console.log('>>> app.js setTimeout callback, loadNotifications type:', typeof loadNotifications);
            loadStats();
            loadNotifications();
        }, 1000);
        
        setupEventListeners();
        updateNavbar();
        initFormValidation();
        
        // WebSocket延迟初始化（聊天才需要）
        setTimeout(() => {
            initWebSocket();
        }, 2000);
        
        // 为导航链接添加点击事件
        document.querySelectorAll('.nav-menu a').forEach(link => {
            link.addEventListener('click', handleNavClick);
        });
        
        // 为logo添加点击事件
        const logo = document.querySelector('.logo');
        if (logo) {
            logo.addEventListener('click', function(event) {
                // 如果已经在首页，则滚动到顶部
                if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
                    event.preventDefault();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
                // 其他情况保持默认行为，跳转到首页
            });
        }
        
        console.log('=== initApp 结束 ===');
    } catch (error) {
        console.error('initApp 出错:', error);
    }
}

// 初始化WebSocket连接
function initWebSocket() {
    // 使用Socket.IO客户端库
    const socketUrl = window.location.origin;
    
    try {
        // 创建Socket.IO连接
        socket = io(socketUrl, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 3000
        });
        
        socket.on('connect', function() {
            console.log('Socket.IO连接已建立');
            wsConnected = true;
            wsReconnectAttempts = 0;
            
            // 如果用户已登录，进行认证
            if (currentUser) {
                authenticateWebSocket();
            }
        });
        
        socket.on('disconnect', function() {
            console.log('Socket.IO连接已断开');
            wsConnected = false;
        });
        
        socket.on('connected', function(data) {
            console.log('服务器连接确认:', data);
        });
        
        socket.on('auth_success', function(data) {
            console.log('WebSocket认证成功:', data);
        });
        
        socket.on('auth_error', function(data) {
            console.error('WebSocket认证失败:', data);
        });
        
        socket.on('new_message', function(data) {
            handleNewMessage(data);
        });
        
        socket.on('message_sent', function(data) {
            console.log('消息发送成功:', data);
        });
        
        socket.on('notification', function(data) {
            handleNotification(data);
        });
        
        socket.on('error', function(data) {
            console.error('Socket.IO错误:', data);
        });
        
        socket.on('connect_error', function(error) {
            console.error('Socket.IO连接错误:', error);
        });
        
    } catch (error) {
        console.error('初始化WebSocket失败:', error);
    }
}

// 重新连接WebSocket
function reconnectWebSocket() {
    if (wsReconnectAttempts >= MAX_WS_RECONNECT_ATTEMPTS) {
        console.log('WebSocket重连失败，已达到最大尝试次数');
        return;
    }
    
    wsReconnectAttempts++;
    console.log(`尝试重新连接WebSocket (${wsReconnectAttempts}/${MAX_WS_RECONNECT_ATTEMPTS})`);
    
    if (socket) {
        socket.connect();
    }
}

// 认证WebSocket连接
function authenticateWebSocket() {
    if (wsConnected && currentUser) {
        socket.emit('auth', { userId: currentUser.id });
        console.log('WebSocket认证消息已发送');
    }
}

// 处理WebSocket消息
function handleWebSocketMessage(message) {
    const [event, data] = message;
    
    switch (event) {
        case 'connected':
            console.log('WebSocket连接成功:', data);
            break;
        case 'auth_success':
            console.log('WebSocket认证成功:', data);
            break;
        case 'auth_error':
            console.error('WebSocket认证失败:', data);
            break;
        case 'new_message':
            handleNewMessage(data);
            break;
        case 'message_sent':
            console.log('消息发送成功:', data);
            break;
        case 'notification':
            handleNotification(data);
            break;
        default:
            console.log('未知的WebSocket事件:', event, data);
    }
}

// 处理新消息
function handleNewMessage(data) {
    console.log('收到新消息:', data);
    
    // 如果是当前活跃聊天的消息，更新聊天界面
    const chatId = `${Math.min(data.senderId, currentUser.id)}_${Math.max(data.senderId, currentUser.id)}`;
    if (activeChats[chatId]) {
        addMessageToChat(data.senderId, data.message, data.requestId, data.timestamp);
    } else {
        // 显示消息通知
        showNotification(`收到来自用户 ${data.senderId} 的新消息`);
        // 更新未读消息计数
        unreadCount++;
        updateNotificationBadge();
    }
}

// 发送消息
function sendMessage(receiverId, message, requestId = null) {
    if (!currentUser) {
        showLoginModal();
        return;
    }
    
    if (!wsConnected) {
        showError('消息发送失败，请检查网络连接');
        return;
    }
    
    const messageData = {
        senderId: currentUser.id,
        receiverId: receiverId,
        message: message,
        requestId: requestId
    };
    
    // 发送WebSocket消息
    socket.emit('send_message', messageData);
    
    // 本地添加消息到聊天界面
    const chatId = `${Math.min(currentUser.id, receiverId)}_${Math.max(currentUser.id, receiverId)}`;
    if (activeChats[chatId]) {
        addMessageToChat(currentUser.id, message, requestId, new Date().toISOString());
    }
}

// 显示聊天窗口
function showChatWindow(userId, userName) {
    if (!currentUser) {
        showLoginModal();
        return;
    }
    
    // 构建聊天ID
    const chatId = `${Math.min(currentUser.id, userId)}_${Math.max(currentUser.id, userId)}`;
    
    // 检查是否已存在聊天窗口
    if (!activeChats[chatId]) {
        // 创建聊天窗口
        const chatWindow = createChatWindow(chatId, userId, userName);
        document.body.appendChild(chatWindow);
        activeChats[chatId] = {
            userId: userId,
            userName: userName,
            element: chatWindow
        };
        
        // 加载聊天历史
        loadChatHistory(userId);
    } else {
        // 显示已存在的聊天窗口
        activeChats[chatId].element.style.display = 'block';
    }
}

// 创建聊天窗口
function createChatWindow(chatId, userId, userName) {
    const chatWindow = document.createElement('div');
    chatWindow.className = 'chat-window';
    chatWindow.id = `chat-${chatId}`;
    chatWindow.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 350px;
        height: 450px;
        background: white;
        border: 1px solid #ddd;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        display: flex;
        flex-direction: column;
        z-index: 1000;
    `;
    
    chatWindow.innerHTML = `
        <div class="chat-header" style="padding: 10px; border-bottom: 1px solid #ddd; display: flex; justify-content: space-between; align-items: center;">
            <h3>${userName}</h3>
            <button onclick="closeChatWindow('${chatId}')" style="background: none; border: none; cursor: pointer; font-size: 16px;">&times;</button>
        </div>
        <div class="chat-search" style="padding: 8px; border-bottom: 1px solid #eee;">
            <input type="text" placeholder="搜索聊天记录..." onkeyup="searchChatHistory(this.value, '${chatId}')" style="width: 100%; padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; box-sizing: border-box;">
        </div>
        <div class="chat-messages" style="flex: 1; padding: 10px; overflow-y: auto;"></div>
        <div class="chat-input" style="padding: 10px; border-top: 1px solid #ddd; display: flex; align-items: center; gap: 8px;">
            <input type="file" accept="image/*" id="chat-image-${chatId}" onchange="sendChatImage('${chatId}', '${userId}', this)" style="display: none;">
            <button onclick="document.getElementById('chat-image-${chatId}').click()" style="padding: 6px 10px; background: #f0f0f0; border: none; border-radius: 4px; cursor: pointer; font-size: 16px;">📷</button>
            <input type="text" placeholder="输入消息..." onkeyup="if(event.key==='Enter')sendChatMessage('${userId}', '${chatId}')" style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            <button onclick="sendChatMessage('${userId}', '${chatId}')" style="padding: 0 15px; background: #059669; color: white; border: none; border-radius: 4px; cursor: pointer;">发送</button>
        </div>
    `;
    
    return chatWindow;
}

// 聊天记录搜索
function searchChatHistory(keyword, chatId) {
    const chatWindow = document.getElementById(`chat-${chatId}`);
    if (!chatWindow) return;
    
    const messages = chatWindow.querySelectorAll('.message');
    keyword = keyword.toLowerCase();
    
    messages.forEach(msg => {
        const text = msg.textContent.toLowerCase();
        msg.style.display = text.includes(keyword) ? 'flex' : 'none';
    });
}

// 发送聊天图片
async function sendChatImage(chatId, receiverId, input) {
    const file = input.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        showToast('请选择图片文件', 'error');
        return;
    }
    
    // 压缩图片
    const compressed = await compressImage(file, 800, 0.7);
    
    // 显示图片消息
    const chatWindow = document.getElementById(`chat-${chatId}`);
    const messagesContainer = chatWindow.querySelector('.chat-messages');
    const reader = new FileReader();
    reader.onload = (e) => {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message sent';
        msgDiv.style.cssText = 'display: flex; margin: 5px 0; justify-content: flex-end;';
        msgDiv.innerHTML = `<img src="${e.target.result}" style="max-width: 200px; max-height: 150px; border-radius: 8px; border: 1px solid #ddd;">`;
        messagesContainer.appendChild(msgDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    };
    reader.readAsDataURL(compressed);
    
    // 上传到服务器
    const formData = new FormData();
    formData.append('image', compressed);
    formData.append('receiver_id', receiverId);
    
    try {
        const response = await fetch(CONFIG.API_BASE_URL + '/messages/image', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken || localStorage.getItem('auth_token')}` },
            body: formData
        });
        
        const result = await response.json();
        if (!result.success) {
            showToast('图片发送失败', 'error');
        }
    } catch (e) {
        showToast('发送失败', 'error');
    }
    
    input.value = '';
}

// 关闭聊天窗口
function closeChatWindow(chatId) {
    if (activeChats[chatId]) {
        activeChats[chatId].element.remove();
        delete activeChats[chatId];
    }
}

// 发送聊天消息
function sendChatMessage(receiverId, chatId) {
    const chatWindow = document.getElementById(`chat-${chatId}`);
    const input = chatWindow.querySelector('input');
    const message = input.value.trim();
    
    if (message) {
        sendMessage(receiverId, message);
        input.value = '';
    }
}

// 添加消息到聊天界面
function addMessageToChat(senderId, message, requestId, timestamp, isRead = true, messageType = 'text') {
    const chatId = `${Math.min(currentUser.id, senderId)}_${Math.max(currentUser.id, senderId)}`;
    const chatWindow = document.getElementById(`chat-${chatId}`);
    
    if (chatWindow) {
        const messagesContainer = chatWindow.querySelector('.chat-messages');
        const messageElement = document.createElement('div');
        const isSent = senderId === currentUser.id;
        messageElement.className = isSent ? 'message sent' : 'message received';
        messageElement.style.cssText = `
            margin: 10px 0;
            padding: 10px;
            border-radius: 8px;
            display: flex;
            flex-direction: column;
            ${isSent ? 'background: #e6f7ee; align-self: flex-end; max-width: 80%;' : 'background: #f3f4f6; align-self: flex-start; max-width: 80%;'}
        `;
        
        let messageContent = '';
        if (messageType === 'image') {
            messageContent = `<img src="${message}" style="max-width: 200px; max-height: 150px; border-radius: 8px; cursor: pointer;" onclick="window.open('${message}', '_blank')">`;
        } else {
            messageContent = `<div>${message}</div>`;
        }
        
        const readStatus = isSent ? (isRead ? '<span style="color:#22c55e;font-size:10px;">✓已读</span>' : '<span style="color:#999;font-size:10px;">✓</span>') : '';
        
        messageElement.innerHTML = `
            <div style="font-size: 12px; color: #666; margin-bottom: 5px; display: flex; justify-content: space-between; gap: 8px;">
                <span>${isSent ? '我' : '对方'} ${formatTime(timestamp)}</span>
                ${readStatus}
            </div>
            ${messageContent}
        `;
        
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // 收到消息标记为已读
        if (!isSent) {
            markConversationRead(senderId);
        }
    }
}

// 加载聊天历史
async function loadChatHistory(userId) {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/messages?user_id=${userId}`, {
            headers: {
                'Authorization': `Bearer ${authToken || localStorage.getItem('auth_token')}`
            }
        });
        
        const result = await response.json();
        if (result.success) {
            const chatId = `${Math.min(currentUser.id, userId)}_${Math.max(currentUser.id, userId)}`;
            if (activeChats[chatId]) {
                result.data.forEach(message => {
                    const msgType = message.message_type || 'text';
                    const isRead = message.is_read !== 0 && message.is_read !== false;
                    addMessageToChat(message.sender_id, message.content, message.request_id, message.created_at, isRead, msgType);
                });
            }
        }
    } catch (error) {
        console.error('加载聊天历史失败:', error);
    }
}

// 标记会话为已读
async function markConversationRead(otherUserId) {
    try {
        await fetch(`${CONFIG.API_BASE_URL}/messages/conversations/${otherUserId}/read`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken || localStorage.getItem('auth_token')}`
            }
        });
    } catch (e) {}
}

// 显示通知
function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px;
        background: #059669;
        color: white;
        border-radius: 4px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// 处理通知
function handleNotification(data) {
    console.log('收到通知:', data);
    showNotification(data.message || '新通知');
}

// 从本地存储加载认证状态
function loadAuthState() {
    const token = localStorage.getItem('auth_token');
    const user = localStorage.getItem('current_user');
    
    // 检查是否是旧的admin数据（没有token）
    if (user) {
        try {
            const parsedUser = JSON.parse(user);
            if (parsedUser && parsedUser.username === 'admin' && !token) {
                console.warn('检测到旧的admin登录状态，强制清除所有数据');
                clearAuthState();
                return;
            }
        } catch (e) {
            // 解析失败，继续处理
        }
    }
    
    // 必须同时存在 token 和 user 才恢复登录状态
    if (token && user) {
        authToken = token;
        try {
            currentUser = JSON.parse(user);
        } catch (e) {
            console.error('解析用户数据失败:', e);
            clearAuthState();
        }
    } else {
        // 缺少任一数据都清除登录状态
        clearAuthState();
    }
}

// 保存认证状态到本地存储
function saveAuthState(token, user) {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('current_user', JSON.stringify(user));
    authToken = token;
    currentUser = user;
}

// 清除认证状态
function clearAuthState() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('current_user');
    localStorage.removeItem('saved_username');
    localStorage.removeItem('remember_me');
    authToken = null;
    currentUser = null;
}

// 自动填充已保存的登录信息
function fillSavedLoginInfo() {
    const savedUsername = localStorage.getItem('saved_username');
    const rememberMe = localStorage.getItem('remember_me');
    
    if (savedUsername && rememberMe === 'true') {
        const usernameInput = document.querySelector('#login-form input[name="username"]');
        const rememberCheckbox = document.querySelector('#login-form input[name="remember"]');
        
        if (usernameInput) {
            usernameInput.value = savedUsername;
        }
        if (rememberCheckbox) {
            rememberCheckbox.checked = true;
        }
        console.log('已自动填充保存的登录信息');
    }
}

// 显示登录弹窗
function showLoginModal() {
    try {
        const modal = document.getElementById('login-modal');
        if (modal) {
            // 将弹窗移到 body 最后，确保在最上层
            document.body.appendChild(modal);
            modal.classList.add('active');
            
            // 自动填充已保存的登录信息
            fillSavedLoginInfo();
        } else {
            // 如果当前页面没有登录弹窗，跳转到首页并显示登录
            const currentPath = window.location.pathname;
            if (!currentPath.endsWith('index.html') && currentPath !== '/') {
                window.location.href = 'index.html?showLogin=true';
            }
        }
    } catch (error) {
        console.error('showLoginModal 出错:', error);
    }
}

// 切换密码显示/隐藏
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
    input.setAttribute('type', type);
}

// 关闭登录弹窗
function closeLoginModal() {
    console.log('closeLoginModal called');
    const modal = document.getElementById('login-modal');
    console.log('login-modal element:', modal);
    if (modal) {
        modal.classList.remove('active');
        console.log('login-modal active class removed');
    } else {
        console.error('login-modal element not found');
    }
}

// 显示注册页面
function showRegisterModal() {
    console.log('showRegisterModal 被调用');
    window.location.href = 'register.html';
}

// 关闭注册弹窗
function closeRegisterModal() {
    document.getElementById('register-modal').classList.remove('active');
}

// 显示忘记密码弹窗
function showForgotModal(event) {
    console.log('showForgotModal called');
    if (event && event.preventDefault) {
        event.preventDefault();
        event.stopPropagation();
    }
    const loginModal = document.getElementById('login-modal');
    const forgotModal = document.getElementById('forgot-modal');
    console.log('forgotModal:', forgotModal);
    
    if (forgotModal) {
        if (loginModal) {
            loginModal.classList.remove('active');
        }
        // 将忘记密码弹窗移到 body 最后，确保在最上层
        document.body.appendChild(forgotModal);
        forgotModal.classList.add('active');
    } else {
        // 当前页面没有忘记密码弹窗，跳转到首页
        console.log('forgot-modal not found, redirecting to index');
        window.location.href = 'index.html?showForgot=true';
    }
}

// 关闭忘记密码弹窗
function closeForgotModal() {
    document.getElementById('forgot-modal').classList.remove('active');
    setTimeout(resetForgotForm, 300);
}

// 发送忘记密码验证码
let forgotCountdown = 0;
let forgotCountdownTimer = null;

async function sendForgotCode() {
    const contact = document.getElementById('forgot-contact');
    const btn = document.getElementById('forgot-send-code-btn');
    
    if (!contact || !contact.value) {
        showToast('请输入邮箱', 'error');
        return;
    }
    
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(contact.value)) {
        showToast('请输入正确的邮箱格式', 'error');
        return;
    }
    
    window.forgotContact = contact.value;
    
    if (forgotCountdown > 0) return;
    
    btn.disabled = true;
    btn.textContent = '发送中...';
    
    try {
        const response = await fetch(CONFIG.API_BASE_URL + '/auth/send-verification-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: contact.value, type: 'forgot_password' })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('验证码已发送', 'success');
            if (result.data && result.data.code) {
                console.log('找回密码验证码:', result.data.code);
            }
            forgotCountdown = 60;
            btn.textContent = `${forgotCountdown}s`;
            forgotCountdownTimer = setInterval(() => {
                forgotCountdown--;
                if (forgotCountdown <= 0) {
                    clearInterval(forgotCountdownTimer);
                    btn.disabled = false;
                    btn.textContent = '获取验证码';
                } else {
                    btn.textContent = `${forgotCountdown}s`;
                }
            }, 1000);
        } else {
            showToast(result.message || '发送失败', 'error');
            btn.disabled = false;
            btn.textContent = '获取验证码';
        }
    } catch (error) {
        showToast('发送失败', 'error');
        btn.disabled = false;
        btn.textContent = '获取验证码';
    }
}

// 密码强度检查
function checkPasswordStrength(password, prefix) {
    const fill = document.getElementById(prefix + '-fill');
    const text = document.getElementById(prefix + '-text');
    if (!fill || !text) return;
    
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 8) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;
    
    fill.className = 'strength-fill';
    text.className = 'strength-text';
    
    if (score <= 2) {
        fill.classList.add('weak');
        text.classList.add('weak');
        text.textContent = '密码强度：弱';
    } else if (score <= 3) {
        fill.classList.add('medium');
        text.classList.add('medium');
        text.textContent = '密码强度：中等';
    } else {
        fill.classList.add('strong');
        text.classList.add('strong');
        text.textContent = '密码强度：强';
    }
}

// 忘记密码：直接提交
async function handleForgotStep1(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const contact = document.getElementById('forgot-contact').value;
    const code = document.getElementById('forgot-code').value;
    const newPassword = document.getElementById('forgot-new-password').value;
    const confirmPassword = document.getElementById('forgot-confirm-password').value;
    
    if (!contact) {
        showToast('请输入邮箱', 'error');
        return false;
    }
    
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(contact)) {
        showToast('请输入正确的邮箱格式', 'error');
        return false;
    }
    
    if (!code || code.length !== 6) {
        showToast('请输入6位验证码', 'error');
        return false;
    }
    
    if (!newPassword) {
        showToast('请输入新密码', 'error');
        return false;
    }
    
    if (newPassword !== confirmPassword) {
        showToast('两次密码不一致', 'error');
        return false;
    }
    
    window.forgotContact = contact;
    
    try {
        const response = await fetch(CONFIG.API_BASE_URL + '/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: contact,
                code: code,
                new_password: newPassword
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('密码重置成功，请登录', 'success');
            closeForgotModal();
            resetForgotForm();
            setTimeout(() => showLoginModal(), 300);
        } else {
            showToast(result.message || '重置失败', 'error');
        }
    } catch (error) {
        showToast('重置失败，请检查网络', 'error');
    }
    
    return false;
}

// 重新发送验证码
async function resendForgotCode() {
    const btn = document.getElementById('resend-code-btn');
    if (!btn || btn.disabled) return;
    
    const contact = window.forgotContact;
    if (!contact) {
        showToast('请先输入邮箱', 'error');
        return;
    }
    
    // 启动倒计时
    startResendCountdown();
    
    // 调用API发送验证码
    try {
        const response = await fetch(CONFIG.API_BASE_URL + '/auth/send-verification-code', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email: contact, type: 'forgot_password' })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('验证码已重新发送，请查看邮箱', 'success');
            // 测试环境下显示验证码
            if (result.data && result.data.code) {
                console.log('找回密码测试验证码:', result.data.code);
            }
        } else {
            showToast(result.message || '发送验证码失败', 'error');
        }
    } catch (error) {
        console.error('发送验证码错误:', error);
        showToast('发送验证码失败，请检查网络连接', 'error');
    }
}

// 重置忘记密码表单
function resetForgotForm() {
    document.getElementById('forgot-step-1').style.display = 'block';
    document.getElementById('forgot-step-2').style.display = 'none';
    document.getElementById('forgot-step-3').style.display = 'none';
    document.getElementById('forgot-subtitle').textContent = '请输入您的邮箱';
    document.getElementById('forgot-contact').value = '';
    document.getElementById('forgot-code').value = '';
    document.getElementById('forgot-new-password').value = '';
    document.getElementById('forgot-confirm-password').value = '';
    window.forgotContact = null;
}

// 处理登录
async function handleLogin(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    
    const data = {
        username: formData.get('username'),
        password: formData.get('password')
    };
    const remember = formData.get('remember') === 'on';
    
    console.log('=== handleLogin 开始 ===');
    console.log('登录用户名:', data.username);
    console.log('记住我:', remember);
    
    try {
        console.log('尝试调用登录API...');
        const response = await fetch(CONFIG.API_BASE_URL + '/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        console.log('登录API响应状态:', response.status);
        const result = await response.json();
        console.log('登录API响应:', result);
        
        if (result.success) {
            console.log('登录成功，保存认证状态');
            console.log('用户ID:', result.data.user_id);
            console.log('用户名:', result.data.username);
            console.log('昵称:', result.data.nickname);
            
            // 保存认证状态
            const userData = {
                id: result.data.user_id,
                username: result.data.username,
                nickname: result.data.nickname,
                avatar: result.data.avatar || getAvatar(result.data.username),
                payment_qr_code: result.data.payment_qr_code,
                payment_qr_type: result.data.payment_qr_type
            };
            console.log('准备保存的用户数据:', userData);
            
            saveAuthState(result.data.access_token, userData);
            
            // 如果勾选"记住我"，保存用户名（不再保存密码，安全考虑）
            if (remember) {
                localStorage.setItem('saved_username', data.username);
                localStorage.setItem('remember_me', 'true');
            } else {
                localStorage.removeItem('saved_username');
                localStorage.removeItem('remember_me');
            }
            localStorage.removeItem('saved_password');
            
            // 更新UI
            console.log('更新导航栏...');
            console.log('currentUser:', currentUser);
            console.log('authToken:', authToken);
            console.log('localStorage:', localStorage.getItem('auth_token'), localStorage.getItem('current_user'));
            updateNavbar();
            closeLoginModal();
            showToast('登录成功！', 'success');
            
            // 重新加载数据
            console.log('重新加载用户数据...');
            await loadCurrentUser();
            await loadRequests();
            
            // 如果有待填充的场景数据，登录后继续打开发布弹窗
            if (window.pendingSceneData) {
                showPublishModal();
            }
            
            // 如果存在 updateProfileUI 函数（profile 页面），调用它更新 UI
            console.log('检查 updateProfileUI:', typeof updateProfileUI);
            if (typeof updateProfileUI === 'function') {
                console.log('调用 updateProfileUI');
                updateProfileUI();
            }
        } else {
            console.error('登录失败:', result.message);
            showError(result.message || '登录失败');
        }
    } catch (error) {
        console.error('登录错误:', error);
        showError('登录失败，请检查网络连接');
    }
    console.log('=== handleLogin 结束 ===');
}

// 验证码倒计时
let verificationCodeCountdown = 0;

// 发送验证码
async function sendVerificationCode() {
    const emailInput = document.getElementById('register-email');
    const sendBtn = document.getElementById('send-code-btn');
    
    if (!emailInput || !emailInput.value) {
        showError('请先输入邮箱地址');
        return;
    }
    
    const email = emailInput.value;
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
        showError('请输入正确的邮箱格式');
        return;
    }
    
    // 禁用按钮并开始倒计时
    sendBtn.disabled = true;
    verificationCodeCountdown = 60;
    sendBtn.textContent = `${verificationCodeCountdown}秒后重试`;
    
    const countdownInterval = setInterval(() => {
        verificationCodeCountdown--;
        if (verificationCodeCountdown > 0) {
            sendBtn.textContent = `${verificationCodeCountdown}秒后重试`;
        } else {
            clearInterval(countdownInterval);
            sendBtn.disabled = false;
            sendBtn.textContent = '获取验证码';
        }
    }, 1000);
    
    try {
        const response = await fetch(CONFIG.API_BASE_URL + '/auth/send-verification-code', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email: email, type: 'register' })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('验证码已发送，请查看邮箱', 'success');
            // 测试环境下显示验证码
            if (result.data && result.data.code) {
                console.log('注册测试验证码:', result.data.code);
            }
        } else {
            showError(result.message || '发送验证码失败');
            // 重置倒计时
            clearInterval(countdownInterval);
            sendBtn.disabled = false;
            sendBtn.textContent = '获取验证码';
        }
    } catch (error) {
        console.error('发送验证码错误:', error);
        showError('发送验证码失败，请检查网络连接');
        // 重置倒计时
        clearInterval(countdownInterval);
        sendBtn.disabled = false;
        sendBtn.textContent = '获取验证码';
    }
}

// 处理注册
async function handleRegister(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    
    const data = {
        nickname: formData.get('nickname'),
        password: formData.get('password'),
        phone: formData.get('phone'),
        email: formData.get('email'),
        verification_code: formData.get('verification_code')
    };
    
    // 验证必填字段
    if (!data.nickname || !data.password || !data.email || !data.verification_code) {
        console.log('缺少必填字段:', data);
        showError('请填写所有必填字段');
        return;
    }
    
    console.log('注册数据:', data);
    
    try {
        const response = await fetch(CONFIG.API_BASE_URL + '/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        console.log('注册响应状态:', response.status);
        
        const result = await response.json();
        console.log('注册响应:', result);
        
        if (result.success) {
            // 保存认证状态
            saveAuthState(result.data.access_token, {
                id: result.data.user_id,
                username: result.data.username,
                nickname: result.data.nickname,
                avatar: getAvatar(result.data.username)
            });
            
            // 更新UI
            updateNavbar();
            closeRegisterModal();
            showToast('注册成功！', 'success');
            
            // 重新加载数据
            loadCurrentUser();
            loadRequests();
        } else {
            showError(result.message || '注册失败');
        }
    } catch (error) {
        console.error('注册错误:', error);
        showError('注册失败，请检查网络连接');
    }
}

// 显示用户信息弹窗
// 退出登录
function logout() {
    showConfirmModal('退出登录', '确定要退出当前账号吗？', () => {
        clearAuthState();
        unreadCount = 0;
        updateNotificationBadge();
        updateUnreadBadge();
        updateNavbar();
        showToast('已退出登录', 'success');
        
        // 清除 URL 参数
        if (window.history.replaceState) {
            window.history.replaceState({}, document.title, window.location.pathname);
        }
        
        // 标记为主动退出登录（profile.html 用此判断不弹登录框）
        sessionStorage.setItem('just_logged_out', 'true');
        
        // 确保页面完全刷新
        setTimeout(() => {
            window.location.reload();
        }, 300);
    });
}

// 更新导航栏
function updateNavbar() {
    console.log('=== updateNavbar 开始 ===');
    const userAvatar = document.querySelector('.user-menu .user-header .user-avatar');
    const userHeader = document.querySelector('.user-menu .user-header');
    const userName = document.querySelector('.user-menu .user-header .user-name');
    const adminItems = document.querySelectorAll('.admin-only');

    console.log('updateNavbar - userAvatar:', userAvatar);
    console.log('updateNavbar - userHeader:', userHeader);
    console.log('updateNavbar - userName:', userName);
    console.log('updateNavbar - currentUser:', currentUser);

    // 检查是否存在用户相关元素
    const hasUserElements = userHeader !== null;

    if (hasUserElements) {
        if (currentUser) {
            // 显示用户信息
            console.log('updateNavbar - currentUser.avatar:', currentUser.avatar);
            console.log('updateNavbar - currentUser.username:', currentUser.username);
            console.log('updateNavbar - currentUser.nickname:', currentUser.nickname);

            if (userAvatar) {
                const avatarImg = userAvatar.querySelector('img');
                if (avatarImg) {
                    try {
                        const avatarSrc = currentUser.avatar || getAvatar(currentUser.username || 'user');
                        console.log('updateNavbar - 设置头像:', avatarSrc);
                        avatarImg.src = avatarSrc;
                        userAvatar.classList.remove('no-border');
                        console.log('updateNavbar - 头像设置成功');
                    } catch (error) {
                        console.error('updateNavbar - 设置头像失败:', error);
                        avatarImg.src = getAvatar('user');
                    }
                }
            }

            if (userName) {
                userName.textContent = currentUser.nickname || currentUser.username || '用户';
            }
            if (userHeader) {
                userHeader.onclick = toggleUserMenu;
                userHeader.style.cursor = 'pointer';
            }
        } else {
            // 显示登录按钮
            if (userAvatar) {
                const avatarImg = userAvatar.querySelector('img');
                if (avatarImg) {
                    avatarImg.src = getAvatar('guest');
                }
                userAvatar.classList.add('no-border');
            }
            if (userName) {
                userName.textContent = '未登录';
            }
            if (userHeader) {
                userHeader.onclick = showLoginModal;
                userHeader.style.cursor = 'pointer';
                console.log('updateNavbar - userHeader.onclick 已设置为 showLoginModal');
            }
        }
    }

    // 处理管理员入口（仅处理导航栏中的，不处理profile页面的）
    adminItems.forEach(item => {
        // 跳过profile.html页面中的元素（移动端和PC端）
        if (item.closest('.profile-list')) return;
        if (item.closest('.profile-sidebar-menu')) return;
        if (item.closest('.profile-card')) return;
        
        if (currentUser && currentUser.username === 'admin') {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
    
    console.log('=== updateNavbar 结束 ===');
}

// 加载当前用户
async function loadCurrentUser() {
    console.log('=== loadCurrentUser 开始 ===');
    console.log('当前 currentUser:', currentUser);
    
    // 如果没有登录用户，直接返回
    if (!currentUser || !currentUser.id) {
        console.warn('没有登录用户，跳过 loadCurrentUser');
        updateNavbar();
        return;
    }
    
    console.log('尝试加载用户ID:', currentUser.id, '的详细信息');
    
    try {
        // 优先从后端API获取用户信息
        if (authToken) {
            console.log('尝试从后端API获取用户信息...');
            const response = await fetch(CONFIG.API_BASE_URL + '/auth/me', {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            
            if (!response.ok) {
                console.log('后端API认证失败，状态码:', response.status);
                clearAuthState();
                updateNavbar();
                return;
            }
            
            const result = await response.json();
            
            if (result.success) {
                console.log('从后端API获取用户信息成功:', result.data);
                currentUser = {
                    ...currentUser,
                    ...result.data,
                    avatar: result.data.avatar || currentUser.avatar || getAvatar(result.data.username || currentUser.username)
                };
                // 更新本地存储
                localStorage.setItem('current_user', JSON.stringify(currentUser));
                console.log('更新后的 currentUser:', currentUser);
            } else {
                console.log('后端API认证失败:', result.message);
                // 后端认证失败，不清除登录状态（可能是后端临时不可用）
            }
        }
    } catch (error) {
        console.error('从后端API加载用户信息失败:', error);
        // 网络错误不清除登录状态，只更新导航栏
        updateNavbar();
    }
    
    updateNavbar();
    console.log('=== loadCurrentUser 结束 ===');
}

// 设置事件监听
function setupEventListeners() {
    // 筛选标签
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            filterRequests();
        });
    });
}

// 加载统计数据


// 显示加载状态
function showLoading(elementId, message = '加载中...') {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = `<div class="loading-spinner">${message}</div>`;
    }
}

// 隐藏加载状态
function hideLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.querySelector('.loading-spinner')?.remove();
    }
}

// 显示错误信息
function showError(message, duration = 3000) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-toast';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        errorDiv.remove();
    }, duration);
}

// API 请求封装 - 统一错误处理
async function apiRequest(url, options = {}) {
    try {
        showLoading('requests-grid', '加载中...');
        
        // 从本地存储获取认证令牌
        const token = authToken || localStorage.getItem('auth_token');
        
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        // 添加认证令牌到请求头
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(CONFIG.API_BASE_URL + url, {
            ...options,
            headers
        });
        
        if (!response.ok) {
            // 处理401未授权错误
            if (response.status === 401) {
                localStorage.removeItem('auth_token');
                authToken = null;
                currentUser = null;
                showLoginModal();
                throw new Error('登录已过期，请重新登录');
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.message || '请求失败');
        }
        
        return data;
    } catch (error) {
        console.error('API请求错误:', error);
        showError(error.message || '网络错误，请稍后重试');
        throw error;
    } finally {
        hideLoading('requests-grid');
    }
}

// 加载分类
// 生成分类骨架屏HTML
function createCategorySkeletons(count = 12) {
    let skeletonHTML = '';
    for (let i = 0; i < count; i++) {
        skeletonHTML += `
            <div class="skeleton-category">
                <div class="skeleton-category-icon"></div>
                <div class="skeleton-category-name"></div>
            </div>
        `;
    }
    return skeletonHTML;
}

async function loadCategories() {
    const grid = document.getElementById('categories-grid');
    if (!grid) return; // 如果元素不存在，直接返回
    
    // 移动端不显示骨架屏，直接加载数据
    const isMobile = window.innerWidth <= 768;
    if (!isMobile) {
        grid.innerHTML = createCategorySkeletons(12);
    }
    
    try {
        const response = await fetch(CONFIG.API_BASE_URL + '/categories');
        
        if (!response.ok) {
            console.warn('分类API请求失败，使用模拟数据');
            const mockResult = window.mockAPI.getCategories();
            console.log('模拟分类数据:', mockResult);
            if (mockResult.success && mockResult.data && mockResult.data.length > 0) {
                renderCategories(mockResult.data, grid);
            }
            return;
        }
        
        const apiResult = await response.json();
        console.log('分类API返回:', apiResult);
        
        if (apiResult.success && apiResult.data && apiResult.data.length > 0) {
            renderCategories(apiResult.data, grid);
        } else {
            console.warn('分类API返回空数据，使用模拟数据');
            // 使用模拟数据作为备份
            const mockResult = window.mockAPI.getCategories();
            console.log('模拟分类数据:', mockResult);
            if (mockResult.success && mockResult.data && mockResult.data.length > 0) {
                renderCategories(mockResult.data, grid);
            }
        }
    } catch (error) {
        console.error('加载分类失败:', error);
        // 使用模拟数据作为备份
        const mockResult = window.mockAPI.getCategories();
        console.log('模拟分类数据:', mockResult);
        if (mockResult.success && mockResult.data && mockResult.data.length > 0) {
            renderCategories(mockResult.data, grid);
        }
    }
}

// 渲染分类（带淡入动画）- 移动端根据屏幕宽度显示尽可能多的分类
function renderCategories(categories, grid) {
    if (!grid) return;
    
    console.log('renderCategories 被调用, 分类数量:', categories ? categories.length : 0);
    
    // 保存完整分类数据到全局变量
    window.allCategories = categories;
    
    // 检测是否为移动端
    const isMobile = window.innerWidth <= 768;
    
    // 确保分类数据有效
    if (!categories || categories.length === 0) {
        console.warn('分类数据为空');
        return;
    }
    
    if (isMobile && categories.length > 1) {
        // 计算能显示多少个分类
        // 每个分类宽度70px + gap 8px = 78px，"更多"按钮也是78px
        const containerWidth = grid.parentElement ? grid.parentElement.clientWidth : window.innerWidth - 32;
        const itemWidth = 78; // 70px + 8px gap
        const maxVisibleCount = Math.max(1, Math.floor((containerWidth - itemWidth) / itemWidth));
        const visibleCount = Math.min(maxVisibleCount, categories.length);
        const moreCount = categories.length - visibleCount;
        
        const displayCategories = categories.slice(0, visibleCount);
        
        let html = displayCategories.map(cat => `
            <div class="category-item ${cat.id == 'all' ? 'active' : ''}" 
                 onclick="selectCategory('${cat.id}', this)">
                <span class="category-icon">${cat.icon}</span>
                <span class="category-name">${cat.name}</span>
            </div>
        `).join('');
        
        // 如果有更多分类，显示"更多"按钮
        if (moreCount > 0) {
            html += `
                <div class="category-item category-more-btn" onclick="showAllCategoriesModal()">
                    <span class="category-icon">➕</span>
                    <span class="category-name">更多${moreCount}个</span>
                </div>
            `;
        }
        
        grid.innerHTML = html;
    } else {
        // 桌面端显示全部分类
        const html = categories.map(cat => `
            <div class="category-item ${cat.id == 'all' ? 'active' : ''}" 
                 onclick="selectCategory('${cat.id}', this)">
                <span class="category-icon">${cat.icon}</span>
                <span class="category-name">${cat.name}</span>
            </div>
        `).join('');
        
        console.log('桌面端分类HTML:', html.substring(0, 200));
        grid.innerHTML = html;
    }
    
    console.log('分类渲染完成');
}

// 显示分类弹窗（别名，用于按钮点击）
function showCategoryModal() {
    showAllCategoriesModal();
}

// 显示全部分类弹窗
function showAllCategoriesModal() {
    const modal = document.createElement('div');
    modal.className = 'modal category-modal active';
    modal.id = 'category-modal';
    modal.innerHTML = `
        <div class="modal-content category-modal-content">
            <div class="modal-header">
                <h3>选择分类</h3>
                <button class="close-btn" onclick="closeCategoryModal()">&times;</button>
            </div>
            <div class="category-modal-body">
                <div class="categories-grid-all">
                    ${window.allCategories.map(cat => `
                        <div class="category-item ${cat.id === (window.currentCategory || 'all') ? 'active' : ''}" 
                             onclick="selectCategoryFromModal('${cat.id}', this)">
                            <span class="category-icon">${cat.icon}</span>
                            <span class="category-name">${cat.name}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
}

// 关闭分类弹窗
function closeCategoryModal() {
    const modal = document.getElementById('category-modal');
    if (modal) {
        modal.remove();
        document.body.style.overflow = '';
    }
}

// 从弹窗选择分类
function selectCategoryFromModal(categoryId, element) {
    window.currentCategory = categoryId;
    
    // 更新弹窗中的选中状态
    document.querySelectorAll('.category-modal .category-item').forEach(item => {
        item.classList.remove('active');
    });
    element.classList.add('active');
    
    // 更新页面上的分类显示
    const grid = document.getElementById('categories-grid');
    if (grid && window.allCategories) {
        renderCategories(window.allCategories, grid);
    }
    
    // 关闭弹窗
    closeCategoryModal();
    
    // 触发筛选
    if (typeof filterRequests === 'function') {
        filterRequests();
    }
}

// 窗口大小改变时重新渲染分类（带防抖）
let resizeTimer;
let lastWidth = window.innerWidth;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        const currentWidth = window.innerWidth;
        const grid = document.getElementById('categories-grid');
        if (grid && window.allCategories) {
            // 在移动端（<=768px）时，每次宽度变化都重新计算
            // 在桌面端（>768px）时，只有跨越边界时才重新渲染
            if (currentWidth <= 768 || 
                (lastWidth <= 768 && currentWidth > 768) || 
                (lastWidth > 768 && currentWidth <= 768)) {
                renderCategories(window.allCategories, grid);
            }
        }
        lastWidth = currentWidth;
    }, 250);
});

// 选择分类
function selectCategory(categoryId, element) {
    currentCategory = categoryId;
    
    document.querySelectorAll('.category-item').forEach(item => {
        item.classList.remove('active');
    });
    element.classList.add('active');
    
    filterRequests();
}

// 生成骨架屏HTML
function createSkeletonCards(count = 4) {
    let skeletonHTML = '';
    for (let i = 0; i < count; i++) {
        skeletonHTML += `
            <div class="skeleton-card">
                <div class="skeleton-header">
                    <div class="skeleton-avatar"></div>
                    <div class="skeleton-meta">
                        <div class="skeleton-line short"></div>
                        <div class="skeleton-line" style="width: 40%;"></div>
                    </div>
                </div>
                <div class="skeleton-title"></div>
                <div class="skeleton-description"></div>
                <div class="skeleton-description"></div>
                <div class="skeleton-footer">
                    <div class="skeleton-tag"></div>
                    <div class="skeleton-reward"></div>
                </div>
            </div>
        `;
    }
    return skeletonHTML;
}

// 显示骨架屏
function showSkeletonLoading() {
    const grid = document.getElementById('requests-grid');
    if (grid) {
        const isMobile = window.innerWidth <= 768;
        if (!isMobile) {
            grid.classList.add('loading');
            grid.innerHTML = createSkeletonCards(4);
        }
    }
}

// 隐藏骨架屏
function hideSkeletonLoading() {
    const grid = document.getElementById('requests-grid');
    if (grid) {
        grid.classList.remove('loading');
    }
}

// 加载需求列表
async function loadRequests() {
    const requestsGrid = document.getElementById('requests-grid');
    if (!requestsGrid) {
        console.error('requests-grid 元素不存在');
        return;
    }
    
    // 立即显示骨架屏，避免空白等待
    showSkeletonLoading();
    
    // 静默获取用户位置用于距离计算（不显示提示信息）
    if (!currentPosition) {
        await getCurrentLocationSilent();
    }
    
    try {
        console.log('开始加载需求列表...');
        
        // 检查 window.mockAPI 是否存在 - 仅开发环境使用模拟数据
        if (typeof window.mockAPI === 'undefined' && window.location.hostname === 'localhost' && window.location.port === '5500') {
            console.warn('mockAPI 未定义，开发环境使用模拟数据');
            // 开发环境：直接使用硬编码的模拟数据
            allRequests = [
                { id: 1, user_id: 1, title: '帮忙搬家具', description: '周末搬家，需要2-3个壮劳力帮忙搬家具，从3楼搬到1楼，大概2小时，有偿！', category: '搬运', location: '北京市朝阳区', lat: 39.9, lng: 116.4, reward: '200元', status: 'pending', created_at: '2026-01-28 09:00:00', completed_at: null, helper_id: null, is_urgent: false, user_nickname: '张三', user_avatar: getAvatar('zhangsan'), user_rating: 4.8 },
                { id: 2, user_id: 2, title: '辅导小学数学', description: '孩子三年级，数学成绩不太好，需要一位有耐心的大学生辅导，每周两次', category: '教育', location: '上海市浦东新区', lat: 31.2, lng: 121.5, reward: '100元/小时', status: 'accepted', created_at: '2026-01-27 14:00:00', completed_at: null, helper_id: 1, is_urgent: false, user_nickname: '李四', user_avatar: getAvatar('lisi'), user_rating: 4.9 },
                { id: 3, user_id: 3, title: '电脑重装系统', description: '电脑中毒了，需要重装系统，最好是Win11，带激活', category: '技术', location: '广州市天河区', lat: 23.1, lng: 113.3, reward: '80元', status: 'completed', created_at: '2026-01-25 10:30:00', completed_at: '2026-01-26 16:00:00', helper_id: 4, is_urgent: false, user_nickname: '王五', user_avatar: getAvatar('wangwu'), user_rating: 4.7 },
                { id: 4, user_id: 4, title: '帮忙遛狗', description: '临时出差3天，需要有人帮忙照顾家里的金毛，每天遛两次', category: '宠物', location: '深圳市南山区', lat: 22.5, lng: 114.0, reward: '150元/天', status: 'pending', created_at: '2026-01-29 08:00:00', completed_at: null, helper_id: null, is_urgent: false, user_nickname: '赵六', user_avatar: getAvatar('zhaoliu'), user_rating: 5.0 }
            ];
            console.log('开发环境使用模拟数据，共', allRequests.length, '条需求');
            filterRequests();
            return;
        }
        
        // 调用后端真实API获取需求列表
        console.log('调用后端API获取需求列表');
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/requests`);
            
            if (!response.ok) {
                console.warn('需求API请求失败:', response.status);
                showToast('服务器连接失败，请检查网络后刷新页面', 'error');
                renderEmptyState('加载失败，请刷新重试');
                return;
            }
            
            const result = await response.json();
            if (result.success) {
                allRequests = result.data;
                console.log('API数据加载成功，共', allRequests.length, '条需求');
                filterRequests();
            } else {
                console.error('API返回错误:', result.message);
                showToast(result.message || '加载失败', 'error');
                renderEmptyState('加载失败，请刷新重试');
            }
        } catch (apiError) {
            console.error('API调用失败:', apiError);
            showToast('网络连接失败，请检查网络后刷新页面', 'error');
            renderEmptyState('网络连接失败，请刷新重试');
        }
    } catch (error) {
        console.error('加载需求列表失败:', error);
        showToast('加载失败，请刷新页面重试', 'error');
        renderEmptyState('加载失败，请刷新重试');
    }
}

// 分页变量
let requestsPage = 1;
const requestsPerPage = 4;

// 计算两个坐标点之间的距离（使用Haversine公式）
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // 地球半径（公里）
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    return distance;
}

// 将角度转换为弧度
function deg2rad(deg) {
    return deg * (Math.PI/180);
}

// 筛选需求
function filterRequests() {
    let filtered = allRequests;
    
    if (currentFilter !== 'all') {
        filtered = filtered.filter(r => r.status === currentFilter);
    }
    
    if (currentCategory !== 'all') {
        filtered = filtered.filter(r => r.category === currentCategory);
    }
    
    // 计算每个需求与用户的距离
    filtered.forEach(req => {
        if (currentPosition && req.lat && req.lng) {
            req.distance = calculateDistance(
                currentPosition.lat, 
                currentPosition.lng, 
                parseFloat(req.lat), 
                parseFloat(req.lng)
            );
        } else {
            req.distance = null;
        }
    });
    
    // 优先按距离排序（近到远），距离相同或无距离信息的按创建时间排序（新到旧）
    filtered.sort((a, b) => {
        // 如果两者都有距离，按距离排序
        if (a.distance !== null && b.distance !== null) {
            return a.distance - b.distance;
        }
        // 如果只有a有距离，a在前
        if (a.distance !== null) {
            return -1;
        }
        // 如果只有b有距离，b在前
        if (b.distance !== null) {
            return 1;
        }
        // 两者都无距离，按创建时间排序
        return new Date(b.created_at) - new Date(a.created_at);
    });
    
    renderRequests(filtered);
}

// 按最新发布时间排序
function sortByLatest() {
    // 更新当前筛选状态
    currentFilter = 'latest';
    
    // 更新按钮样式
    document.querySelectorAll('.filter-tabs .tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.filter === 'latest') {
            btn.classList.add('active');
        }
    });
    
    // 复制所有需求并按时�间排序（最新的在前）
    let sorted = [...allRequests];
    
    // 按创建时间降序排序（最新的在前）
    sorted.sort((a, b) => {
        return new Date(b.created_at) - new Date(a.created_at);
    });
    
    // 重置到第一页
    requestsPage = 1;
    
    // 渲染排序后的需求
    renderRequests(sorted);
}

// 绑定最新排序按钮事件
document.addEventListener('DOMContentLoaded', function() {
    const sortLatestBtn = document.getElementById('sort-latest-btn');
    if (sortLatestBtn) {
        sortLatestBtn.addEventListener('click', sortByLatest);
    }
});

// 渲染需求列表
function renderRequests(requests) {
    const grid = document.getElementById('requests-grid');
    if (!grid) return; // 如果元素不存在，直接返回
    
    // 隐藏骨架屏
    hideSkeletonLoading();
    
    if (requests.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--gray-500);">
                <p>暂无相关需求</p>
                <button class="btn btn-primary" onclick="showPublishModal()" style="margin-top: 1rem;">
                    发布第一个需求
                </button>
            </div>
        `;
        return;
    }
    
    // 计算分页
    const totalPages = Math.ceil(requests.length / requestsPerPage);
    const startIndex = (requestsPage - 1) * requestsPerPage;
    const endIndex = startIndex + requestsPerPage;
    const currentPageRequests = requests.slice(startIndex, endIndex);
    
    // 使用 DocumentFragment 优化 DOM 操作性能
    const fragment = document.createDocumentFragment();
    
    currentPageRequests.forEach(req => {
        const card = createRequestCard(req);
        fragment.appendChild(card);
    });
    
    grid.innerHTML = '';
    grid.appendChild(fragment);
    

    
    // 更新当前页码和总页数显示
    const currentPageElement = document.getElementById('current-page');
    const totalPagesElement = document.getElementById('total-pages');
    if (currentPageElement) {
        currentPageElement.textContent = requestsPage;
    }
    if (totalPagesElement) {
        totalPagesElement.textContent = totalPages;
    }
}

// 渲染分页控件
function renderPagination(totalPages) {
    if (totalPages <= 1) {
        // 如果只有一页，不需要分页控件
        const paginationContainer = document.getElementById('pagination-container');
        if (paginationContainer) {
            paginationContainer.innerHTML = '';
        }
        return;
    }
    
    // 创建分页容器
    let paginationContainer = document.getElementById('pagination-container');
    if (!paginationContainer) {
        paginationContainer = document.createElement('div');
        paginationContainer.id = 'pagination-container';
        paginationContainer.className = 'pagination-container';
        const requestsGrid = document.getElementById('requests-grid');
        if (requestsGrid) {
            requestsGrid.parentNode.insertBefore(paginationContainer, requestsGrid.nextSibling);
        }
    }
    
    // 构建分页HTML
    let paginationHTML = `
        <div class="pagination">
            <button class="pagination-btn ${requestsPage === 1 ? 'disabled' : ''}" onclick="changePage(${requestsPage - 1})">
                ← 上一页
            </button>
    `;
    
    // 显示页码
    for (let i = 1; i <= totalPages; i++) {
        paginationHTML += `
            <button class="pagination-btn ${i === requestsPage ? 'active' : ''}" onclick="changePage(${i})">
                ${i}
            </button>
        `;
    }
    
    paginationHTML += `
            <button class="pagination-btn ${requestsPage === totalPages ? 'disabled' : ''}" onclick="changePage(${requestsPage + 1})">
                下一页 →
            </button>
        </div>
    `;
    
    paginationContainer.innerHTML = paginationHTML;
}

// 加载上一页
function loadPreviousPage() {
    if (requestsPage > 1) {
        changePage(requestsPage - 1);
    }
}

// 加载下一页
function loadNextPage() {
    // 先获取筛选后的请求数量
    let filtered = allRequests;
    if (currentFilter !== 'all') {
        filtered = filtered.filter(r => r.status === currentFilter);
    }
    if (currentCategory !== 'all') {
        filtered = filtered.filter(r => r.category === currentCategory);
    }
    const totalPages = Math.ceil(filtered.length / requestsPerPage);
    if (requestsPage < totalPages) {
        changePage(requestsPage + 1);
    }
}

// 切换页面
function changePage(page) {
    // 先获取筛选后的请求数量
    let filtered = allRequests;
    if (currentFilter !== 'all') {
        filtered = filtered.filter(r => r.status === currentFilter);
    }
    if (currentCategory !== 'all') {
        filtered = filtered.filter(r => r.category === currentCategory);
    }
    const totalPages = Math.ceil(filtered.length / requestsPerPage);
    if (page < 1 || page > totalPages) {
        return;
    }
    
    requestsPage = page;
    filterRequests();
    
    // 更新当前页码和总页数显示
    const currentPageElement = document.getElementById('current-page');
    const totalPagesElement = document.getElementById('total-pages');
    if (currentPageElement) {
        currentPageElement.textContent = requestsPage;
    }
    if (totalPagesElement) {
        totalPagesElement.textContent = totalPages;
    }
}

// 创建需求卡片元素 - 简洁清晰设计，无emoji
function createRequestCard(req) {
    const card = document.createElement('div');
    card.className = `request-card ${req.is_urgent ? 'urgent' : ''}`;
    // 移动端跳转到详情页面，桌面端显示弹窗
    card.onclick = () => {
        if (window.innerWidth <= 768) {
            // 移动端：跳转到详情页面
            window.location.href = `request-detail.html?id=${req.id}`;
        } else {
            // 桌面端：显示弹窗
            showRequestDetail(req.id);
        }
    };

    // 使用 escapeHtml 防止 XSS
    const title = escapeHtml(req.title);
    const category = escapeHtml(req.category);
    const location = escapeHtml(req.location || '未知位置');
    const userNickname = escapeHtml(req.user_nickname || '匿名用户');

    // 计算距离显示
    const distanceText = req.distance !== null && req.distance !== undefined
        ? `${req.distance < 1 ? (req.distance * 1000).toFixed(0) + 'm' : req.distance.toFixed(1) + 'km'}`
        : '';

    // 获取用户名字首字作为头像
    const userInitial = userNickname.charAt(0);

    card.innerHTML = `
        <div class="request-card-header">
            ${req.is_urgent ? '<span class="urgent-tag">紧急</span>' : ''}
            <span class="category-tag">${category}</span>
        </div>
        <div class="request-card-body">
            <h3 class="request-title">${title}</h3>
            <div class="request-reward-row">
                <span class="reward-amount">${req.reward || '面议'}</span>
                <span class="distance-text">${distanceText || location}</span>
            </div>
            <div class="request-tags">
                ${req.need_photo_verify ? '<span class="tag photo-tag">拍照验收</span>' : ''}
                ${req.deposit_amount > 0 ? `<span class="tag deposit-tag">押金¥${req.deposit_amount}</span>` : ''}
            </div>
        </div>
        <div class="request-card-footer">
            <div class="request-user">
                <div class="user-avatar">${userInitial}</div>
                <span class="user-name">${userNickname}</span>
            </div>
            <span class="request-time">${formatTime(req.created_at)}</span>
        </div>
    `;

    return card;
}



// 获取分类图标
function getCategoryIcon(category) {
    const icons = {
        '搬运': '📦', '教育': '📚', '技术': '💻', '宠物': '🐾',
        '维修': '🔧', '跑腿': '🏃', '健康': '🏥', '设计': '🎨',
        '借用': '🤝', '摄影': '📷', '其他': '📌'
    };
    return icons[category] || '📋';
}

// 获取状态文本
function getStatusText(status) {
    const texts = { 'pending': '待帮助', 'accepted': '进行中', 'completed': '已完成', 'cancelled': '已取消' };
    return texts[status] || status;
}

// 获取接单人状态文本
function getHelperStatusText(status) {
    const texts = { 'departed': '已出发', 'arrived': '已到达' };
    return texts[status] || '';
}

// 获取紧急类型文本
function getUrgentTypeText(type) {
    const texts = {
        'safety': '🛡️ 安全求助',
        'elderly': '👴 老人儿童紧急求助',
        'other': '📢 其他紧急事项'
    };
    return texts[type] || '紧急';
}

// 格式化时间
function formatTime(timeStr) {
    if (!timeStr) return '';
    const date = new Date(timeStr);
    const now = new Date();
    const diff = (now - date) / 1000;
    
    if (diff < 60) return '刚刚';
    if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}天前`;
    return date.toLocaleDateString('zh-CN');
}

// 数字递增动画函数
function animateNumber(element, targetValue, duration = 1000) {
    if (!element) return;
    const startValue = 0;
    const startTime = performance.now();
    
    function updateNumber(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // 使用缓动函数让动画更自然
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const currentValue = Math.floor(startValue + (targetValue - startValue) * easeOutQuart);
        element.textContent = currentValue;
        
        if (progress < 1) {
            requestAnimationFrame(updateNumber);
        } else {
            element.textContent = targetValue;
        }
    }
    
    requestAnimationFrame(updateNumber);
}

// 加载统计数据
async function loadStats() {
    try {
        const response = await fetch(CONFIG.API_BASE_URL + '/stats');
        const result = await response.json();

        if (result.success) {
            // 首页统计 - 使用 stat-users, stat-requests, stat-completed, stat-helps
            const statUsers = document.getElementById('stat-users');
            const statRequests = document.getElementById('stat-requests');
            const statCompleted = document.getElementById('stat-completed');
            const statHelps = document.getElementById('stat-helps');

            if (statUsers) animateNumber(statUsers, result.data.user_count || 0, 500);
            if (statRequests) animateNumber(statRequests, result.data.request_count || 0, 500);
            if (statCompleted) animateNumber(statCompleted, result.data.completed_count || 0, 500);
            if (statHelps) animateNumber(statHelps, result.data.help_count || 0, 500);

            // 个人中心统计 - 使用 stat-help, stat-request
            // 注意：/api/stats 返回的是平台全局数据，个人中心应该用 currentUser 的数据
            // 这里不再从 stats API 获取个人统计数据
        }
    } catch (error) {
        console.error('加载统计数据失败:', error);
    }
}

// 加载用户列表（首页展示用）
function loadUsersForHome() {
    const result = window.mockAPI.getUsers();
    
    if (result.success) {
        const grid = document.getElementById('users-grid');
        if (!grid) return; // 如果元素不存在，直接返回
        grid.innerHTML = result.data.slice(0, 8).map(user => `
            <div class="user-card" onclick="showUserProfile(${user.id})">
                <div class="user-card-avatar">
                    <img src="${user.avatar || getAvatar(user.id)}" alt="">
                </div>
                <h3 class="user-card-name">${user.nickname}</h3>
                <div class="user-skills">
                    ${user.skills ? user.skills.slice(0, 3).map(skill => `<span class="skill-tag">${skill}</span>`).join('') : ''}
                </div>
                <p class="user-card-bio">${user.bio || '这个人很懒，没有写简介'}</p>
                <div class="user-card-stats">
                    <div class="user-card-stat">
                        <span class="user-card-stat-value">${user.help_count}</span>
                        <span class="user-card-stat-label">帮助次数</span>
                    </div>
                    <div class="user-card-stat">
                        <span class="user-card-stat-value">${user.rating.toFixed(1)}</span>
                        <span class="user-card-stat-label">评分</span>
                    </div>
                    <div class="user-card-stat">
                        <span class="user-card-stat-value">${user.points}</span>
                        <span class="user-card-stat-label">积分</span>
                    </div>
                </div>
            </div>
        `).join('');
    }
}

// 加载通知
async function loadNotifications() {
    if (!currentUser) return;
    
    try {
        // 从后端获取未读消息数量
        const token = localStorage.getItem('auth_token');
        if (!token) return;
        
        const response = await fetch('/api/messages/unread-count', {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                unreadCount = result.data.unread_count || 0;
                updateNotificationBadge();
                updateMessageNavBadge(unreadCount);
            }
        }
    } catch (e) {
        console.error('加载未读通知失败:', e);
    }
}

// 更新底部导航消息徽章
function updateMessageNavBadge(count) {
    const badge = document.getElementById('message-badge');
    if (badge) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = count > 0 ? 'flex' : 'none';
    }
}

// 更新通知徽章
function updateNotificationBadge() {
    const badge = document.getElementById('notification-badge');
    if (badge) {
        badge.textContent = unreadCount;
        badge.style.display = unreadCount > 0 ? 'block' : 'none';
    }
}

// 切换紧急类型显示
function toggleUrgentType(checkbox) {
    const urgentTypeGroup = document.getElementById('urgent_type_group');
    if (urgentTypeGroup) {
        urgentTypeGroup.style.display = checkbox.checked ? 'block' : 'none';
    }
}

// 城市数据（完整版）
const cityData = {
    '北京市': ['北京市'],
    '天津市': ['天津市'],
    '上海市': ['上海市'],
    '重庆市': ['重庆市'],
    '河北省': ['石家庄市', '唐山市', '秦皇岛市', '邯郸市', '邢台市', '保定市', '张家口市', '承德市', '沧州市', '廊坊市', '衡水市'],
    '山西省': ['太原市', '大同市', '阳泉市', '长治市', '晋城市', '朔州市', '晋中市', '运城市', '忻州市', '临汾市', '吕梁市'],
    '辽宁省': ['沈阳市', '大连市', '鞍山市', '抚顺市', '本溪市', '丹东市', '锦州市', '营口市', '阜新市', '辽阳市', '盘锦市', '铁岭市', '朝阳市', '葫芦岛市'],
    '吉林省': ['长春市', '吉林市', '四平市', '辽源市', '通化市', '白山市', '松原市', '白城市', '延边朝鲜族自治州'],
    '黑龙江省': ['哈尔滨市', '齐齐哈尔市', '鸡西市', '鹤岗市', '双鸭山市', '大庆市', '伊春市', '佳木斯市', '七台河市', '牡丹江市', '黑河市', '绥化市', '大兴安岭地区'],
    '江苏省': ['南京市', '无锡市', '徐州市', '常州市', '苏州市', '南通市', '连云港市', '淮安市', '盐城市', '扬州市', '镇江市', '泰州市', '宿迁市'],
    '浙江省': ['杭州市', '宁波市', '温州市', '嘉兴市', '湖州市', '绍兴市', '金华市', '衢州市', '舟山市', '台州市', '丽水市'],
    '安徽省': ['合肥市', '芜湖市', '蚌埠市', '淮南市', '马鞍山市', '淮北市', '铜陵市', '安庆市', '黄山市', '滁州市', '阜阳市', '宿州市', '六安市', '亳州市', '池州市', '宣城市'],
    '福建省': ['福州市', '厦门市', '莆田市', '三明市', '泉州市', '漳州市', '南平市', '龙岩市', '宁德市'],
    '江西省': ['南昌市', '景德镇市', '萍乡市', '九江市', '新余市', '鹰潭市', '赣州市', '吉安市', '宜春市', '抚州市', '上饶市'],
    '山东省': ['济南市', '青岛市', '淄博市', '枣庄市', '东营市', '烟台市', '潍坊市', '济宁市', '泰安市', '威海市', '日照市', '临沂市', '德州市', '聊城市', '滨州市', '菏泽市'],
    '河南省': ['郑州市', '开封市', '洛阳市', '平顶山市', '安阳市', '鹤壁市', '新乡市', '焦作市', '濮阳市', '许昌市', '漯河市', '三门峡市', '南阳市', '商丘市', '信阳市', '周口市', '驻马店市'],
    '湖北省': ['武汉市', '黄石市', '十堰市', '宜昌市', '襄阳市', '鄂州市', '荆门市', '孝感市', '荆州市', '黄冈市', '咸宁市', '随州市', '恩施土家族苗族自治州'],
    '湖南省': ['长沙市', '株洲市', '湘潭市', '衡阳市', '邵阳市', '岳阳市', '常德市', '张家界市', '益阳市', '郴州市', '永州市', '怀化市', '娄底市', '湘西土家族苗族自治州'],
    '广东省': ['广州市', '韶关市', '深圳市', '珠海市', '汕头市', '佛山市', '江门市', '湛江市', '茂名市', '肇庆市', '惠州市', '梅州市', '汕尾市', '河源市', '阳江市', '清远市', '东莞市', '中山市', '潮州市', '揭阳市', '云浮市'],
    '海南省': ['海口市', '三亚市', '三沙市', '儋州市', '五指山市', '琼海市', '文昌市', '万宁市', '东方市'],
    '四川省': ['成都市', '自贡市', '攀枝花市', '泸州市', '德阳市', '绵阳市', '广元市', '遂宁市', '内江市', '乐山市', '南充市', '眉山市', '宜宾市', '广安市', '达州市', '雅安市', '巴中市', '资阳市', '阿坝藏族羌族自治州', '甘孜藏族自治州', '凉山彝族自治州'],
    '贵州省': ['贵阳市', '六盘水市', '遵义市', '安顺市', '毕节市', '铜仁市', '黔西南布依族苗族自治州', '黔东南苗族侗族自治州', '黔南布依族苗族自治州'],
    '云南省': ['昆明市', '曲靖市', '玉溪市', '保山市', '昭通市', '丽江市', '普洱市', '临沧市', '楚雄彝族自治州', '红河哈尼族彝族自治州', '文山壮族苗族自治州', '西双版纳傣族自治州', '大理白族自治州', '德宏傣族景颇族自治州', '怒江傈僳族自治州', '迪庆藏族自治州'],
    '陕西省': ['西安市', '铜川市', '宝鸡市', '咸阳市', '渭南市', '延安市', '汉中市', '榆林市', '安康市', '商洛市'],
    '甘肃省': ['兰州市', '嘉峪关市', '金昌市', '白银市', '天水市', '武威市', '张掖市', '平凉市', '酒泉市', '庆阳市', '定西市', '陇南市', '临夏回族自治州', '甘南藏族自治州'],
    '青海省': ['西宁市', '海东市', '海北藏族自治州', '黄南藏族自治州', '海南藏族自治州', '果洛藏族自治州', '玉树藏族自治州', '海西蒙古族藏族自治州'],
    '台湾省': ['台北市', '新北市', '桃园市', '台中市', '台南市', '高雄市', '基隆市', '新竹市', '嘉义市'],
    '内蒙古自治区': ['呼和浩特市', '包头市', '乌海市', '赤峰市', '通辽市', '鄂尔多斯市', '呼伦贝尔市', '巴彦淖尔市', '乌兰察布市', '兴安盟', '锡林郭勒盟', '阿拉善盟'],
    '广西壮族自治区': ['南宁市', '柳州市', '桂林市', '梧州市', '北海市', '防城港市', '钦州市', '贵港市', '玉林市', '百色市', '贺州市', '河池市', '来宾市', '崇左市'],
    '西藏自治区': ['拉萨市', '日喀则市', '昌都市', '林芝市', '山南市', '那曲市', '阿里地区'],
    '宁夏回族自治区': ['银川市', '石嘴山市', '吴忠市', '固原市', '中卫市'],
    '新疆维吾尔自治区': ['乌鲁木齐市', '克拉玛依市', '吐鲁番市', '哈密市', '昌吉回族自治州', '博尔塔拉蒙古自治州', '巴音郭楞蒙古自治州', '阿克苏地区', '克孜勒苏柯尔克孜自治州', '喀什地区', '和田地区', '伊犁哈萨克自治州', '塔城地区', '阿勒泰地区']
};

// 区县数据（主要城市）
const districtData = {
    '北京市': ['东城区', '西城区', '朝阳区', '丰台区', '石景山区', '海淀区', '门头沟区', '房山区', '通州区', '顺义区', '昌平区', '大兴区', '怀柔区', '平谷区', '密云区', '延庆区'],
    '上海市': ['黄浦区', '徐汇区', '长宁区', '静安区', '普陀区', '虹口区', '杨浦区', '闵行区', '宝山区', '嘉定区', '浦东新区', '金山区', '松江区', '青浦区', '奉贤区', '崇明区'],
    '广州市': ['荔湾区', '越秀区', '海珠区', '天河区', '白云区', '黄埔区', '番禺区', '花都区', '南沙区', '从化区', '增城区'],
    '深圳市': ['罗湖区', '福田区', '南山区', '宝安区', '龙岗区', '盐田区', '龙华区', '坪山区', '光明区'],
    '杭州市': ['上城区', '拱墅区', '西湖区', '滨江区', '萧山区', '余杭区', '富阳区', '临安区', '临平区', '钱塘区'],
    '南京市': ['玄武区', '秦淮区', '建邺区', '鼓楼区', '浦口区', '栖霞区', '雨花台区', '江宁区', '六合区', '溧水区', '高淳区'],
    '成都市': ['锦江区', '青羊区', '金牛区', '武侯区', '成华区', '龙泉驿区', '青白江区', '新都区', '温江区', '双流区', '郫都区', '新津区'],
    '武汉市': ['江岸区', '江汉区', '硚口区', '汉阳区', '武昌区', '青山区', '洪山区', '东西湖区', '汉南区', '蔡甸区', '江夏区', '黄陂区', '新洲区'],
    '西安市': ['新城区', '碑林区', '莲湖区', '雁塔区', '灞桥区', '未央区', '阎良区', '临潼区', '长安区', '高陵区', '鄠邑区'],
    '重庆市': ['万州区', '涪陵区', '渝中区', '大渡口区', '江北区', '沙坪坝区', '九龙坡区', '南岸区', '北碚区', '渝北区', '巴南区', '长寿区', '江津区', '合川区', '永川区', '南川区', '綦江区', '大足区', '璧山区', '铜梁区', '潼南区', '荣昌区', '开州区', '梁平区', '武隆区'],
    '天津市': ['和平区', '河东区', '河西区', '南开区', '河北区', '红桥区', '东丽区', '西青区', '津南区', '北辰区', '武清区', '宝坻区', '滨海新区', '宁河区', '静海区', '蓟州区'],
    '苏州市': ['虎丘区', '吴中区', '相城区', '姑苏区', '吴江区', '工业园区', '常熟市', '张家港市', '昆山市', '太仓市'],
    '郑州市': ['中原区', '二七区', '管城回族区', '金水区', '上街区', '惠济区', '郑东新区', '高新区', '经开区'],
    '长沙市': ['芙蓉区', '天心区', '岳麓区', '开福区', '雨花区', '望城区', '长沙县', '浏阳市', '宁乡市'],
    '沈阳市': ['和平区', '沈河区', '大东区', '皇姑区', '铁西区', '苏家屯区', '浑南区', '沈北新区', '于洪区', '辽中区', '康平县', '法库县', '新民市'],
    '青岛市': ['市南区', '市北区', '黄岛区', '崂山区', '李沧区', '城阳区', '即墨区', '胶州市', '平度市', '莱西市'],
    '宁波市': ['海曙区', '江北区', '北仑区', '镇海区', '鄞州区', '奉化区', '余姚市', '慈溪市', '象山县', '宁海县'],
    '东莞市': ['东城街道', '南城街道', '万江街道', '莞城街道', '石碣镇', '石龙镇', '茶山镇', '石排镇', '企石镇', '横沥镇', '桥头镇', '谢岗镇', '东坑镇', '常平镇', '寮步镇', '樟木头镇', '大朗镇', '黄江镇', '清溪镇', '塘厦镇', '凤岗镇', '大岭山镇', '长安镇', '虎门镇', '厚街镇', '沙田镇', '道滘镇', '洪梅镇', '麻涌镇', '望牛墩镇', '中堂镇', '高埗镇', '松山湖', '东莞港', '东莞生态园', '东莞滨海湾新区'],
    '佛山市': ['禅城区', '南海区', '顺德区', '三水区', '高明区']
};

// 根据区县名查找所属城市
function findCityByDistrict(districtName) {
    // 繁简转换映射
    const繁简映射 = {
        '區': '区',
        '縣': '县',
        '市': '市'
    };
    
    // 转换繁体为简体
    let简化区县名 = districtName;
    for (const [繁体, 简体] of Object.entries(繁简映射)) {
        简化区县名 = 简化区县名.replace(new RegExp(繁体, 'g'), 简体);
    }
    
    // 尝试匹配转换后的区县名
    for (const [city, districts] of Object.entries(districtData)) {
        if (districts.includes(简化区县名)) {
            return city;
        }
        // 尝试去掉后缀匹配
        const无后缀区县名 = 简化区县名.replace(/[区县市]$/, '');
        for (const district of districts) {
            if (district.replace(/[区县市]$/, '') === 无后缀区县名) {
                return city;
            }
        }
    }
    return '';
}

// 更新城市下拉框
function updateCities() {
    const provinceSelect = document.getElementById('province-select');
    const citySelect = document.getElementById('city-select');
    const province = provinceSelect.value;
    
    citySelect.innerHTML = '<option value="">请选择城市</option>';
    
    if (province && cityData[province]) {
        cityData[province].forEach(city => {
            const option = document.createElement('option');
            option.value = city;
            option.textContent = city;
            citySelect.appendChild(option);
        });
    }
}

// 显示发布弹窗
function showPublishModal() {
    const user = JSON.parse(localStorage.getItem('current_user') || '{}');
    if (!user || !user.id) {
        showLoginModal();
        return;
    }
    
    // 移动端跳转到独立页面
    if (window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        window.location.href = 'publish.html';
        return;
    }
    
    closeDetailModal();
    closeLoginModal();
    console.log('showPublishModal - pendingSceneData:', window.pendingSceneData);
    const modal = document.getElementById('publish-modal');
    if (modal) {
        // 先填充场景数据（必须在 initPublishForm 之前）
        console.log('检查是否有待填充数据...');
        if (window.pendingSceneData) {
            console.log('开始填充场景数据');
            const form = document.getElementById('publish-form');
            console.log('form 元素:', form);
            if (form) {
                const titleInput = form.querySelector('input[name="title"]');
                const descInput = form.querySelector('textarea[name="description"]');
                console.log('titleInput:', titleInput, 'descInput:', descInput);
                if (titleInput) titleInput.value = window.pendingSceneData.title || '';
                if (descInput) descInput.value = window.pendingSceneData.desc || '';
                console.log('填充后的值 - title:', titleInput?.value, 'desc:', descInput?.value);
            }
        }
        
        modal.classList.add('active');
        initPublishForm();
        
        // 填充后清除数据
        if (window.pendingSceneData) {
            window.pendingSceneData = null;
        }
        
        // 自动获取位置
        getCurrentLocationSilent();
    }
}

// 调整截止日期（天数）
function adjustDeadline(delta) {
    const input = document.getElementById('deadline-input');
    if (!input) return;
    
    let currentDate;
    if (input.value) {
        currentDate = new Date(input.value);
    } else {
        currentDate = new Date();
    }
    
    currentDate.setDate(currentDate.getDate() + delta);
    
    // 确保不早于今天
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (currentDate < today) {
        currentDate = today;
    }
    
    input.value = currentDate.toISOString().split('T')[0];
}

// 切换自定义开始时间输入框
function toggleCustomStartTime() {
    const select = document.getElementById('start_time_select');
    const customInput = document.getElementById('start_time_custom');
    if (!select || !customInput) return;
    
    if (select.value === 'custom') {
        customInput.style.display = 'block';
        // 设置默认值为当前时间
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        customInput.value = now.toISOString().slice(0, 16);
    } else {
        customInput.style.display = 'none';
    }
}

// 关闭发布弹窗
function closePublishModal() {
    const modal = document.getElementById('publish-modal');
    const form = document.getElementById('publish-form');
    if (modal) {
        modal.classList.remove('active');
    }
    if (form) {
        form.reset();
    }
    // 重置位置状态
    currentPosition = null;
}

// 检测是否在Android APP中
function isAndroidApp() {
    return typeof Android !== 'undefined' && Android !== null;
}

// 获取当前位置 - 优先使用Android原生定位
async function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        const addressInput = document.getElementById('address-input');
        const latInput = document.getElementById('lat-input');
        const lngInput = document.getElementById('lng-input');
        const locationStatus = document.getElementById('location-status');
        
        // 如果在Android APP中，使用原生定位
        if (isAndroidApp()) {
            if (locationStatus) {
                locationStatus.innerHTML = '<span class="location-icon">📡</span><span class="location-text">正在定位...</span>';
            }
            
            // 设置全局回调函数供Android调用
            window.onLocationSuccess = async function(latitude, longitude) {
                currentPosition = { lat: latitude, lng: longitude };
                
                // 更新隐藏字段（经纬度）- 用于距离计算
                if (latInput) latInput.value = latitude;
                if (lngInput) lngInput.value = longitude;
                
                // 使用经纬度反编码获取城市
                await reverseGeocodeAndSelectCity(latitude, longitude, addressInput, locationStatus);
                
                resolve();
            };
            
            window.onLocationDenied = function() {
                if (locationStatus) {
                    locationStatus.innerHTML = '<span class="location-icon">⚠️</span><span class="location-text">定位失败，请手动选择省份和城市</span>';
                }
                resolve();
            };
            
            // 调用Android原生定位
            Android.getLocation();
            return;
        }
        
        // 否则使用浏览器定位
        if (!navigator.geolocation) {
            if (locationStatus) {
                locationStatus.innerHTML = '<span class="location-icon">⚠️</span><span class="location-text">浏览器不支持定位</span>';
            }
            // 使用默认位置（北京）
            const defaultLat = 39.9042;
            const defaultLng = 116.4074;
            currentPosition = { lat: defaultLat, lng: defaultLng };
            if (latInput) latInput.value = defaultLat;
            if (lngInput) lngInput.value = defaultLng;
            if (addressInput) addressInput.value = '北京市';
            if (locationStatus) {
                locationStatus.innerHTML = '<span class="location-icon">⚠️</span><span class="location-text">浏览器不支持定位，已自动填充默认位置</span>';
            }
            resolve();
            return;
        }
        
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                
                currentPosition = { lat, lng };
                
                // 更新隐藏字段（经纬度）- 用于距离计算
                if (latInput) latInput.value = lat;
                if (lngInput) lngInput.value = lng;
                
                // 使用经纬度反编码获取城市
                await reverseGeocodeAndSelectCity(lat, lng, addressInput, locationStatus);
                
                resolve();
            },
            async (error) => {
                console.warn('GPS定位失败:', error.message);
                
                // GPS失败，提示用户手动选择
                if (locationStatus) {
                    locationStatus.innerHTML = '<span class="location-icon">⚠️</span><span class="location-text">定位失败，请手动选择省份和城市</span>';
                }
                resolve();
            },
            {
                enableHighAccuracy: false, // 禁用高精度以提高成功率
                timeout: 5000, // 减少超时时间
                maximumAge: 300000 // 允许使用300秒内的缓存位置
            }
        );
    });
}

// 静默获取当前位置（用于距离计算，不显示提示信息）- 优先使用Android原生定位
async function getCurrentLocationSilent() {
    return new Promise((resolve) => {
        // 如果在Android APP中，使用原生定位
        if (isAndroidApp()) {
            // 设置全局回调函数供Android调用
            window.onLocationSuccess = function(latitude, longitude) {
                currentPosition = { lat: latitude, lng: longitude };
                resolve();
            };
            
            window.onLocationDenied = function() {
                // 定位失败时使用默认位置
                currentPosition = { lat: 39.9042, lng: 116.4074 };
                resolve();
            };
            
            // 调用Android原生定位
            Android.getLocation();
            return;
        }
        
        // 否则使用浏览器定位
        if (!navigator.geolocation) {
            // 使用默认位置（北京）
            currentPosition = { lat: 39.9042, lng: 116.4074 };
            resolve();
            return;
        }
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                currentPosition = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                resolve();
            },
            () => {
                // 定位失败时使用默认位置
                currentPosition = { lat: 39.9042, lng: 116.4074 };
                resolve();
            },
            {
                enableHighAccuracy: false,
                timeout: 5000,
                maximumAge: 300000
            }
        );
    });
}

// 通过坐标获取地址（使用高德地图API）
async function getAddressFromCoords(lat, lng) {
    try {
        // 使用精确的本地坐标匹配
        return matchLocationByCoords(lat, lng);
    } catch (error) {
        console.error('获取地址失败:', error);
        return `当前位置 (${lat.toFixed(6)}, ${lng.toFixed(6)})`;
    }
}

// 根据坐标匹配市-区
function matchLocationByCoords(lat, lng) {
    // 中国城市坐标范围定义（更精确）
    const cityRanges = [
        {
            name: '北京市',
            latMin: 39.75, latMax: 40.05,
            lngMin: 115.90, lngMax: 116.70,
            districts: [
                { name: '朝阳区', latMin: 39.88, latMax: 40.00, lngMin: 116.35, lngMax: 116.60 },
                { name: '海淀区', latMin: 39.92, latMax: 40.05, lngMin: 116.15, lngMax: 116.35 },
                { name: '东城区', latMin: 39.90, latMax: 39.95, lngMin: 116.38, lngMax: 116.45 },
                { name: '西城区', latMin: 39.87, latMax: 39.93, lngMin: 116.30, lngMax: 116.40 },
                { name: '丰台区', latMin: 39.82, latMax: 39.90, lngMin: 116.20, lngMax: 116.45 },
                { name: '石景山区', latMin: 39.88, latMax: 39.95, lngMin: 116.15, lngMax: 116.25 },
                { name: '通州区', latMin: 39.85, latMax: 39.95, lngMin: 116.55, lngMax: 116.85 },
                { name: '昌平区', latMin: 40.00, latMax: 40.25, lngMin: 116.15, lngMax: 116.45 }
            ]
        },
        {
            name: '上海市',
            latMin: 30.90, latMax: 31.50,
            lngMin: 121.20, lngMax: 121.80,
            districts: [
                { name: '黄浦区', latMin: 31.22, latMax: 31.25, lngMin: 121.45, lngMax: 121.50 },
                { name: '徐汇区', latMin: 31.15, latMax: 31.22, lngMin: 121.40, lngMax: 121.45 },
                { name: '浦东新区', latMin: 31.20, latMax: 31.35, lngMin: 121.50, lngMax: 121.80 },
                { name: '静安区', latMin: 31.22, latMax: 31.28, lngMin: 121.42, lngMax: 121.48 },
                { name: '长宁区', latMin: 31.20, latMax: 31.23, lngMin: 121.35, lngMax: 121.42 },
                { name: '普陀区', latMin: 31.23, latMax: 31.28, lngMin: 121.35, lngMax: 121.42 },
                { name: '虹口区', latMin: 31.25, latMax: 31.28, lngMin: 121.48, lngMax: 121.52 },
                { name: '杨浦区', latMin: 31.25, latMax: 31.30, lngMin: 121.50, lngMax: 121.58 }
            ]
        },
        {
            name: '深圳市',
            latMin: 22.40, latMax: 22.80,
            lngMin: 113.80, lngMax: 114.60,
            districts: [
                { name: '福田区', latMin: 22.52, latMax: 22.58, lngMin: 114.02, lngMax: 114.08 },
                { name: '罗湖区', latMin: 22.53, latMax: 22.58, lngMin: 114.08, lngMax: 114.15 },
                { name: '南山区', latMin: 22.50, latMax: 22.58, lngMin: 113.90, lngMax: 114.02 },
                { name: '宝安区', latMin: 22.55, latMax: 22.72, lngMin: 113.80, lngMax: 113.95 },
                { name: '龙岗区', latMin: 22.60, latMax: 22.75, lngMin: 114.15, lngMax: 114.35 },
                { name: '盐田区', latMin: 22.58, latMax: 22.62, lngMin: 114.20, lngMax: 114.30 }
            ]
        },
        {
            name: '广州市',
            latMin: 23.00, latMax: 23.40,
            lngMin: 113.10, lngMax: 113.50,
            districts: [
                { name: '天河区', latMin: 23.12, latMax: 23.15, lngMin: 113.30, lngMax: 113.38 },
                { name: '越秀区', latMin: 23.12, latMax: 23.14, lngMin: 113.25, lngMax: 113.30 },
                { name: '海珠区', latMin: 23.08, latMax: 23.12, lngMin: 113.28, lngMax: 113.35 },
                { name: '荔湾区', latMin: 23.10, latMax: 23.13, lngMin: 113.22, lngMax: 113.28 },
                { name: '白云区', latMin: 23.15, latMax: 23.25, lngMin: 113.25, lngMax: 113.35 },
                { name: '黄埔区', latMin: 23.08, latMax: 23.15, lngMin: 113.40, lngMax: 113.50 }
            ]
        },
        {
            name: '杭州市',
            latMin: 30.15, latMax: 30.40,
            lngMin: 120.00, lngMax: 120.35,
            districts: [
                { name: '西湖区', latMin: 30.25, latMax: 30.30, lngMin: 120.10, lngMax: 120.15 },
                { name: '上城区', latMin: 30.23, latMax: 30.27, lngMin: 120.15, lngMax: 120.20 },
                { name: '下城区', latMin: 30.27, latMax: 30.30, lngMin: 120.15, lngMax: 120.20 },
                { name: '江干区', latMin: 30.25, latMax: 30.30, lngMin: 120.20, lngMax: 120.30 },
                { name: '拱墅区', latMin: 30.28, latMax: 30.32, lngMin: 120.10, lngMax: 120.15 }
            ]
        },
        {
            name: '成都市',
            latMin: 30.50, latMax: 30.80,
            lngMin: 103.90, lngMax: 104.15,
            districts: [
                { name: '锦江区', latMin: 30.65, latMax: 30.67, lngMin: 104.05, lngMax: 104.10 },
                { name: '青羊区', latMin: 30.67, latMax: 30.70, lngMin: 104.05, lngMax: 104.08 },
                { name: '金牛区', latMin: 30.70, latMax: 30.73, lngMin: 104.05, lngMax: 104.10 },
                { name: '武侯区', latMin: 30.62, latMax: 30.67, lngMin: 104.05, lngMax: 104.08 },
                { name: '成华区', latMin: 30.65, latMax: 30.70, lngMin: 104.10, lngMax: 104.15 }
            ]
        },
        {
            name: '武汉市',
            latMin: 30.40, latMax: 30.70,
            lngMin: 114.20, lngMax: 114.45,
            districts: [
                { name: '江岸区', latMin: 30.60, latMax: 30.62, lngMin: 114.28, lngMax: 114.32 },
                { name: '江汉区', latMin: 30.58, latMax: 30.60, lngMin: 114.25, lngMax: 114.30 },
                { name: '硚口区', latMin: 30.58, latMax: 30.62, lngMin: 114.20, lngMax: 114.25 },
                { name: '汉阳区', latMin: 30.55, latMax: 30.58, lngMin: 114.25, lngMax: 114.30 },
                { name: '武昌区', latMin: 30.55, latMax: 30.58, lngMin: 114.30, lngMax: 114.35 },
                { name: '青山区', latMin: 30.62, latMax: 30.65, lngMin: 114.35, lngMax: 114.40 }
            ]
        },
        {
            name: '南京市',
            latMin: 31.90, latMax: 32.10,
            lngMin: 118.70, lngMax: 118.90,
            districts: [
                { name: '玄武区', latMin: 32.05, latMax: 32.08, lngMin: 118.78, lngMax: 118.82 },
                { name: '秦淮区', latMin: 32.00, latMax: 32.03, lngMin: 118.78, lngMax: 118.82 },
                { name: '建邺区', latMin: 32.00, latMax: 32.03, lngMin: 118.72, lngMax: 118.78 },
                { name: '鼓楼区', latMin: 32.05, latMax: 32.08, lngMin: 118.75, lngMax: 118.78 },
                { name: '浦口区', latMin: 32.05, latMax: 32.10, lngMin: 118.60, lngMax: 118.70 }
            ]
        },
        {
            name: '芜湖市',
            latMin: 30.90, latMax: 31.65,
            lngMin: 117.90, lngMax: 118.60,
            districts: [
                { name: '镜湖区', latMin: 31.32, latMax: 31.38, lngMin: 118.35, lngMax: 118.42 },
                { name: '弋江区', latMin: 31.28, latMax: 31.35, lngMin: 118.37, lngMax: 118.45 },
                { name: '鸠江区', latMin: 31.35, latMax: 31.42, lngMin: 118.38, lngMax: 118.45 },
                { name: '湾沚区', latMin: 31.10, latMax: 31.18, lngMin: 118.55, lngMax: 118.62 },
                { name: '繁昌区', latMin: 31.05, latMax: 31.12, lngMin: 118.15, lngMax: 118.25 }
            ]
        },
        {
            name: '长沙市',
            latMin: 27.80, latMax: 28.60,
            lngMin: 112.80, lngMax: 113.50,
            districts: [
                { name: '天心区', latMin: 28.00, latMax: 28.15, lngMin: 112.95, lngMax: 113.05 },
                { name: '雨花区', latMin: 27.95, latMax: 28.10, lngMin: 113.00, lngMax: 113.15 },
                { name: '芙蓉区', latMin: 28.15, latMax: 28.25, lngMin: 113.00, lngMax: 113.10 },
                { name: '开福区', latMin: 28.20, latMax: 28.35, lngMin: 112.95, lngMax: 113.05 },
                { name: '岳麓区', latMin: 28.15, latMax: 28.30, lngMin: 112.85, lngMax: 112.98 },
                { name: '望城区', latMin: 28.25, latMax: 28.45, lngMin: 112.80, lngMax: 113.00 }
            ]
        }
    ];
    
    // 遍历城市范围匹配
    for (const city of cityRanges) {
        if (lat >= city.latMin && lat <= city.latMax && lng >= city.lngMin && lng <= city.lngMax) {
            // 在城内匹配具体区域
            for (const district of city.districts) {
                if (lat >= district.latMin && lat <= district.latMax && 
                    lng >= district.lngMin && lng <= district.lngMax) {
                    return `${city.name}-${district.name}`;
                }
            }
            // 在城市内但没匹配到具体区域，返回城市名
            return `${city.name}-${city.districts[0].name}`;
        }
    }
    
    // 未匹配到任何城市，返回默认值
    return '北京市-朝阳区';
}

// 根据经纬度自动选择省-市
function autoSelectProvinceCity(lat, lng) {
    const provinceSelect = document.getElementById('province-select');
    const citySelect = document.getElementById('city-select');
    
    if (!provinceSelect || !citySelect) return;
    
    // 根据坐标范围判断省份和城市
    let province = '';
    let city = '';
    
    // 直辖市判断
    if (lat >= 39.75 && lat <= 40.05 && lng >= 115.90 && lng <= 116.70) {
        province = '北京市';
        city = '北京市';
    } else if (lat >= 38.90 && lat <= 40.20 && lng >= 116.70 && lng <= 118.00) {
        province = '天津市';
        city = '天津市';
    } else if (lat >= 30.90 && lat <= 31.50 && lng >= 121.20 && lng <= 121.80) {
        province = '上海市';
        city = '上海市';
    } else if (lat >= 28.90 && lat <= 30.80 && lng >= 105.80 && lng <= 110.00) {
        province = '重庆市';
        city = '重庆市';
    }
    // 省份判断
    else if (lat >= 38.00 && lat <= 42.60 && lng >= 113.50 && lng <= 119.80) {
        province = '河北省';
        city = '石家庄市';
    } else if (lat >= 34.50 && lat <= 40.70 && lng >= 110.20 && lng <= 114.50) {
        province = '山西省';
        city = '太原市';
    } else if (lat >= 38.70 && lat <= 43.40 && lng >= 118.80 && lng <= 125.80) {
        province = '辽宁省';
        city = '沈阳市';
    } else if (lat >= 41.50 && lat <= 46.30 && lng >= 121.60 && lng <= 131.30) {
        province = '吉林省';
        city = '长春市';
    } else if (lat >= 43.30 && lat <= 53.50 && lng >= 121.20 && lng <= 135.10) {
        province = '黑龙江省';
        city = '哈尔滨市';
    } else if (lat >= 30.90 && lat <= 35.20 && lng >= 116.30 && lng <= 121.90) {
        province = '江苏省';
        city = '南京市';
    } else if (lat >= 27.20 && lat <= 31.10 && lng >= 118.00 && lng <= 122.90) {
        province = '浙江省';
        city = '杭州市';
    } else if (lat >= 29.40 && lat <= 34.60 && lng >= 114.80 && lng <= 119.60) {
        province = '安徽省';
        // 判断是合肥还是芜湖
        if (lat >= 30.90 && lat <= 31.65 && lng >= 117.90 && lng <= 118.60) {
            city = '芜湖市';
        } else {
            city = '合肥市';
        }
    } else if (lat >= 23.50 && lat <= 28.30 && lng >= 115.80 && lng <= 120.70) {
        province = '福建省';
        city = '福州市';
    } else if (lat >= 24.50 && lat <= 30.10 && lng >= 113.50 && lng <= 118.50) {
        province = '江西省';
        city = '南昌市';
    } else if (lat >= 34.30 && lat <= 38.40 && lng >= 114.80 && lng <= 122.70) {
        province = '山东省';
        city = '济南市';
    } else if (lat >= 31.20 && lat <= 36.30 && lng >= 110.30 && lng <= 116.70) {
        province = '河南省';
        city = '郑州市';
    } else if (lat >= 29.00 && lat <= 33.30 && lng >= 108.30 && lng <= 116.10) {
        province = '湖北省';
        city = '武汉市';
    } else if (lat >= 24.60 && lat <= 30.10 && lng >= 108.80 && lng <= 114.30) {
        province = '湖南省';
        city = '长沙市';
    } else if (lat >= 20.20 && lat <= 25.50 && lng >= 109.60 && lng <= 117.30) {
        province = '广东省';
        city = '广州市';
    } else if (lat >= 18.10 && lat <= 20.10 && lng >= 108.60 && lng <= 111.00) {
        province = '海南省';
        city = '海口市';
    } else if (lat >= 26.00 && lat <= 34.30 && lng >= 97.30 && lng <= 108.50) {
        province = '四川省';
        city = '成都市';
    } else if (lat >= 24.60 && lat <= 29.20 && lng >= 103.50 && lng <= 109.60) {
        province = '贵州省';
        city = '贵阳市';
    } else if (lat >= 21.10 && lat <= 29.20 && lng >= 97.50 && lng <= 106.20) {
        province = '云南省';
        city = '昆明市';
    } else if (lat >= 31.70 && lat <= 39.50 && lng >= 105.50 && lng <= 111.20) {
        province = '陕西省';
        city = '西安市';
    } else if (lat >= 32.60 && lat <= 42.80 && lng >= 92.20 && lng <= 108.70) {
        province = '甘肃省';
        city = '兰州市';
    } else if (lat >= 31.80 && lat <= 39.20 && lng >= 89.50 && lng <= 103.10) {
        province = '青海省';
        city = '西宁市';
    } else if (lat >= 37.40 && lat <= 40.70 && lng >= 109.80 && lng <= 114.30) {
        province = '内蒙古自治区';
        city = '呼和浩特市';
    } else if (lat >= 20.80 && lat <= 26.40 && lng >= 104.50 && lng <= 112.10) {
        province = '广西壮族自治区';
        city = '南宁市';
    } else if (lat >= 26.80 && lat <= 36.50 && lng >= 78.40 && lng <= 99.10) {
        province = '西藏自治区';
        city = '拉萨市';
    } else if (lat >= 35.20 && lat <= 39.30 && lng >= 105.10 && lng <= 107.70) {
        province = '宁夏回族自治区';
        city = '银川市';
    } else if (lat >= 34.30 && lat <= 49.20 && lng >= 73.50 && lng <= 96.40) {
        province = '新疆维吾尔自治区';
        city = '乌鲁木齐市';
    } else {
        // 默认北京
        province = '北京市';
        city = '北京市';
    }
    
    // 设置省份
    provinceSelect.value = province;
    
    updateCities();
    
    requestAnimationFrame(() => {
        citySelect.value = city;
    });
}

// 根据省份和城市名称选择（用于IP定位）
function selectProvinceCityByName(region, city) {
    const provinceSelect = document.getElementById('province-select');
    const citySelect = document.getElementById('city-select');
    
    if (!provinceSelect || !citySelect) return;
    
    // 将英文/拼音转换为中文
    const provinceMap = {
        'Beijing': '北京市',
        'Tianjin': '天津市',
        'Shanghai': '上海市',
        'Chongqing': '重庆市',
        'Anhui': '安徽省',
        'Fujian': '福建省',
        'Gansu': '甘肃省',
        'Guangdong': '广东省',
        'Guangxi': '广西壮族自治区',
        'Guizhou': '贵州省',
        'Hainan': '海南省',
        'Hebei': '河北省',
        'Heilongjiang': '黑龙江省',
        'Henan': '河南省',
        'Hubei': '湖北省',
        'Hunan': '湖南省',
        'Jiangsu': '江苏省',
        'Jiangxi': '江西省',
        'Jilin': '吉林省',
        'Liaoning': '辽宁省',
        'Nei Mongol': '内蒙古自治区',
        'Ningxia': '宁夏回族自治区',
        'Qinghai': '青海省',
        'Shaanxi': '陕西省',
        'Shandong': '山东省',
        'Shanxi': '山西省',
        'Sichuan': '四川省',
        'Taiwan': '台湾省',
        'Tibet': '西藏自治区',
        'Xinjiang': '新疆维吾尔自治区',
        'Yunnan': '云南省',
        'Zhejiang': '浙江省'
    };
    
    // 尝试匹配省份
    let provinceName = provinceMap[region] || region;
    
    // 设置省份
    if (provinceName) {
        provinceSelect.value = provinceName;
        updateCities();
    }
    
    // 设置城市（如果有）
    if (city) {
        requestAnimationFrame(() => {
            // 尝试匹配城市（去掉英文后缀）
            let cityName = city;
            if (cityName.includes('Shi')) {
                cityName = cityName.replace('Shi', '市');
            }
            // 尝试直接设置
            citySelect.value = cityName;
            // 如果失败，尝试查找包含该城市名的选项
            if (citySelect.value !== cityName) {
                for (let i = 0; i < citySelect.options.length; i++) {
                    if (citySelect.options[i].text.includes(cityName.replace('市', ''))) {
                        citySelect.value = citySelect.options[i].value;
                        break;
                    }
                }
            }
        });
    }
}

// 使用经纬度反编码获取城市并选择
async function reverseGeocodeAndSelectCity(lat, lng, addressInput, locationStatus) {
    try {
        // 使用 OpenStreetMap Nominatim API 反编码
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`, {
            headers: { 'User-Agent': 'HelpEachOther/1.0' }
        });
        const data = await response.json();
        console.log('反编码结果:', data);
        
        if (data && data.address) {
            const addr = data.address;
            // 获取省份、城市和区县
            let province = addr.state || addr.province || '';
            let city = addr.city || '';
            let district = addr.suburb || addr.district || addr.neighbourhood || '';
            
            // 如果没有city但有county，可能是区县名
            if (!city && addr.county) {
                const countyName = addr.county;
                // 判断是城市还是区县
                if (countyName.endsWith('区') || countyName.endsWith('县')) {
                    district = countyName;
                } else {
                    city = countyName;
                }
            }
            
            // 如果city是区县名，尝试从districtData反查城市
            if (city && (city.endsWith('区') || city.endsWith('县'))) {
                district = city;
                city = findCityByDistrict(city);
            }
            
            // 如果还没有city，尝试用town
            if (!city && addr.town) {
                city = addr.town;
            }
            
            // 转换为中文格式
            if (province && !province.endsWith('省') && !province.endsWith('市') && !province.includes('自治区')) {
                province = province + '省';
            }
            if (city && !city.endsWith('市')) {
                city = city + '市';
            }
            
            // 更新地址输入框
            const displayAddress = district ? `${city}${district}` : (city || province || '未知位置');
            if (addressInput) addressInput.value = displayAddress;
            
            // 选择省份和城市
            const provinceSelect = document.getElementById('province-select');
            const citySelect = document.getElementById('city-select');
            
            if (provinceSelect && citySelect) {
                // 设置省份
                provinceSelect.value = province;
                if (provinceSelect.value !== province) {
                    // 如果直接设置失败，尝试匹配
                    for (let i = 0; i < provinceSelect.options.length; i++) {
                        if (provinceSelect.options[i].text.includes(province.replace('省', '').replace('市', ''))) {
                            provinceSelect.value = provinceSelect.options[i].value;
                            break;
                        }
                    }
                }
                
                // 更新城市列表
                updateCities();
                
                // 设置城市
                requestAnimationFrame(() => {
                    citySelect.value = city;
                    if (citySelect.value !== city) {
                        // 如果直接设置失败，尝试匹配
                        for (let i = 0; i < citySelect.options.length; i++) {
                            if (citySelect.options[i].text.includes(city.replace('市', ''))) {
                                citySelect.value = citySelect.options[i].value;
                                break;
                            }
                        }
                    }
                });
            }
            
            if (locationStatus) {
                locationStatus.innerHTML = '<span class="location-icon">✅</span><span class="location-text">已定位到：' + displayAddress + '，如有错误请手动调整</span>';
            }
        } else {
            throw new Error('反编码失败');
        }
    } catch (error) {
        console.error('反编码失败:', error);
        // 反编码失败，使用经纬度范围判断
        autoSelectProvinceCity(lat, lng);
        if (locationStatus) {
            locationStatus.innerHTML = '<span class="location-icon">⚠️</span><span class="location-text">定位成功，请确认省份和城市是否正确</span>';
        }
    }
}

// 显示地图
function showMap(lat, lng, address) {
    const mapContainer = document.getElementById('location-map');
    if (!mapContainer) return;
    
    const displayAddress = address || `当前位置 (${lat.toFixed(6)}, ${lng.toFixed(6)})`;
    
    mapContainer.innerHTML = `
        <div class="map-container">
            <div class="map-canvas" id="map-canvas">
                <div class="map-marker" id="map-marker" style="left: 50%; top: 50%;"></div>
            </div>
            <div class="map-info">
                <strong>📍 ${displayAddress}</strong><br>
                <small>点击地图可调整位置</small>
            </div>
        </div>
    `;
    
    mapMarker = document.getElementById('map-marker');
    const canvas = document.getElementById('map-canvas');
    
    // 点击地图调整位置
    canvas.addEventListener('click', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // 更新标记位置
        mapMarker.style.left = `${x - 12}px`;
        mapMarker.style.top = `${y - 24}px`;
        
        // 计算新的坐标（简化计算，每像素约代表0.001度）
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const deltaLng = (x - centerX) * 0.001;
        const deltaLat = -(y - centerY) * 0.001;
        
        currentPosition = {
            lat: lat + deltaLat,
            lng: lng + deltaLng
        };
        
        // 更新隐藏字段
        document.getElementById('lat-input').value = currentPosition.lat;
        document.getElementById('lng-input').value = currentPosition.lng;
        
        // 更新地址
        updateAddress(currentPosition.lat, currentPosition.lng);
    });
    
    // 使标记可拖动
    let isDragging = false;
    
    mapMarker.addEventListener('mousedown', (e) => {
        isDragging = true;
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging || !mapMarker) return;
        
        const canvas = document.getElementById('map-canvas');
        const rect = canvas.getBoundingClientRect();
        let x = e.clientX - rect.left - 12;
        let y = e.clientY - rect.top - 24;
        
        // 限制在地图范围内
        x = Math.max(0, Math.min(x, rect.width - 24));
        y = Math.max(0, Math.min(y, rect.height - 24));
        
        mapMarker.style.left = `${x}px`;
        mapMarker.style.top = `${y}px`;
    });
    
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            // 更新坐标
            const canvas = document.getElementById('map-canvas');
            if (canvas) {
                const rect = canvas.getBoundingClientRect();
                const marker = document.getElementById('map-marker');
                const markerX = parseFloat(marker.style.left) + 12;
                const markerY = parseFloat(marker.style.top) + 24;
                
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                const deltaLng = (markerX - centerX) * 0.001;
                const deltaLat = -(markerY - centerY) * 0.001;
                
                currentPosition = {
                    lat: lat + deltaLat,
                    lng: lng + deltaLng
                };
                
                document.getElementById('lat-input').value = currentPosition.lat;
                document.getElementById('lng-input').value = currentPosition.lng;
                
                // 更新地址
                updateAddress(currentPosition.lat, currentPosition.lng);
            }
        }
    });
}

// 更新地址显示
async function updateAddress(lat, lng) {
    const locationInput = document.getElementById('location-input');
    const infoDiv = document.querySelector('.map-info');
    
    locationInput.value = '正在解析地址...';
    if (infoDiv) {
        infoDiv.innerHTML = '<strong>📍 正在获取地址...</strong><br><small>请稍候</small>';
    }
    
    const address = await getAddressFromCoords(lat, lng);
    locationInput.value = address;
    
    if (infoDiv) {
        infoDiv.innerHTML = `<strong>📍 ${address}</strong><br><small>位置已手动调整</small>`;
    }
}

// ==================== 表单验证 ====================

// 表单验证器
const FormValidator = {
    // 验证规则
    rules: {
        required: (value) => value && value.trim() !== '',
        minLength: (value, length) => value && value.length >= length,
        maxLength: (value, length) => value && value.length <= length,
        email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
        phone: (value) => /^1[3-9]\d{9}$/.test(value),
        url: (value) => /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/.test(value)
    },

    // 验证单个字段
    validateField(field, rules) {
        const value = field.value;
        const errors = [];

        for (const rule of rules) {
            const [ruleName, ...params] = rule.split(':');
            const validator = this.rules[ruleName];

            if (validator && !validator(value, ...params)) {
                errors.push(this.getErrorMessage(ruleName, params));
            }
        }

        return errors;
    },

    // 获取错误信息
    getErrorMessage(rule, params) {
        const messages = {
            required: '此字段为必填项',
            minLength: `最少需要 ${params[0]} 个字符`,
            maxLength: `最多允许 ${params[0]} 个字符`,
            email: '请输入有效的邮箱地址',
            phone: '请输入有效的手机号码',
            url: '请输入有效的网址'
        };
        return messages[rule] || '验证失败';
    },

    // 显示错误
    showError(field, message) {
        this.clearError(field);
        const errorDiv = document.createElement('div');
        errorDiv.className = 'form-error';
        errorDiv.textContent = message;
        field.parentNode.appendChild(errorDiv);
        field.classList.add('error');
    },

    // 清除错误
    clearError(field) {
        const parent = field.parentNode;
        const error = parent.querySelector('.form-error');
        if (error) {
            error.remove();
        }
        field.classList.remove('error');
    },

    // 清除所有错误
    clearAllErrors(form) {
        form.querySelectorAll('.form-error').forEach(el => el.remove());
        form.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
    }
};

// 实时表单验证
function initFormValidation() {
    const publishForm = document.getElementById('publish-form');
    if (!publishForm) return;

    // 标题实时验证
    const titleInput = publishForm.querySelector('[name="title"]');
    if (titleInput) {
        titleInput.addEventListener('blur', () => {
            const errors = FormValidator.validateField(titleInput, ['required', 'minLength:5', 'maxLength:100']);
            if (errors.length > 0) {
                FormValidator.showError(titleInput, errors[0]);
            }
        });

        titleInput.addEventListener('input', () => {
            FormValidator.clearError(titleInput);
        });
    }

    // 描述实时验证
    const descInput = publishForm.querySelector('[name="description"]');
    if (descInput) {
        descInput.addEventListener('blur', () => {
            const errors = FormValidator.validateField(descInput, ['required', 'minLength:10', 'maxLength:1000']);
            if (errors.length > 0) {
                FormValidator.showError(descInput, errors[0]);
            }
        });

        descInput.addEventListener('input', () => {
            FormValidator.clearError(descInput);
        });
    }

    // 分类验证
    const categorySelect = publishForm.querySelector('[name="category"]');
    if (categorySelect) {
        categorySelect.addEventListener('change', () => {
            if (!categorySelect.value) {
                FormValidator.showError(categorySelect, '请选择需求分类');
            } else {
                FormValidator.clearError(categorySelect);
            }
        });
    }
}

// 处理发布按钮点击
function handlePublishButtonClick() {
    // 检查用户是否登录
    if (!currentUser) {
        showToast('请先登录', 'warning');
        showLoginModal();
        return;
    }
    showPublishModal();
}

// 步骤管理
let currentStep = 1;
const totalSteps = 4;

// 初始化发布需求表单
function initPublishForm() {
    const form = document.getElementById('publish-form');
    if (!form) return;

    // 检查是否有待填充的场景数据
    if (window.pendingSceneData) {
        const { title, desc } = window.pendingSceneData;
        
        // 填充标题
        const titleInput = form.querySelector('input[name="title"]');
        if (titleInput) {
            titleInput.value = title;
        }
        
        // 填充描述
        const descInput = form.querySelector('textarea[name="description"]');
        if (descInput) {
            descInput.value = desc;
        }
        
        // 清除待填充数据
        window.pendingSceneData = null;
    }
    
    // 初始化步骤
    updateStepIndicator();
    updateStepContent();
    
    // 初始化报酬值
    updateRewardValue();
    
    // 初始化截止日期（默认明天）
    const deadlineInput = document.getElementById('deadline-input');
    if (deadlineInput) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        deadlineInput.value = tomorrow.toISOString().split('T')[0];
    }
    
    // 绑定步骤切换事件 - 支持新旧两种类名
    document.querySelectorAll('.step-item-v2, .step-item').forEach((item) => {
        item.addEventListener('click', () => {
            const step = parseInt(item.getAttribute('data-step'));
            if (step <= currentStep) {
                goToStep(step);
            }
        });
    });
    
    // 绑定表单输入事件
    const titleInput = form.querySelector('[name="title"]');
    const descriptionInput = form.querySelector('[name="description"]');
    const categorySelect = form.querySelector('[name="category"]');
    const rewardInput = form.querySelector('[name="reward"]');
    const rewardAmountInput = form.querySelector('[name="reward_amount"]');
    const rewardUnitSelect = form.querySelector('[name="reward_unit"]');
    const provinceSelect = form.querySelector('[name="province"]');
    const citySelect = form.querySelector('[name="city"]');
    const addressInput = form.querySelector('[name="address"]');
    const isUrgentCheckbox = form.querySelector('[name="is_urgent"]');
    
    if (titleInput) {
        titleInput.addEventListener('input', updateConfirmInfo);
    }
    
    if (descriptionInput) {
        descriptionInput.addEventListener('input', () => {
            updateDescriptionCounter();
            updateConfirmInfo();
        });
    }
    
    if (categorySelect) {
        categorySelect.addEventListener('change', updateConfirmInfo);
    }
    
    if (rewardInput) {
        rewardInput.addEventListener('input', updateConfirmInfo);
    }
    
    // 绑定报酬金额和单位输入事件
    if (rewardAmountInput) {
        rewardAmountInput.addEventListener('input', updateRewardValue);
    }
    
    if (rewardUnitSelect) {
        rewardUnitSelect.addEventListener('change', updateRewardValue);
    }
    
    if (provinceSelect) {
        provinceSelect.addEventListener('change', updateConfirmInfo);
    }
    
    if (citySelect) {
        citySelect.addEventListener('change', updateConfirmInfo);
    }
    
    if (addressInput) {
        addressInput.addEventListener('input', updateConfirmInfo);
    }
    
    if (isUrgentCheckbox) {
        isUrgentCheckbox.addEventListener('change', updateConfirmInfo);
    }
    
    const needPhotoVerifyCheckbox = form.querySelector('[name="need_photo_verify"]');
    if (needPhotoVerifyCheckbox) {
        needPhotoVerifyCheckbox.addEventListener('change', updateConfirmInfo);
    }
    
    const depositAmountInput = form.querySelector('[name="deposit_amount"]');
    if (depositAmountInput) {
        depositAmountInput.addEventListener('input', updateConfirmInfo);
    }
}

// 更新报酬隐藏字段的值
function updateRewardValue() {
    const form = document.getElementById('publish-form');
    if (!form) return;
    
    const amountInput = form.querySelector('[name="reward_amount"]');
    const unitSelect = form.querySelector('[name="reward_unit"]');
    const hiddenInput = form.querySelector('#reward-hidden');
    
    if (amountInput && unitSelect && hiddenInput) {
        const amount = amountInput.value.trim();
        const unit = unitSelect.value;
        
        if (amount) {
            hiddenInput.value = amount + '元' + unit;
        } else {
            hiddenInput.value = '';
        }
        
        // 触发确认信息更新
        updateConfirmInfo();
    }
}

// 更新步骤指示器
function updateStepIndicator() {
    // 支持新旧两种类名
    const stepItems = document.querySelectorAll('.step-item-v2, .step-item');
    stepItems.forEach((item) => {
        const step = parseInt(item.getAttribute('data-step'));
        if (step < currentStep) {
            item.classList.add('completed');
            item.classList.remove('active');
        } else if (step === currentStep) {
            item.classList.add('active');
            item.classList.remove('completed');
        } else {
            item.classList.remove('active', 'completed');
        }
    });
}

// 更新步骤内容
function updateStepContent() {
    // 支持新旧两种类名
    const sections = document.querySelectorAll('.step-content, .form-panel, .form-section-v2[data-step]');
    sections.forEach((section) => {
        const step = parseInt(section.getAttribute('data-step'));
        if (step === currentStep) {
            section.classList.add('active');
            section.style.display = 'block';
        } else {
            section.classList.remove('active');
            section.style.display = 'none';
        }
    });

    // 控制按钮显示 - 支持新旧两种类名
    const stepNav = document.querySelector('.step-navigation-v2, .step-nav');
    const submitActions = document.querySelector('.submit-actions-v2, .submit-nav');

    if (stepNav && submitActions) {
        if (currentStep === totalSteps) {
            // 最后一步：显示提交按钮，隐藏导航按钮
            stepNav.style.display = 'none';
            submitActions.style.display = 'flex';
        } else {
            // 非最后一步：显示导航按钮，隐藏提交按钮
            stepNav.style.display = 'flex';
            submitActions.style.display = 'none';
        }
    }
}

// 跳转到指定步骤
function goToStep(step) {
    if (step < 1 || step > totalSteps) return;
    
    currentStep = step;
    updateStepIndicator();
    updateStepContent();
    
    // 滚动到顶部
    const modal = document.getElementById('publish-modal');
    modal.scrollTop = 0;
}

// 下一步
function nextStep() {
    if (currentStep < totalSteps) {
        // 验证当前步骤
        if (validateCurrentStep()) {
            currentStep++;
            updateStepIndicator();
            updateStepContent();

            // 如果是最后一步，更新确认信息
            if (currentStep === totalSteps) {
                // 使用 setTimeout 确保 DOM 更新后再更新确认信息
                setTimeout(() => {
                    updateConfirmInfo();
                }, 0);
            }
        }
    }
}

// 上一步
function prevStep() {
    if (currentStep > 1) {
        currentStep--;
        updateStepIndicator();
        updateStepContent();
    }
}

// 验证当前步骤
function validateCurrentStep() {
    const form = document.getElementById('publish-form');
    if (!form) return true;
    
    FormValidator.clearAllErrors(form);
    let hasError = false;
    
    switch (currentStep) {
        case 1:
            // 验证标题
            const titleInput = form.querySelector('[name="title"]');
            if (titleInput) {
                const titleErrors = FormValidator.validateField(
                    titleInput,
                    ['required', 'minLength:5', 'maxLength:100']
                );
                if (titleErrors.length > 0) {
                    FormValidator.showError(titleInput, titleErrors[0]);
                    hasError = true;
                }
            }
            
            // 验证分类
            const categorySelect = form.querySelector('[name="category"]');
            if (categorySelect && !categorySelect.value) {
                FormValidator.showError(categorySelect, '请选择需求分类');
                hasError = true;
            }
            break;
            
        case 2:
            // 验证省份和城市
            const provinceSelect = form.querySelector('[name="province"]');
            const citySelect = form.querySelector('[name="city"]');
            
            if (provinceSelect && !provinceSelect.value) {
                FormValidator.showError(provinceSelect, '请选择省份');
                hasError = true;
            }
            
            if (citySelect && !citySelect.value) {
                FormValidator.showError(citySelect, '请选择城市');
                hasError = true;
            }
            break;
            
        case 3:
            // 验证描述
            const descriptionInput = form.querySelector('[name="description"]');
            if (descriptionInput) {
                const descErrors = FormValidator.validateField(
                    descriptionInput,
                    ['required', 'minLength:10', 'maxLength:1000']
                );
                if (descErrors.length > 0) {
                    FormValidator.showError(descriptionInput, descErrors[0]);
                    hasError = true;
                }
            }
            break;
    }
    
    if (hasError) {
        // 滚动到第一个错误
        const firstError = form.querySelector('.error');
        if (firstError) {
            firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
            firstError.focus();
        }
    }
    
    return !hasError;
}

// 更新描述计数器
function updateDescriptionCounter() {
    const descriptionInput = document.querySelector('[name="description"]');
    const counter = document.getElementById('description-counter');
    
    if (descriptionInput && counter) {
        const length = descriptionInput.value.length;
        counter.textContent = `${length}/1000`;
        
        if (length > 1000) {
            counter.classList.add('error');
        } else {
            counter.classList.remove('error');
        }
    }
}

// 更新确认信息
function updateConfirmInfo() {
    const form = document.getElementById('publish-form');
    if (!form) return;

    const title = form.querySelector('[name="title"]').value || '未填写';

    const categorySelect = form.querySelector('[name="category"]');
    let category = '未选择';
    if (categorySelect && categorySelect.selectedIndex > 0) {
        category = categorySelect.options[categorySelect.selectedIndex].text;
    }
    
    let reward = '未填写';
    const rewardAmountInput = form.querySelector('[name="reward_amount"]');
    const rewardUnitSelect = form.querySelector('[name="reward_unit"]');
    const rewardHidden = form.querySelector('#reward-hidden');
    
    if (rewardAmountInput && rewardUnitSelect) {
        const amount = rewardAmountInput.value.trim();
        const unit = rewardUnitSelect.value;
        if (amount) {
            reward = amount + '元' + unit;
        }
    } else if (rewardHidden && rewardHidden.value) {
        reward = rewardHidden.value;
    } else {
        const rewardInput = form.querySelector('[name="reward"]');
        if (rewardInput && rewardInput.value) {
            reward = rewardInput.value;
        }
    }
    
    const province = form.querySelector('[name="province"]').value || '';
    const city = form.querySelector('[name="city"]').value || '';
    const isUrgent = form.querySelector('[name="is_urgent"]').checked;
    const needPhotoVerify = form.querySelector('[name="need_photo_verify"]').checked;
    const depositAmount = form.querySelector('[name="deposit_amount"]').value || '0';
    
    // 获取开始时间和截止时间
    const startTimeSelect = form.querySelector('[name="start_time"]');
    const startTimeValue = startTimeSelect ? startTimeSelect.value : 'now';
    let startTimeText;
    if (startTimeValue === 'now') {
        startTimeText = '现在';
    } else if (startTimeValue === '12h') {
        startTimeText = '12小时内';
    } else if (startTimeValue === 'week') {
        startTimeText = '一周内';
    } else if (startTimeValue === 'custom') {
        const customInput = document.getElementById('start_time_custom');
        startTimeText = customInput && customInput.value ? customInput.value : '自定义';
    }
    
    const deadlineInput = document.getElementById('deadline-input');
    const deadlineText = deadlineInput && deadlineInput.value ? deadlineInput.value : '未选择';
    
    const location = province && city ? `${province}-${city}` : '未填写';
    
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-category').textContent = category;
    document.getElementById('confirm-reward').textContent = reward;
    document.getElementById('confirm-location').textContent = location;
    document.getElementById('confirm-urgent').textContent = isUrgent ? '是' : '否';
    document.getElementById('confirm-start-time').textContent = startTimeText;
    document.getElementById('confirm-deadline').textContent = deadlineText;
    
    // 添加确认信息
    let confirmBody = document.querySelector('.confirm-body-v2');
    if (confirmBody) {
        let photoVerifyItem = document.getElementById('confirm-photo-verify');
        if (!photoVerifyItem) {
            photoVerifyItem = document.createElement('div');
            photoVerifyItem.id = 'confirm-photo-verify';
            photoVerifyItem.className = 'confirm-item-v2';
            confirmBody.appendChild(photoVerifyItem);
        }
        photoVerifyItem.innerHTML = `<span class="confirm-label-v2">拍照验收：</span><span class="confirm-value-v2">${needPhotoVerify ? '是' : '否'}</span>`;
        
        let depositItem = document.getElementById('confirm-deposit');
        if (!depositItem) {
            depositItem = document.createElement('div');
            depositItem.id = 'confirm-deposit';
            depositItem.className = 'confirm-item-v2';
            confirmBody.appendChild(depositItem);
        }
        depositItem.innerHTML = `<span class="confirm-label-v2">押金：</span><span class="confirm-value-v2">¥${depositAmount}</span>`;
    }
}

// 处理发布
async function handlePublish(event) {
    event.preventDefault();

    // 检查用户是否登录
    if (!currentUser) {
        showToast('请先登录', 'warning');
        showLoginModal();
        return;
    }

    const form = event.target;
    FormValidator.clearAllErrors(form);

    const formData = new FormData(form);
    const isUrgent = formData.get('is_urgent') === 'on';

    // 前端验证
    let hasError = false;

    // 验证标题
    const title = formData.get('title');
    const titleErrors = FormValidator.validateField(
        { value: title },
        ['required', 'minLength:5', 'maxLength:100']
    );
    if (titleErrors.length > 0) {
        FormValidator.showError(
            form.querySelector('[name="title"]'),
            titleErrors[0]
        );
        hasError = true;
    }

    // 验证描述（可选）
    const description = formData.get('description') || '';
    // 不强制要求描述，但如果有输入的话验证长度
    if (description && description.length > 0) {
        const descErrors = FormValidator.validateField(
            { value: description },
            ['maxLength:1000']
        );
        if (descErrors.length > 0) {
            FormValidator.showError(
                form.querySelector('[name="description"]'),
                descErrors[0]
            );
            hasError = true;
        }
    }

    // 验证分类（可选）
    const category = formData.get('category') || '其他';

    // 验证省份和城市
    if (!formData.get('province')) {
        FormValidator.showError(
            form.querySelector('[name="province"]'),
            '请选择省份'
        );
        hasError = true;
    }

    if (!formData.get('city')) {
        FormValidator.showError(
            form.querySelector('[name="city"]'),
            '请选择城市'
        );
        hasError = true;
    }

    if (hasError) {
        // 滚动到第一个错误
        const firstError = form.querySelector('.error');
        if (firstError) {
            firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
            firstError.focus();
        }
        return;
    }

    // 使用获取的位置或默认位置
    let lat = parseFloat(formData.get('lat'));
    let lng = parseFloat(formData.get('lng'));

    if (!lat || !lng) {
        // 如果没有获取到位置，使用默认位置
        lat = 39.9042;
        lng = 116.4074;
    }

    // 组合位置信息：省-市-详细地址
    const province = formData.get('province') || '';
    const city = formData.get('city') || '';
    const address = formData.get('address') || '';
    const location = `${province}-${city}`;
    const needPhotoVerify = formData.get('need_photo_verify') === 'on';
    const depositAmount = parseFloat(formData.get('deposit_amount') || 0);

    // 处理开始时间（什么时候需要）
    const startTimeValue = formData.get('start_time') || 'now';
    const now = new Date();
    let startTime;
    if (startTimeValue === 'now') {
        startTime = now.toISOString();
    } else if (startTimeValue === '12h') {
        startTime = new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString();
    } else if (startTimeValue === 'week') {
        startTime = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (startTimeValue === 'custom') {
        const customInput = document.getElementById('start_time_custom');
        startTime = customInput && customInput.value ? new Date(customInput.value).toISOString() : now.toISOString();
    }

    // 处理截止时间（最晚什么时候）
    const deadlineInput = document.getElementById('deadline-input');
    const deadline = deadlineInput && deadlineInput.value ? new Date(deadlineInput.value).toISOString() : new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    const data = {
        user_id: currentUser ? currentUser.id : 1,
        title: title.trim(),
        description: description.trim() || title.trim(),
        category: category,
        location: location,
        address: address.trim(),
        reward: formData.get('reward'),
        is_urgent: isUrgent,
        urgent_type: isUrgent ? formData.get('urgent_type') : null,
        lat: lat || null,
        lng: lng || null,
        need_photo_verify: needPhotoVerify,
        deposit_amount: depositAmount,
        start_time: startTime,
        deadline: deadline
    };

    // 显示加载状态
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = '发布中...';

    // 发送请求到后端API
    try {
        const response = await fetch(CONFIG.API_BASE_URL + '/requests', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken || localStorage.getItem('auth_token')}`
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;

        if (result.success) {
            // 如果有选择的图片，上传图片
            if (typeof selectedRequestImages !== 'undefined' && selectedRequestImages.length > 0) {
                showToast('正在上传图片...', 'info');
                const uploadSuccess = await uploadRequestImages(result.data.id);
                if (!uploadSuccess) {
                    showToast('需求发布成功，但图片上传失败', 'warning');
                }
            }

            showToast(isUrgent ? '紧急需求发布成功！' : '需求发布成功！', 'success');
            closePublishModal();
            loadRequests();

            form.reset();
            // 清空已选图片
            if (typeof selectedRequestImages !== 'undefined') {
                selectedRequestImages = [];
                updateRequestImagesPreview();
            }
        } else {
            showToast('发布失败：' + result.message, 'error');
        }
    } catch (error) {
        console.error('发布需求失败:', error);
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        showToast('发布失败，请检查网络连接', 'error');
    }
}

// 二次确认弹窗
function showConfirmModal(title, message, onConfirm, onCancel) {
    const existing = document.getElementById('confirm-modal');
    if (existing) existing.remove();
    
    const callbackId = 'confirm_callback_' + Date.now();
    const cancelCallbackId = 'cancel_callback_' + Date.now();
    
    window[callbackId] = function() {
        delete window[callbackId];
        delete window[cancelCallbackId];
        if (typeof onConfirm === 'function') onConfirm();
    };
    
    window[cancelCallbackId] = function() {
        delete window[callbackId];
        delete window[cancelCallbackId];
        if (typeof onCancel === 'function') onCancel();
    };
    
    const modal = document.createElement('div');
    modal.id = 'confirm-modal';
    modal.className = 'modal active';
    modal.style.cssText = 'display: flex; align-items: center; justify-content: center; z-index: 10000;';
    
    modal.innerHTML = `
        <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;">
            <div style="background: white; padding: 24px; border-radius: 12px; max-width: 320px; width: 90%; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.2);">
                <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
                <h3 style="margin: 0 0 12px; font-size: 18px; color: #1f2937;">${title}</h3>
                <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; line-height: 1.5;">${message}</p>
                <div style="display: flex; gap: 12px; justify-content: center;">
                    <button onclick="this.closest('.modal').remove(); window['${cancelCallbackId}'] && window['${cancelCallbackId}']();" 
                        style="padding: 10px 24px; border: 1px solid #d1d5db; background: white; border-radius: 8px; cursor: pointer; font-size: 14px; color: #374151;">取消</button>
                    <button onclick="this.closest('.modal').remove(); window['${callbackId}'] && window['${callbackId}']();" 
                        style="padding: 10px 24px; border: none; background: #ef4444; color: white; border-radius: 8px; cursor: pointer; font-size: 14px;">确认</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// 显示更多菜单
function showMoreMenu() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'more-menu-modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 320px; border-radius: 1rem;">
            <div class="modal-header" style="padding: 1rem; border-bottom: 1px solid #eee;">
                <h3 style="margin: 0; font-size: 1.1rem;">更多功能</h3>
                <button class="close-btn" onclick="closeMoreMenu()">&times;</button>
            </div>
            <div style="padding: 0.5rem;">
                <a href="requests.html" class="menu-item" style="display: flex; align-items: center; padding: 0.875rem; text-decoration: none; color: #333; border-radius: 0.5rem;">
                    <span style="margin-right: 0.75rem;">📋</span>
                    <span>需求大厅</span>
                </a>
                <a href="profile.html" class="menu-item" style="display: flex; align-items: center; padding: 0.875rem; text-decoration: none; color: #333; border-radius: 0.5rem;">
                    <span style="margin-right: 0.75rem;">👤</span>
                    <span>个人中心</span>
                </a>
                <a href="history.html" class="menu-item" style="display: flex; align-items: center; padding: 0.875rem; text-decoration: none; color: #333; border-radius: 0.5rem;">
                    <span style="margin-right: 0.75rem;">📜</span>
                    <span>历史记录</span>
                </a>
                <a href="guide.html" class="menu-item" style="display: flex; align-items: center; padding: 0.875rem; text-decoration: none; color: #333; border-radius: 0.5rem;">
                    <span style="margin-right: 0.75rem;">📖</span>
                    <span>使用指南</span>
                </a>
                <a href="feedback.html" class="menu-item" style="display: flex; align-items: center; padding: 0.875rem; text-decoration: none; color: #333; border-radius: 0.5rem;">
                    <span style="margin-right: 0.75rem;">💡</span>
                    <span>意见反馈</span>
                </a>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
}

function closeMoreMenu() {
    const modal = document.getElementById('more-menu-modal');
    if (modal) {
        modal.remove();
        document.body.style.overflow = '';
    }
}

// Toast 提示
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };

    toast.innerHTML = `${icons[type] || ''} ${message}`;
    document.body.appendChild(toast);

    // 动画显示
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // 自动隐藏
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
window.showToast = showToast;

// 自定义确认对话框 (类似手机App风格)
function showConfirmDialog(options) {
    return new Promise((resolve) => {
        const { title, message, icon = '⚠️', confirmText = '确定', cancelText = '取消', danger = false } = options;

        // 创建对话框元素
        const overlay = document.createElement('div');
        overlay.className = 'confirm-dialog-overlay';
        overlay.innerHTML = `
            <div class="confirm-dialog">
                <div class="confirm-dialog-header">
                    <div class="confirm-dialog-icon">${icon}</div>
                    <h3 class="confirm-dialog-title">${title}</h3>
                    <p class="confirm-dialog-message">${message}</p>
                </div>
                <div class="confirm-dialog-actions">
                    <button class="confirm-dialog-btn confirm-dialog-btn-cancel">${cancelText}</button>
                    <button class="confirm-dialog-btn confirm-dialog-btn-confirm ${danger ? 'danger' : ''}">${confirmText}</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // 显示动画
        requestAnimationFrame(() => {
            overlay.classList.add('active');
        });

        // 绑定按钮事件
        const cancelBtn = overlay.querySelector('.confirm-dialog-btn-cancel');
        const confirmBtn = overlay.querySelector('.confirm-dialog-btn-confirm');

        const closeDialog = (result) => {
            overlay.classList.remove('active');
            setTimeout(() => {
                overlay.remove();
                resolve(result);
            }, 200);
        };

        cancelBtn.addEventListener('click', () => closeDialog(false));
        confirmBtn.addEventListener('click', () => closeDialog(true));

        // 点击遮罩层关闭
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeDialog(false);
            }
        });
    });
}

// 自定义输入对话框 (替代 prompt)
function showPromptDialog(options) {
    return new Promise((resolve) => {
        const { title, message, defaultValue = '', icon = '✏️', confirmText = '确定', cancelText = '取消', inputType = 'text', placeholder = '' } = options;

        // 创建对话框元素
        const overlay = document.createElement('div');
        overlay.className = 'prompt-dialog-overlay';
        overlay.innerHTML = `
            <div class="prompt-dialog">
                <div class="prompt-dialog-header">
                    <div class="prompt-dialog-icon">${icon}</div>
                    <h3 class="prompt-dialog-title">${title}</h3>
                    ${message ? `<p class="prompt-dialog-message">${message}</p>` : ''}
                </div>
                <div class="prompt-dialog-input-wrapper">
                    <input type="${inputType}" class="prompt-dialog-input" value="${defaultValue}" placeholder="${placeholder}">
                </div>
                <div class="prompt-dialog-actions">
                    <button class="prompt-dialog-btn prompt-dialog-btn-cancel">${cancelText}</button>
                    <button class="prompt-dialog-btn prompt-dialog-btn-confirm">${confirmText}</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // 获取输入框并聚焦
        const input = overlay.querySelector('.prompt-dialog-input');
        setTimeout(() => {
            input.focus();
            input.select();
        }, 100);

        // 显示动画
        requestAnimationFrame(() => {
            overlay.classList.add('active');
        });

        // 绑定按钮事件
        const cancelBtn = overlay.querySelector('.prompt-dialog-btn-cancel');
        const confirmBtn = overlay.querySelector('.prompt-dialog-btn-confirm');

        const closeDialog = (result) => {
            overlay.classList.remove('active');
            setTimeout(() => {
                overlay.remove();
                resolve(result);
            }, 200);
        };

        cancelBtn.addEventListener('click', () => closeDialog(null));
        confirmBtn.addEventListener('click', () => closeDialog(input.value));

        // 点击遮罩层关闭
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeDialog(null);
            }
        });

        // 回车确认
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                closeDialog(input.value);
            }
            if (e.key === 'Escape') {
                closeDialog(null);
            }
        });
    });
}

// 需求图片选择处理
async function handleRequestImagesSelect(input) {
    const files = Array.from(input.files);
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    if (selectedRequestImages.length + files.length > 5) {
        showToast('最多只能上传5张图片', 'error');
        return;
    }

    for (const file of files) {
        if (!allowedTypes.includes(file.type)) {
            showToast(`${file.name} 格式不支持`, 'error');
            continue;
        }

        if (file.size > 16 * 1024 * 1024) {
            showToast(`${file.name} 超过16MB限制`, 'error');
            continue;
        }

        // 压缩图片
        try {
            const compressed = await compressImage(file, 1200, 0.8);
            compressed.name = file.name;
            selectedRequestImages.push(compressed);
        } catch (e) {
            selectedRequestImages.push(file);
        }
    }

    updateRequestImagesPreview();
    input.value = '';
}

// 图片压缩
function compressImage(file, maxWidth = 1200, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob((blob) => {
                    if (blob) {
                        resolve(new File([blob], file.name, { type: 'image/jpeg' }));
                    } else {
                        reject(new Error('压缩失败'));
                    }
                }, 'image/jpeg', quality);
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function updateRequestImagesPreview() {
    const previewContainer = document.getElementById('request-images-preview');
    const countLabel = document.getElementById('request-images-count');

    if (!previewContainer) return;

    previewContainer.innerHTML = selectedRequestImages.map((file, index) => {
        const url = URL.createObjectURL(file);
        return `
            <div style="position: relative; width: 80px; height: 80px; border-radius: 8px; overflow: hidden; border: 1px solid var(--gray-200);">
                <img src="${url}" style="width: 100%; height: 100%; object-fit: cover;">
                <button type="button" onclick="removeRequestImage(${index})" style="position: absolute; top: 2px; right: 2px; width: 20px; height: 20px; background: rgba(0,0,0,0.5); border: none; border-radius: 50%; color: white; font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center;">×</button>
            </div>
        `;
    }).join('');

    if (countLabel) {
        countLabel.textContent = `已选择 ${selectedRequestImages.length}/5 张`;
    }
}

function removeRequestImage(index) {
    selectedRequestImages.splice(index, 1);
    updateRequestImagesPreview();
}

// 上传需求图片
async function uploadRequestImages(requestId) {
    if (selectedRequestImages.length === 0) return true;

    const formData = new FormData();
    selectedRequestImages.forEach(file => {
        formData.append('images', file);
    });

    try {
        const response = await fetch(CONFIG.API_BASE_URL + `/requests/${requestId}/images`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken || localStorage.getItem('auth_token')}`
            },
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            // 清空已选图片
            selectedRequestImages = [];
            updateRequestImagesPreview();
            return true;
        } else {
            showToast(result.message || '图片上传失败', 'error');
            return false;
        }
    } catch (error) {
        console.error('上传需求图片失败:', error);
        showToast('图片上传失败，请检查网络连接', 'error');
        return false;
    }
}

// 显示需求详情
async function showRequestDetail(requestId) {
    // 先从 allRequests 中查找
    let req = allRequests.find(r => r.id === requestId);
    
    // 如果找不到，尝试从后端 API 获取
    if (!req) {
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/requests/${requestId}`);
            const result = await response.json();
            if (result.success) {
                req = result.data;
            }
        } catch (error) {
            console.error('获取需求详情失败:', error);
        }
    }
    
    // 如果还是找不到，尝试从 mockAPI 获取
    if (!req) {
        const result = window.mockAPI.getRequestDetail(requestId);
        if (result.success) {
            req = result.data;
        }
    }
    
    if (!req) {
        showToast('需求不存在或已删除', 'error');
        return;
    }
    
    document.getElementById('detail-title').textContent = '需求详情';
    
    const content = document.getElementById('detail-content');
    content.innerHTML = `
        <div class="detail-section">
            <span class="request-category">${getCategoryIcon(req.category)} ${req.category}</span>
            <span class="request-status status-${req.status}" style="margin-left: 0.5rem;">${getStatusText(req.status)}</span>
            <h2 style="margin-top: 1rem; margin-bottom: 0.5rem;">${req.title}</h2>
        </div>
        
        <div class="detail-meta">
            <div class="detail-meta-item">
                <div class="detail-meta-label">报酬</div>
                <div class="detail-meta-value">${req.reward || '面议'}</div>
            </div>
            <div class="detail-meta-item">
                <div class="detail-meta-label">位置</div>
                <div class="detail-meta-value">${req.location || '未知'}</div>
            </div>
            <div class="detail-meta-item">
                <div class="detail-meta-label">发布时间</div>
                <div class="detail-meta-value">${formatTime(req.created_at)}</div>
            </div>
            ${req.distance !== null && req.distance !== undefined ? `
            <div class="detail-meta-item">
                <div class="detail-meta-label">距离</div>
                <div class="detail-meta-value">
                    <span class="distance-badge">📍 ${req.distance.toFixed(1)}km</span>
                </div>
            </div>
            ` : ''}
        </div>
        
        <div class="detail-section">
            <h4>需求描述</h4>
            <p>${req.description}</p>
        </div>
        
        <div class="detail-section">
            <h4>发布者</h4>
            <div class="detail-user">
                <div class="detail-user-avatar">
                    <img src="${req.user_avatar || getAvatar(req.user_id)}" alt="">
                </div>
                <div class="detail-user-info">
                    <h4>${req.user_nickname || '匿名用户'}</h4>
                    <p>★ ${(req.user_rating || 5).toFixed(1)} · ${req.user_bio || '暂无简介'}</p>
                </div>
            </div>
            ${req.user_id !== currentUser?.id ? `
            <button class="btn btn-outline" onclick="showChatWindow(${req.user_id}, '${req.user_nickname || '发布者'}')" style="width: 100%; margin-top: 0.75rem;">
                💬 联系他/她
            </button>
            ` : ''}
        </div>
        
        ${req.helper ? `
        <div class="detail-section">
            <h4>帮助者</h4>
            <div class="detail-user">
                <div class="detail-user-avatar">
                    <img src="${req.helper.avatar || getAvatar(req.helper_id)}" alt="">
                </div>
                <div class="detail-user-info">
                    <h4>${req.helper.nickname}</h4>
                    <p>${req.helper_status === 'departed' ? '🚗 已出发' : req.helper_status === 'arrived' ? '🏠 已到达' : '正在帮助中'}</p>
                    ${req.helper_status ? `<span class="request-status status-accepted" style="font-size: 0.75rem;">${getHelperStatusText(req.helper_status)}</span>` : ''}
                </div>
            </div>
            <button class="btn btn-outline" onclick="showChatWindow(${req.helper_id}, '${req.helper.nickname}')" style="width: 100%; margin-top: 0.75rem;">
                💬 联系他/她
            </button>
        </div>
        ` : ''}
        
        ${req.messages && req.messages.length > 0 ? `
        <div class="chat-section">
            <h4>沟通记录</h4>
            <div class="chat-messages">
                ${req.messages.map(m => `
                    <div class="chat-message ${m.sender_id === currentUser?.id ? 'sent' : 'received'}">
                        <div class="chat-avatar">
                            <img src="${m.sender_avatar || getAvatar(m.sender_id)}" alt="">
                        </div>
                        <div class="chat-content">
                            <div class="chat-header">
                                <span class="chat-author">${m.sender_nickname}</span>
                                <span class="chat-time">${formatTime(m.created_at)}</span>
                            </div>
                            <p class="chat-text">${m.content}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
        ` : ''}
        
        ${req.status === 'pending' && req.user_id !== currentUser?.id ? `
            <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--gray-200);">
                <button class="btn btn-primary btn-large" onclick="acceptRequest(${req.id}, ${req.user_id})" style="width: 100%;">
                    我来帮TA
                </button>
            </div>
        ` : ''}
        
        ${req.status === 'accepted' && req.helper_id === currentUser?.id ? `
            <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--gray-200);">
                ${!req.helper_completed ? `
                <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
                    ${req.helper_status !== 'departed' ? `
                    <button class="btn btn-secondary" onclick="updateHelperStatus(${req.id}, 'departed')" style="flex: 1;">
                        🚗 出发
                    </button>
                    ` : ''}
                    ${req.helper_status === 'departed' ? `
                    <button class="btn btn-secondary" onclick="updateHelperStatus(${req.id}, 'arrived')" style="flex: 1;">
                        🏠 到达
                    </button>
                    ` : ''}
                </div>
                <button class="btn btn-primary btn-large" onclick="markComplete(${req.id})" style="width: 100%;">
                    ✅ 标记完成
                </button>
                ` : `
                <div style="padding: 1rem; background: #d1fae5; border-radius: 8px; text-align: center;">
                    <span style="color: #065f46; font-weight: 600;">✅ 已标记完成</span>
                    <p style="font-size: 0.875rem; color: #047857; margin-top: 0.25rem;">
                        等待发布者确认并支付报酬
                    </p>
                </div>
                `}
            </div>
        ` : ''}
        
        ${req.status === 'accepted' && req.helper_id && req.user_id !== currentUser?.id ? `
            <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--gray-200);">
                <button class="btn btn-outline" onclick="raiseHand(${req.id})" style="width: 100%;">
                    🙋 举手：我也能去
                </button>
            </div>
        ` : ''}
        
        ${req.status === 'accepted' && req.user_id === currentUser?.id ? `
            <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--gray-200);">
                ${req.helper_completed ? `
                    <button class="btn btn-primary" onclick="confirmAndPayReward(${req.id}, ${parseFloat(req.reward?.replace(/[^0-9.]/g, '') || 0)})" style="width: 100%;">
                        ✅ 确认完成并支付报酬
                    </button>
                    <p style="font-size: 0.75rem; color: #059669; text-align: center; margin-top: 0.5rem;">
                        ⏳ 接单人已标记完成，确认后报酬 ¥${parseFloat(req.reward?.replace(/[^0-9.]/g, '') || 0)} 将支付给接单人
                    </p>
                ` : `
                    <button class="btn btn-outline" disabled style="width: 100%; cursor: not-allowed;">
                        ⏳ 等待接单人标记完成
                    </button>
                    <p style="font-size: 0.75rem; color: #6b7280; text-align: center; margin-top: 0.5rem;">
                        接单人完成服务后可确认并支付报酬
                    </p>
                `}
            </div>
            <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--gray-200);">
                <button class="btn btn-outline" onclick="showCandidatesAndReassign(${req.id})" style="width: 100%;">
                    👥 查看候选人 / 换人
                </button>
            </div>
        ` : ''}
        
        ${req.status === 'completed' ? `
            <div style="margin-top: 1.5rem; padding: 1rem; background: #d1fae5; border-radius: 8px; text-align: center;">
                <span style="color: #065f46; font-weight: 600;">✅ 任务已完成</span>
                <p style="font-size: 0.875rem; color: #047857; margin-top: 0.25rem;">
                    报酬 ¥${parseFloat(req.reward?.replace(/[^0-9.]/g, '') || 0)} 已支付给接单人
                </p>
            </div>
        ` : ''}
        
        ${req.status === 'pending' && req.user_id === currentUser?.id ? `
            <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--gray-200);">
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-outline" onclick="showChangeRewardModal(${req.id}, '${req.reward || ''}')" style="flex: 1;">
                        ✏️ 改价
                    </button>
                    <button class="btn btn-outline" onclick="cancelRequest(${req.id})" style="flex: 1;">
                        ❌ 取消
                    </button>
                </div>
            </div>
        ` : ''}
        
        ${req.deposit_amount > 0 ? `
        <div style="margin-top: 1rem; padding: 0.75rem; background: #fef3c7; border-radius: 8px; font-size: 0.875rem;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>💎 押金：¥${req.deposit_amount}</span>
                ${req.user_id === currentUser?.id ? `
                    ${!req.deposit_paid ? `
                        <button class="btn btn-sm" onclick="payDeposit(${req.id}, ${req.deposit_amount})">支付押金</button>
                    ` : req.deposit_refunded ? `
                        <span style="color: #059669;">已退还</span>
                    ` : `
                        <button class="btn btn-sm" onclick="refundDeposit(${req.id}, ${req.deposit_amount})">退还押金</button>
                    `}
                ` : `
                    ${req.deposit_paid ? '<span style="color: #059669;">✅ 已付押金</span>' : '<span>⏳ 待付押金</span>'}
                `}
            </div>
        </div>
        ` : ''}
        
        ${req.need_photo_verify ? `
        <div style="margin-top: 0.5rem; padding: 0.5rem; background: #dbeafe; border-radius: 8px; font-size: 0.875rem; text-align: center;">
            📷 需要拍照验收
        </div>
        ` : ''}
    `;
    
    document.getElementById('detail-modal').classList.add('active');
}

// loadRequestDetail 是 showRequestDetail 的别名
const loadRequestDetail = showRequestDetail;

// 关闭详情弹窗
function closeDetailModal() {
    const modal = document.getElementById('detail-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// 接受请求
function acceptRequest(requestId, publisherId) {
    if (!currentUser) {
        showToast('请先登录后再接受帮助', 'warning');
        showLoginModal();
        return;
    }

    fetch(CONFIG.API_BASE_URL + `/requests/${requestId}/accept`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken || localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({})
    })
    .then(async response => {
        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch (e) {
            console.error('服务器返回非JSON:', text.substring(0, 500));
            throw new Error('服务器返回格式错误: ' + text.substring(0, 100));
        }
    })
    .then(result => {
        if (result.success) {
            // 立即跳转，不等待其他操作
            window.location.replace('profile.html?tab=helps');

            // 异步发送消息（不阻塞跳转）
            if (publisherId) {
                setTimeout(() => {
                    sendMessage(publisherId, '你好，我来帮你！', requestId);
                }, 100);
            }
        } else {
            showToast('操作失败：' + result.message, 'error');
        }
    })
    .catch(error => {
        console.error('接单失败:', error);
        showToast('操作失败: ' + error.message, 'error');
    });
}

// 更新接单人状态（出发/到达）
async function updateHelperStatus(requestId, status) {
    if (!currentUser) {
        showToast('请先登录', 'warning');
        return;
    }
    
    try {
        const response = await fetch(CONFIG.API_BASE_URL + `/requests/${requestId}/helper_status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken || localStorage.getItem('auth_token')}`
            },
            body: JSON.stringify({ status: status })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast(status === 'departed' ? '已标记为出发' : '已标记为到达', 'success');
            closeDetailModal();
            loadRequests();
            loadRequestDetail(requestId);
        } else {
            showToast(result.message || '操作失败', 'error');
        }
    } catch (error) {
        console.error('更新状态失败:', error);
        showToast('操作失败', 'error');
    }
}

// 发单方改价
async function showChangeRewardModal(requestId, currentReward) {
    const newReward = await showPromptDialog({
        title: '修改报酬',
        message: '请输入新的报酬金额',
        defaultValue: currentReward,
        icon: '💰',
        confirmText: '确认修改',
        cancelText: '取消',
        placeholder: '如：150元'
    });

    if (!newReward || newReward === currentReward) return;

    if (!currentUser) {
        showToast('请先登录', 'warning');
        return;
    }
    
    try {
        const response = await fetch(CONFIG.API_BASE_URL + `/requests/${requestId}/change_reward`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken || localStorage.getItem('auth_token')}`
            },
            body: JSON.stringify({ reward: newReward })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('报酬已修改', 'success');
            closeDetailModal();
            loadRequests();
            loadRequestDetail(requestId);
        } else {
            showToast(result.message || '修改失败', 'error');
        }
    } catch (error) {
        console.error('改价失败:', error);
        showToast('操作失败', 'error');
    }
}

// 发单方取消发布
async function cancelRequest(requestId) {
    if (!currentUser) {
        showToast('请先登录', 'warning');
        return;
    }

    const confirmed = await showConfirmDialog({
        title: '取消需求',
        message: '确定要取消此需求吗？取消后将无法恢复。',
        icon: '⚠️',
        confirmText: '确定取消',
        cancelText: '保留需求',
        danger: true
    });

    if (!confirmed) return;
    
    try {
        const response = await fetch(CONFIG.API_BASE_URL + `/requests/${requestId}/cancel`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken || localStorage.getItem('auth_token')}`
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('需求已取消', 'success');
            closeDetailModal();
            loadRequests();
        } else {
            showToast(result.message || '取消失败', 'error');
        }
    } catch (error) {
        console.error('取消失败:', error);
        showToast('操作失败', 'error');
    }
}

// 举手（加入候选人列表）
async function raiseHand(requestId) {
    if (!currentUser) {
        showToast('请先登录', 'warning');
        return;
    }

    const confirmed = await showConfirmDialog({
        title: '举手接单',
        message: '确定要举手吗？发布者可以更换你为接单人。',
        icon: '🙋',
        confirmText: '确定举手',
        cancelText: '再考虑'
    });

    if (!confirmed) return;

    try {
        const response = await fetch(CONFIG.API_BASE_URL + `/requests/${requestId}/raise_hand`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken || localStorage.getItem('auth_token')}`
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast(result.message || '举手成功', 'success');
            loadRequestDetail(requestId);
        } else {
            showToast(result.message || '举手失败', 'error');
        }
    } catch (error) {
        console.error('举手失败:', error);
        showToast('举手失败，请重试', 'error');
    }
}

// 查看候选人列表并换人
async function showCandidatesAndReassign(requestId) {
    if (!currentUser) {
        showToast('请先登录', 'warning');
        return;
    }
    
    try {
        const response = await fetch(CONFIG.API_BASE_URL + `/requests/${requestId}/candidates`, {
            headers: {
                'Authorization': `Bearer ${authToken || localStorage.getItem('auth_token')}`
            }
        });
        
        const result = await response.json();
        
        if (!result.success) {
            showToast(result.message || '获取候选人失败', 'error');
            return;
        }
        
        const candidates = result.data;
        
        if (!candidates || candidates.length === 0) {
            showToast('还没有人举手', 'info');
            return;
        }
        
        let candidatesHtml = candidates.map(c => `
            <div class="candidate-item" style="display: flex; align-items: center; padding: 12px; border-bottom: 1px solid #eee; gap: 12px;">
                <img src="${c.avatar || getAvatar(c.username)}" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover;">
                <div style="flex: 1;">
                    <div style="font-weight: 500;">${c.nickname || c.username}</div>
                    <div style="font-size: 12px; color: #666;">帮助次数: ${c.help_count} | 评分: ${c.rating}</div>
                </div>
                <button class="btn btn-primary btn-sm" onclick="reassignHelper(${requestId}, ${c.helper_id}, '${c.nickname || c.username}')">
                    换人
                </button>
            </div>
        `).join('');
        
        const modal = document.createElement('div');
        modal.id = 'candidates-modal';
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 400px;">
                <div style="padding: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                        <h3 style="margin: 0;">候选人列表</h3>
                        <button onclick="document.getElementById('candidates-modal').remove()" style="background: none; border: none; font-size: 24px; cursor: pointer;">&times;</button>
                    </div>
                    <div style="max-height: 300px; overflow-y: auto;">
                        ${candidatesHtml}
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
    } catch (error) {
        console.error('获取候选人失败:', error);
        showToast('获取候选人失败', 'error');
    }
}

// 换人
async function reassignHelper(requestId, newHelperId, helperName) {
    const confirmed = await showConfirmDialog({
        title: '更换接单人',
        message: `确定要换人为 ${helperName} 吗？`,
        icon: '🔄',
        confirmText: '确定更换',
        cancelText: '取消'
    });

    if (!confirmed) return;

    try {
        const response = await fetch(CONFIG.API_BASE_URL + `/requests/${requestId}/reassign`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken || localStorage.getItem('auth_token')}`
            },
            body: JSON.stringify({ new_helper_id: newHelperId })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('换人成功', 'success');
            document.getElementById('candidates-modal')?.remove();
            loadRequests();
            loadRequestDetail(requestId);
        } else {
            showToast(result.message || '换人失败', 'error');
        }
    } catch (error) {
        console.error('换人失败:', error);
        showToast('换人失败，请重试', 'error');
    }
}

// 支付押金
async function payDeposit(requestId, depositAmount) {
    if (!currentUser) {
        showToast('请先登录', 'warning');
        return;
    }

    const confirmed = await showConfirmDialog({
        title: '支付押金',
        message: `确定要支付押金 ¥${depositAmount} 吗？`,
        icon: '💰',
        confirmText: '确定支付',
        cancelText: '取消'
    });

    if (!confirmed) return;

    try {
        const response = await fetch(CONFIG.API_BASE_URL + `/requests/${requestId}/pay_deposit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken || localStorage.getItem('auth_token')}`
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('押金已支付', 'success');
            closeDetailModal();
            loadRequests();
            loadRequestDetail(requestId);
        } else {
            showToast(result.message || '支付失败', 'error');
        }
    } catch (error) {
        console.error('支付押金失败:', error);
        showToast('操作失败', 'error');
    }
}

// 接单人标记完成
async function markComplete(requestId) {
    if (!currentUser) {
        showToast('请先登录', 'warning');
        showLoginModal();
        return;
    }

    const confirmed = await showConfirmDialog({
        title: '标记完成',
        message: '确定要标记任务已完成吗？发布者确认后，报酬将支付给您。',
        icon: '✅',
        confirmText: '确定完成',
        cancelText: '再等等'
    });

    if (!confirmed) return;

    try {
        const response = await fetch(CONFIG.API_BASE_URL + `/requests/${requestId}/mark_complete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken || localStorage.getItem('auth_token')}`
            }
        });

        const result = await response.json();

        if (result.success) {
            // 立即显示成功提示并跳转，不等待其他操作
            showToast('✅ 已标记完成，等待发布者确认', 'success');
            // 异步刷新详情，不阻塞用户操作
            setTimeout(() => {
                loadRequestDetail(requestId);
            }, 100);
        } else {
            showToast(result.message || '操作失败', 'error');
        }
    } catch (error) {
        console.error('标记完成失败:', error);
        showToast('操作失败', 'error');
    }
}

// 确认完成并支付报酬 - 显示收款码让用户扫码支付
async function confirmAndPayReward(requestId, rewardAmount) {
    if (!currentUser) {
        showToast('请先登录', 'warning');
        showLoginModal();
        return;
    }
    
    try {
        const response = await fetch(CONFIG.API_BASE_URL + `/requests/${requestId}`, {
            headers: {
                'Authorization': `Bearer ${authToken || localStorage.getItem('auth_token')}`
            }
        });
        
        const result = await response.json();
        
        if (!result.success || !result.data.helper) {
            showToast('获取接单人信息失败', 'error');
            return;
        }
        
        const helper = result.data.helper;
        const paymentQRCode = helper.payment_qr_code;
        const paymentQRType = helper.payment_qr_type;
        
        if (!paymentQRCode) {
            showToast('接单人尚未设置收款码，无法支付', 'warning');
            return;
        }
        
        const qrTypeName = paymentQRType === 'wechat' ? '微信' : '支付宝';
        
        const payModal = document.createElement('div');
        payModal.id = 'pay-modal';
        payModal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.8); z-index: 999999;
            display: flex; align-items: center; justify-content: center;
            padding: 1rem;
        `;
        
        payModal.innerHTML = `
            <div style="background: white; border-radius: 16px; padding: 1.5rem; max-width: 360px; width: 100%; text-align: center;">
                <button onclick="this.closest('#pay-modal').remove()" style="position: absolute; top: 1rem; right: 1rem; background: none; border: none; font-size: 1.5rem; cursor: pointer;">×</button>
                <h3 style="margin: 0 0 1rem 0; color: #1f2937;">扫码支付报酬</h3>
                <p style="color: #6b7280; font-size: 0.875rem; margin-bottom: 1rem;">
                    支付 <span style="color: #059669; font-weight: bold; font-size: 1.25rem;">¥${rewardAmount}</span> 给接单人
                </p>
                <div style="background: #f9fafb; border-radius: 12px; padding: 1rem; margin-bottom: 1rem;">
                    <img src="${paymentQRCode}" alt="收款码" style="max-width: 200px; border-radius: 8px;">
                    <p style="margin: 0.5rem 0 0 0; font-size: 0.875rem; color: #374151;">
                        ${qrTypeName}收款码
                    </p>
                </div>
                <p style="font-size: 0.75rem; color: #9ca3af; margin-bottom: 1rem;">
                    请使用${qrTypeName}扫描上方二维码完成支付
                </p>
                <button onclick="confirmPayment(${requestId}, ${rewardAmount})" 
                    style="width: 100%; padding: 0.875rem; background: #059669; color: white; border: none; border-radius: 8px; font-size: 1rem; cursor: pointer; font-weight: 600;">
                    ✅ 我已支付
                </button>
                <button onclick="this.closest('#pay-modal').remove()" 
                    style="width: 100%; padding: 0.75rem; background: transparent; color: #6b7280; border: 1px solid #d1d5db; border-radius: 8px; font-size: 0.875rem; cursor: pointer; margin-top: 0.5rem;">
                    取消
                </button>
            </div>
        `;
        
        document.body.appendChild(payModal);
        
    } catch (error) {
        console.error('获取收款码失败:', error);
        showToast('获取支付信息失败', 'error');
    }
}

// 确认已支付
async function confirmPayment(requestId, rewardAmount) {
    try {
        const response = await fetch(CONFIG.API_BASE_URL + `/requests/${requestId}/complete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken || localStorage.getItem('auth_token')}`
            }
        });
        
        const result = await response.json();
        
        const payModal = document.getElementById('pay-modal');
        if (payModal) payModal.remove();
        
        if (result.success) {
            showToast(`✅ 支付成功！报酬 ¥${rewardAmount} 已支付给接单人`, 'success');
            loadRequests();
            loadRequestDetail(requestId);
        } else {
            showToast(result.message || '支付确认失败', 'error');
        }
    } catch (error) {
        console.error('确认支付失败:', error);
        showToast('操作失败', 'error');
    }
}

// 退还押金
async function refundDeposit(requestId, depositAmount) {
    if (!currentUser) {
        showToast('请先登录', 'warning');
        return;
    }

    const confirmed = await showConfirmDialog({
        title: '退还押金',
        message: `确定要退还押金 ¥${depositAmount} 吗？`,
        icon: '💸',
        confirmText: '确定退还',
        cancelText: '取消'
    });

    if (!confirmed) return;

    try {
        const response = await fetch(CONFIG.API_BASE_URL + `/requests/${requestId}/refund_deposit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken || localStorage.getItem('auth_token')}`
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('押金已退还', 'success');
            closeDetailModal();
            loadRequests();
            loadRequestDetail(requestId);
        } else {
            showToast(result.message || '退还失败', 'error');
        }
    } catch (error) {
        console.error('退还押金失败:', error);
        showToast('操作失败', 'error');
    }
}

// 显示完成弹窗
async function showCompleteModal(requestId) {
    if (!currentUser) {
        showToast('请先登录后再完成需求', 'warning');
        showLoginModal();
        return;
    }

    const rating = await showPromptDialog({
        title: '评价帮助',
        message: '请为这次帮助打分（1-5星）',
        defaultValue: '5',
        icon: '⭐',
        confirmText: '下一步',
        cancelText: '取消',
        inputType: 'number',
        placeholder: '1-5'
    });

    if (!rating || rating < 1 || rating > 5) return;

    const review = await showPromptDialog({
        title: '写下评价',
        message: '请写下您的评价（可选）',
        defaultValue: '',
        icon: '💬',
        confirmText: '提交评价',
        cancelText: '跳过',
        placeholder: '说说这次帮助的体验...'
    });

    fetch(CONFIG.API_BASE_URL + `/requests/${requestId}/complete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken || localStorage.getItem('auth_token')}`
            },
            body: JSON.stringify({
                rating: parseInt(rating),
                review: review
            })
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                showToast('需求已完成！感谢您的帮助！', 'success');
                closeDetailModal();
                loadRequests();
            } else {
                showToast(result.message || '完成失败', 'error');
            }
        })
        .catch(error => {
            console.error('完成需求失败:', error);
            showToast('操作失败，请重试', 'error');
        });
}

// 显示用户资料
function showUserProfile(userId) {
    const result = window.mockAPI.getUser(userId);
    if (!result.success) return;
    
    const user = result.data;
    
    document.getElementById('detail-title').textContent = '用户资料';
    const content = document.getElementById('detail-content');
    
    content.innerHTML = `
        <div class="profile-header">
            <img class="profile-avatar" src="${user.avatar}" alt="">
            <h2>${user.nickname}</h2>
            <p class="profile-bio">${user.bio || '暂无简介'}</p>
            <div class="profile-skills">
                ${user.skills ? user.skills.map(skill => `<span class="skill-tag">${skill}</span>`).join('') : ''}
            </div>
        </div>
        
        <div class="profile-stats">
            <div class="profile-stat">
                <span class="stat-value">${user.help_count}</span>
                <span class="stat-label">帮助次数</span>
            </div>
            <div class="profile-stat">
                <span class="stat-value">${user.rating.toFixed(1)}</span>
                <span class="stat-label">评分</span>
            </div>
            <div class="profile-stat">
                <span class="stat-value">${user.points}</span>
                <span class="stat-label">积分</span>
            </div>
        </div>
        
        <div class="profile-section">
            <h4>帮助记录</h4>
            ${user.help_records && user.help_records.length > 0 ? user.help_records.map(hr => {
                const req = allRequests.find(r => r.id === hr.request_id);
                return req ? `
                    <div class="profile-record">
                        <span class="record-title">${req.title}</span>
                        <span class="record-status status-${hr.status}">${getStatusText(hr.status)}</span>
                        ${hr.rating ? `<span class="record-rating">★${hr.rating}</span>` : ''}
                    </div>
                ` : '';
            }).join('') : '<p style="color: var(--gray-500);">暂无帮助记录</p>'}
        </div>
    `;
    
    document.getElementById('detail-modal').classList.add('active');
}

// 显示个人中心
function showProfileModal() {
    try {
        console.log('showProfileModal called, currentUser:', currentUser);
        // 尝试从本地存储加载用户信息
        if (!currentUser) {
            const userStr = localStorage.getItem('current_user');
            console.log('userStr from localStorage:', userStr);
            if (userStr) {
                try {
                    currentUser = JSON.parse(userStr);
                    console.log('currentUser loaded from localStorage:', currentUser);
                } catch (e) {
                    console.error('解析用户数据失败:', e);
                    closePublishModal();
                    closeDetailModal();
                    showLoginModal();
                    return;
                }
            } else {
                console.log('No user in localStorage, showing login modal');
                closePublishModal();
                closeDetailModal();
                showLoginModal();
                return;
            }
        }
        
        let user;
        let result = window.mockAPI.getUser(currentUser.id);
        
        if (result.success && result.data) {
            user = result.data;
            // 补充收款码信息（从currentUser获取）
            user.payment_qr_code = currentUser.payment_qr_code;
            user.payment_qr_type = currentUser.payment_qr_type;
        } else {
            // 如果获取用户数据失败，显示错误提示
            console.error('获取用户数据失败:', result.message || '用户数据为空');
            clearAuthState();
            closePublishModal();
            closeDetailModal();
            showLoginModal();
            return;
        }
        
        document.getElementById('detail-title').textContent = '';
        const content = document.getElementById('detail-content');
        
        // 获取徽章
        const badgesResult = window.mockAPI.getBadges();
        const badges = badgesResult.success ? badgesResult.data : [];
        
        content.innerHTML = `
            <div class="profile-container">
                <!-- 顶部用户信息卡片 -->
                <div class="profile-card profile-user-card">
                    <div class="profile-cover"></div>
                    <div class="profile-user-info">
                        <div class="profile-avatar-wrapper">
                            <div class="profile-avatar-large">
                                <img src="${user.avatar}" alt="">
                            </div>
                            <button class="profile-edit-btn" onclick="editProfile()" title="编辑资料">
                                <span>✏️</span>
                            </button>
                        </div>
                        <div class="profile-user-meta">
                            <h2 class="profile-name">${user.nickname}</h2>
                            <p class="profile-location"><span class="location-icon">📍</span>${user.location || '未设置位置'}</p>
                            <p class="profile-bio">${user.bio || '暂无简介，点击编辑添加...'}</p>
                        </div>
                    </div>
                </div>
                
                <!-- 统计数据卡片 -->
                <div class="profile-card profile-stats-card">
                    <div class="profile-stats-grid">
                        <div class="profile-stat-item">
                            <div class="stat-icon">🤝</div>
                            <div class="stat-info">
                                <span class="stat-value">${user.help_count || 0}</span>
                                <span class="stat-label">帮助次数</span>
                            </div>
                        </div>
                        <div class="profile-stat-item">
                            <div class="stat-icon">📋</div>
                            <div class="stat-info">
                                <span class="stat-value">${user.request_count || 0}</span>
                                <span class="stat-label">发布需求</span>
                            </div>
                        </div>
                        <div class="profile-stat-item">
                            <div class="stat-icon">⭐</div>
                            <div class="stat-info">
                                <span class="stat-value">${(user.rating || 5.0).toFixed(1)}</span>
                                <span class="stat-label">评分</span>
                            </div>
                        </div>

                    </div>
                </div>
                
                <!-- 收款码设置 -->
                <div class="profile-card">
                    <div class="card-header">
                        <h4><span class="header-icon">💰</span>收款码设置</h4>
                    </div>
                    <div style="padding: 1rem;">
                        <p style="font-size: 0.875rem; color: var(--gray-600); margin-bottom: 1rem;">
                            上传您的微信/支付宝收款码，方便他人支付报酬给您
                        </p>
                        <div id="profile-payment-qr-preview" style="margin-bottom: 1rem;">
                            ${user.payment_qr_code ? `
                                <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
                                    <div style="position: relative;">
                                        <img src="${user.payment_qr_code}" style="max-width: 120px; border-radius: 8px; border: 2px solid var(--gray-200);">
                                        <button onclick="deletePaymentQR()" style="position: absolute; top: -6px; right: -6px; width: 22px; height: 22px; border-radius: 50%; background: #ef4444; color: white; border: none; cursor: pointer; font-size: 12px; line-height: 1;">×</button>
                                    </div>
                                    <div>
                                        <p style="color: #059669; font-weight: 600; margin: 0;">✓ 已设置${user.payment_qr_type === 'wechat' ? '微信' : '支付宝'}收款码</p>
                                        <p style="font-size: 0.75rem; color: var(--gray-500); margin: 0.25rem 0 0 0;">他人可扫码支付报酬</p>
                                    </div>
                                </div>
                            ` : `
                                <div style="padding: 1.5rem; border: 2px dashed var(--gray-300); border-radius: 12px; text-align: center;">
                                    <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">📷</div>
                                    <p style="color: var(--gray-500); margin: 0;">尚未设置收款码</p>
                                    <p style="font-size: 0.75rem; color: var(--gray-400); margin: 0.25rem 0 0 0;">上传后才能收到报酬</p>
                                </div>
                            `}
                        </div>
                        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                            <label class="btn btn-outline" style="cursor: pointer; flex: 1; text-align: center; min-width: 140px;">
                                <span style="display: inline-block; margin-right: 0.25rem;">📷</span>上传微信收款码
                                <input type="file" accept="image/*" onchange="uploadPaymentQR(this, 'wechat')" style="display: none;">
                            </label>
                            <label class="btn btn-outline" style="cursor: pointer; flex: 1; text-align: center; min-width: 140px;">
                                <span style="display: inline-block; margin-right: 0.25rem;">💳</span>上传支付宝收款码
                                <input type="file" accept="image/*" onchange="uploadPaymentQR(this, 'alipay')" style="display: none;">
                            </label>
                        </div>
                    </div>
                </div>
                
                <!-- 技能标签 -->
                <div class="profile-card">
                    <div class="card-header">
                        <h4><span class="header-icon">🎯</span>我的技能</h4>
                    </div>
                    <div class="profile-skills-tags">
                        ${user.skills && user.skills.length > 0 ? user.skills.map(skill => `<span class="skill-tag-modern">${skill}</span>`).join('') : '<span class="empty-tip">暂无技能标签，点击编辑添加...</span>'}
                    </div>
                </div>
                
                <!-- 徽章展示 -->
                <div class="profile-card">
                    <div class="card-header">
                        <h4><span class="header-icon">🏅</span>我的徽章</h4>
                        <span class="badge-progress">${badges.filter(b => b.earned).length}/${badges.length}</span>
                    </div>
                    <div class="badges-grid-modern">
                        ${badges.map(badge => `
                            <div class="badge-item-modern ${badge.earned ? 'earned' : 'locked'}">
                                <div class="badge-icon-wrap">
                                    <span class="badge-icon">${badge.icon}</span>
                                </div>
                                <span class="badge-name">${badge.name}</span>
                                <span class="badge-desc">${badge.description}</span>
                                ${badge.earned ? '<span class="badge-check">✓</span>' : '<span class="badge-lock">🔒</span>'}
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <!-- 历史记录 -->
                <div class="profile-card">
                    <div class="card-header">
                        <h4><span class="header-icon">📜</span>历史记录</h4>
                        <a href="history.html" class="view-all-link" onclick="closeDetailModal()">查看全部 →</a>
                    </div>
                    <div class="profile-requests-list">
                        ${user.my_requests && user.my_requests.length > 0 ? user.my_requests.slice(0, 3).map(req => `
                            <div class="profile-request-item" onclick="showRequestDetail(${req.id})" style="cursor: pointer;">
                                <div class="request-info">
                                    <span class="request-title">${req.title}</span>
                                    <span class="request-date">${formatTime(req.created_at)}</span>
                                </div>
                                <span class="request-status status-${req.status}">${getStatusText(req.status)}</span>
                            </div>
                        `).join('') : '<div class="empty-state"><span class="empty-icon">📭</span><p>暂无历史记录</p><button class="btn btn-primary btn-sm" onclick="closeDetailModal(); showPublishModal();">发布需求</button></div>'}
                    </div>
                </div>
                

            </div>
        `;
        
        // 关闭其他弹窗，确保个人资料弹窗显示在最上层
        closePublishModal();
        closeLoginModal();
        
        document.getElementById('detail-modal').classList.add('active');
    } catch (error) {
        console.error('showProfileModal 出错:', error);
    }
}

// 编辑资料
function editProfile() {
    document.getElementById('detail-title').textContent = '编辑个人资料';
    const content = document.getElementById('detail-content');
    
    content.innerHTML = `
        <div class="edit-profile-form-v2">
            <!-- 顶部装饰 -->
            <div class="edit-profile-header">
                <div class="edit-profile-avatar">
                    <img src="${currentUser.avatar || getAvatar(currentUser.username)}" alt="${currentUser.nickname || currentUser.username}">
                    <div class="avatar-glow"></div>
                </div>
                <h2 class="edit-profile-title">个性化您的资料</h2>
                <p class="edit-profile-subtitle">让其他用户更好地了解您</p>
            </div>
            
            <!-- 表单内容 -->
            <div class="edit-profile-card">
                <div class="form-group-v2">
                    <label class="form-label-v2">
                        <span class="label-icon">📝</span>
                        个人简介
                    </label>
                    <textarea id="edit-bio" class="form-input-v2" rows="4" placeholder="分享您的故事、兴趣或专长...">${currentUser.bio || ''}</textarea>
                    <div class="form-progress">
                        <span id="bio-count">${(currentUser.bio || '').length}</span>/200
                    </div>
                </div>
                
                <div class="form-group-v2">
                    <label class="form-label-v2">
                        <span class="label-icon">🎯</span>
                        技能标签
                    </label>
                    <input type="text" id="edit-skills" class="form-input-v2" placeholder="例如：编程,设计,摄影,写作" value="${currentUser.skills ? currentUser.skills.join(',') : ''}">
                    <div class="form-hint-v2">多个技能请用逗号分隔</div>
                </div>
                
                <!-- 预览技能标签 -->
                <div class="form-group-v2">
                    <label class="form-label-v2">
                        <span class="label-icon">👁️</span>
                        技能预览
                    </label>
                    <div class="skills-preview" id="skills-preview">
                        ${currentUser.skills && currentUser.skills.length > 0 ? currentUser.skills.map(skill => `
                            <span class="skill-tag-preview">${skill}</span>
                        `).join('') : '<span class="no-skills">暂无技能标签</span>'}
                    </div>
                </div>
                
                <div class="form-actions-v2">
                    <button class="btn btn-secondary-v2" onclick="closeDetailModal()">
                        <span class="btn-icon">✕</span>
                        取消
                    </button>
                    <button class="btn btn-primary-v2" onclick="saveProfileChanges()">
                        <span class="btn-icon">💾</span>
                        保存更改
                    </button>
                </div>
                
                <!-- 收款码设置 -->
                <div class="form-group-v2" style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px dashed var(--gray-200);">
                    <label class="form-label-v2">
                        <span class="label-icon">💰</span>
                        收款码设置
                    </label>
                    <p style="font-size: 0.875rem; color: var(--gray-600); margin-bottom: 0.75rem;">
                        上传您的微信/支付宝收款码，方便他人支付报酬给您
                    </p>
                    <div id="payment-qr-preview" style="margin-bottom: 0.75rem;">
                        ${currentUser.payment_qr_code ? `
                            <div style="position: relative; display: inline-block;">
                                <img src="${currentUser.payment_qr_code}" style="max-width: 150px; border-radius: 8px; border: 2px solid var(--gray-200);">
                                <button onclick="deletePaymentQR()" style="position: absolute; top: -8px; right: -8px; width: 24px; height: 24px; border-radius: 50%; background: #ef4444; color: white; border: none; cursor: pointer; font-size: 14px;">×</button>
                            </div>
                            <p style="font-size: 0.75rem; color: #059669;">✓ 已设置${currentUser.payment_qr_type === 'wechat' ? '微信' : '支付宝'}收款码</p>
                        ` : `
                            <div style="padding: 1rem; border: 2px dashed var(--gray-300); border-radius: 8px; text-align: center; color: var(--gray-500);">
                                尚未设置收款码
                            </div>
                        `}
                    </div>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <label class="btn btn-outline" style="cursor: pointer;">
                            📷 上传微信收款码
                            <input type="file" accept="image/*" onchange="uploadPaymentQR(this, 'wechat')" style="display: none;">
                        </label>
                        <label class="btn btn-outline" style="cursor: pointer;">
                            💳 上传支付宝收款码
                            <input type="file" accept="image/*" onchange="uploadPaymentQR(this, 'alipay')" style="display: none;">
                        </label>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // 添加技能输入实时预览
    const skillsInput = document.getElementById('edit-skills');
    const skillsPreview = document.getElementById('skills-preview');
    
    if (skillsInput && skillsPreview) {
        skillsInput.addEventListener('input', function() {
            const skills = this.value.split(',').map(s => s.trim()).filter(s => s);
            if (skills.length > 0) {
                skillsPreview.innerHTML = skills.map(skill => `
                    <span class="skill-tag-preview">${skill}</span>
                `).join('');
            } else {
                skillsPreview.innerHTML = '<span class="no-skills">暂无技能标签</span>';
            }
        });
    }
    
    // 添加个人简介字数统计
    const bioTextarea = document.getElementById('edit-bio');
    const bioCount = document.getElementById('bio-count');
    
    if (bioTextarea && bioCount) {
        bioTextarea.addEventListener('input', function() {
            const length = this.value.length;
            bioCount.textContent = length;
            
            // 限制最大长度
            if (length > 200) {
                this.value = this.value.substring(0, 200);
                bioCount.textContent = 200;
            }
        });
    }
    
    document.getElementById('detail-modal').classList.add('active');
}

function saveProfileChanges() {
    const newBio = document.getElementById('edit-bio').value;
    const newSkills = document.getElementById('edit-skills').value;
    
    const skills = newSkills.split(',').map(s => s.trim()).filter(s => s);
    
    window.mockAPI.updateUser(currentUser.id, { bio: newBio, skills });
    currentUser.bio = newBio;
    currentUser.skills = skills;
    
    closeDetailModal();
    showProfileModal();
}

// 上传收款码
async function uploadPaymentQR(input, type) {
    const file = input.files[0];
    if (!file) return;
    
    if (!currentUser) {
        showToast('请先登录', 'warning');
        return;
    }
    
    const formData = new FormData();
    formData.append('qr_code', file);
    formData.append('type', type);
    
    try {
        const response = await fetch(CONFIG.API_BASE_URL + '/users/payment_qr', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken || localStorage.getItem('auth_token')}`
            },
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            currentUser.payment_qr_code = result.data.full_url;
            currentUser.payment_qr_type = result.data.qr_type;
            showToast('收款码上传成功', 'success');
            showProfileModal();
        } else {
            showToast(result.message || '上传失败', 'error');
        }
    } catch (error) {
        console.error('上传收款码失败:', error);
        showToast('上传失败', 'error');
    }
    
    input.value = '';
}

// 删除收款码
async function deletePaymentQR() {
    if (!currentUser) {
        showToast('请先登录', 'warning');
        return;
    }

    const confirmed = await showConfirmDialog({
        title: '删除收款码',
        message: '确定要删除收款码吗？删除后将无法恢复。',
        icon: '🗑️',
        confirmText: '确定删除',
        cancelText: '保留',
        danger: true
    });

    if (!confirmed) return;

    try {
        const response = await fetch(CONFIG.API_BASE_URL + '/users/payment_qr', {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken || localStorage.getItem('auth_token')}`
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            currentUser.payment_qr_code = null;
            currentUser.payment_qr_type = null;
            showToast('收款码已删除', 'success');
            showProfileModal();
        } else {
            showToast(result.message || '删除失败', 'error');
        }
    } catch (error) {
        console.error('删除收款码失败:', error);
        showToast('删除失败', 'error');
    }
}

// 显示通知
function showNotifications() {
    try {
        console.log('showNotifications called, currentUser:', currentUser);
        // 检查用户是否登录
        if (!currentUser) {
            console.log('User not logged in, showing login modal');
            closePublishModal();
            closeDetailModal();
            showLoginModal();
            return;
        }

        const result = window.mockAPI.getNotifications(currentUser.id);
        console.log('getNotifications result:', result);
        if (!result.success) {
            console.error('获取通知失败:', result.message);
            showToast('获取通知失败，请稍后重试', 'error');
            return;
        }

        const notifications = result.data || [];
        console.log('notifications:', notifications);

        const detailTitle = document.getElementById('detail-title');
        const content = document.getElementById('detail-content');
        const detailModal = document.getElementById('detail-modal');
        
        console.log('detail-title element:', detailTitle);
        console.log('detail-content element:', content);
        console.log('detail-modal element:', detailModal);

        if (detailTitle) detailTitle.textContent = '消息通知';

        if (content) {
            content.innerHTML = `
                <div class="notifications-list">
                    ${notifications.length > 0 ? notifications.map(n => `
                        <div class="notification-item ${n.is_read ? 'read' : 'unread'}" onclick="markNotificationRead(${n.id})">
                            <div class="notification-icon">
                                ${n.type === 'help_request' ? '🤝' : n.type === 'message' ? '💬' : '📢'}
                            </div>
                            <div class="notification-content">
                                <h4>${n.title}</h4>
                                <p>${n.content}</p>
                                <span class="notification-time">${formatTime(n.created_at)}</span>
                            </div>
                            ${!n.is_read ? '<span class="unread-dot"></span>' : ''}
                        </div>
                    `).join('') : '<p style="text-align: center; color: var(--gray-500); padding: 2rem;">暂无通知</p>'}
                </div>
            `;
        }

        // 关闭其他弹窗，确保通知弹窗显示在最上层
        closePublishModal();
        closeLoginModal();

        if (detailModal) {
            // 将弹窗移动到 body 最后，确保在 DOM 树最上层，避免被 mobile-tab-bar 等元素覆盖
            document.body.appendChild(detailModal);
            detailModal.classList.add('active');
            console.log('detail-modal moved to body end and active class added');
        } else {
            console.error('detail-modal element not found');
        }
        
        // 标记所有为已读
        notifications.filter(n => !n.is_read).forEach(n => {
            window.mockAPI.markNotificationRead(n.id);
        });
        unreadCount = 0;
        updateNotificationBadge();
    } catch (error) {
        console.error('showNotifications 出错:', error);
    }
}

// 标记通知已读
function markNotificationRead(notificationId) {
    window.mockAPI.markNotificationRead(notificationId);
}

// 搜索需求
function searchRequests(keyword) {
    if (!keyword.trim()) {
        loadRequests();
        return;
    }
    
    const result = window.mockAPI.getRequests({ search: keyword });
    if (result.success) {
        allRequests = result.data;
        renderRequests(allRequests);
        
        if (allRequests.length === 0) {
            showEmptyState(keyword);
        }
    }
}

function showEmptyState(keyword) {
    const grid = document.getElementById('requests-grid');
    if (!grid) return;
    
    grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 4rem 2rem;">
            <div style="font-size: 64px; margin-bottom: 16px;">🔍</div>
            <h3 style="margin: 0 0 8px; color: #374151;">未找到"${keyword}"相关需求</h3>
            <p style="color: #6b7280; margin: 0 0 24px;">试试这些热门分类：</p>
            <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: center;">
                <button onclick="filterByCategory('快递代取')" style="padding: 8px 16px; background: #e5e7eb; border: none; border-radius: 20px; cursor: pointer;">快递代取</button>
                <button onclick="filterByCategory('排队代排')" style="padding: 8px 16px; background: #e5e7eb; border: none; border-radius: 20px; cursor: pointer;">排队代排</button>
                <button onclick="filterByCategory('代驾送车')" style="padding: 8px 16px; background: #e5e7eb; border: none; border-radius: 20px; cursor: pointer;">代驾送车</button>
                <button onclick="filterByCategory('陪护陪伴')" style="padding: 8px 16px; background: #e5e7eb; border: none; border-radius: 20px; cursor: pointer;">陪护陪伴</button>
            </div>
            <button onclick="showPublishModal()" style="margin-top: 24px; padding: 12px 24px; background: #22c55e; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px;">发布需求</button>
        </div>
    `;
}

function filterByCategory(category) {
    document.getElementById('search-input').value = category;
    loadRequests({ category });
}

// 显示附近需求
async function showNearbyRequests() {
    if (!navigator.geolocation) {
        showToast('您的浏览器不支持地理定位', 'warning');
        return;
    }
    
    showToast('正在获取附近需求...', 'info');
    
    // 获取当前位置
    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            // 保存当前位置到全局变量
            currentPosition = { lat, lng };
            
            try {
                // 调用后端真实API获取附近需求
                const userId = currentUser ? currentUser.id : 1;
                const response = await fetch(`${CONFIG.API_BASE_URL}/requests?user_id=${userId}&status=pending`);
                
                if (!response.ok) {
                    throw new Error('获取附近需求失败');
                }
                
                const result = await response.json();
                
                if (result.success) {
                    // 计算每个需求的距离并排序
                    allRequests = result.data.map(req => {
                        if (req.lat && req.lng) {
                            req.distance = calculateDistance(lat, lng, parseFloat(req.lat), parseFloat(req.lng));
                        } else {
                            req.distance = null;
                        }
                        return req;
                    }).sort((a, b) => {
                        // 优先按距离排序（近到远）
                        if (a.distance !== null && b.distance !== null) {
                            return a.distance - b.distance;
                        }
                        if (a.distance !== null) return -1;
                        if (b.distance !== null) return 1;
                        // 无距离的按时间排序
                        return new Date(b.created_at) - new Date(a.created_at);
                    });
                    
                    // 重置到第一页
                    requestsPage = 1;
                    
                    // 渲染需求列表
                    renderRequests(allRequests);
                    
                    // 显示提示
                    const nearbyCount = allRequests.filter(r => r.distance !== null && r.distance <= 50).length;
                    if (nearbyCount > 0) {
                        showToast(`找到${nearbyCount}个附近的需求，已按距离排序`, 'success');
                    } else if (allRequests.length > 0) {
                        showToast(`找到${allRequests.length}个需求（附近暂无，显示全部）`, 'info');
                    } else {
                        showToast('附近暂无需求', 'info');
                    }
                } else {
                    showToast(result.message || '获取附近需求失败', 'error');
                }
            } catch (error) {
                console.error('获取附近需求失败:', error);
                showToast('获取附近需求失败，请检查网络连接', 'error');
            }
        },
        (error) => {
            console.error('获取位置失败:', error);
            showToast('无法获取您的位置，请检查定位权限设置', 'error');
        },
        {
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 300000
        }
    );
}

// 滚动到需求列表
function scrollToRequests() {
    const requestsSection = document.getElementById('requests');
    if (requestsSection) {
        requestsSection.scrollIntoView({ behavior: 'smooth' });
    } else {
        // 如果需求列表部分不存在，重定向到需求大厅页面
        window.location.href = 'requests.html';
    }
}

// 处理导航链接点击
function handleNavClick(event) {
    const target = event.target;
    const href = target.getAttribute('href');
    
    if (href) {
        // 检查是否是页面内跳转
        if (href.startsWith('#')) {
            event.preventDefault();
            
            // 隐藏管理员界面
            const adminSection = document.getElementById('admin');
            if (adminSection) {
                adminSection.style.display = 'none';
            }
            
            // 恢复所有section的默认显示状态（移除内联样式）
            document.querySelectorAll('section').forEach(section => {
                if (section.id !== 'admin') {
                    section.style.display = '';
                }
            });
            
            // 处理滚动
            if (href === '#requests') {
                // 滚动到需求大厅
                const requestsSection = document.getElementById('requests');
                if (requestsSection) {
                    requestsSection.scrollIntoView({ behavior: 'smooth' });
                }
            } else if (href === '#users') {
                // 滚动到热心用户
                const usersSection = document.getElementById('users');
                if (usersSection) {
                    usersSection.scrollIntoView({ behavior: 'smooth' });
                }
            } else if (href === '#about') {
                // 滚动到页面底部
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            } else {
                // 滚动到顶部（首页）
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
            
            // 更新导航链接状态
            document.querySelectorAll('.nav-menu a').forEach(link => {
                link.classList.remove('active');
            });
            target.classList.add('active');
        } else {
            // 页面跳转，不阻止默认行为
            // 更新导航链接状态
            document.querySelectorAll('.nav-menu a').forEach(link => {
                link.classList.remove('active');
            });
            target.classList.add('active');
        }
    }
}

// 点击弹窗外部关闭
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
}

// ==================== WebSocket 实时通信 ====================

// 初始化 WebSocket 连接
function initWebSocket() {
    if (!currentUser) return;
    
    try {
        // 暂时禁用WebSocket连接，避免400错误
        console.log('WebSocket 连接已暂时禁用');
        wsConnection = null;
        wsConnected = false;
    } catch (error) {
        console.error('WebSocket 初始化失败:', error);
    }
}

// 处理 WebSocket 消息
function handleWebSocketMessage(data) {
    switch (data.type) {
        case 'new_request':
            // 新需求通知
            showNotification('新需求', `有新的${data.category}需求发布`);
            loadRequests();
            break;
            
        case 'request_accepted':
            // 需求被接受
            showNotification('需求更新', '您的需求已被接受');
            loadRequests();
            break;
            
        case 'request_completed':
            // 需求完成
            showNotification('需求完成', '需求已完成，请评价');
            loadRequests();
            break;
            
        case 'new_message':
            // 新消息
            unreadCount++;
            updateUnreadBadge();
            showNotification('新消息', data.message);
            break;
            
        case 'notification':
            // 系统通知
            showNotification(data.title, data.message);
            break;
            
        default:
            console.log('未知消息类型:', data.type);
    }
}

// WebSocket 重连
function attemptReconnect() {
    // 暂时禁用WebSocket重连，避免不断尝试连接
    console.log('WebSocket 重连已暂时禁用');
}

// 发送 WebSocket 消息
function sendWebSocketMessage(type, data) {
    if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
        wsConnection.send(JSON.stringify({
            type,
            ...data,
            timestamp: Date.now()
        }));
        return true;
    }
    return false;
}

// 关闭 WebSocket 连接
function closeWebSocket() {
    if (wsConnection) {
        wsConnection.close();
        wsConnection = null;
    }
}

// 显示浏览器通知
function showNotification(title, body) {
    // 检查浏览器通知权限
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
            body,
            icon: '/images/icon-192x192.png'
        });
    }
}

// 更新未读消息角标
function updateUnreadBadge() {
    const badge = document.querySelector('.notification-badge');
    if (badge) {
        badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        badge.style.display = unreadCount > 0 ? 'block' : 'none';
    }
}

// 请求通知权限
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

// ==================== 内存管理优化 ====================

// 清理过期缓存
function cleanupExpiredCache() {
    const now = Date.now();
    for (const [key, item] of CacheManager.cache) {
        if (now > item.expiry) {
            CacheManager.cache.delete(key);
        }
    }
}

// 定期清理内存
setInterval(() => {
    cleanupExpiredCache();
}, 60000); // 每分钟清理一次

// 页面卸载时清理资源
window.addEventListener('beforeunload', () => {
    closeWebSocket();
    CacheManager.clear();
});

// ==================== 数据预加载 ====================

// 预加载关键数据
async function preloadCriticalData() {
    try {
        // 预加载分类数据
        const categoriesResult = await window.mockAPI.getCategories();
        if (categoriesResult.success) {
            CacheManager.set('categories', categoriesResult.data);
        }
        
        console.log('关键数据预加载完成');
    } catch (error) {
        console.error('预加载失败:', error);
    }
}

// 预加载下一页数据
function preloadNextPage() {
    // 可以在这里实现分页数据的预加载
    console.log('预加载下一页数据...');
}

// ==================== 错误边界处理 ====================

// 离线检测
let isOffline = false;
window.addEventListener('online', () => {
    if (isOffline) {
        showToast('网络已恢复', 'success');
        isOffline = false;
    }
});
window.addEventListener('offline', () => {
    isOffline = true;
    showToast('网络已断开，请检查网络连接', 'warning');
});

// 全局错误处理
window.onerror = function(message, source, lineno, colno, error) {
    console.error('全局错误:', { message, source, lineno, colno, error });
    return true;
};

// 未处理的 Promise 错误
window.addEventListener('unhandledrejection', (event) => {
    console.error('未处理的 Promise 错误:', event.reason);
});

// 统一API错误处理
async function apiFetch(url, options = {}) {
    if (!navigator.onLine) {
        showToast('网络已断开', 'warning');
        throw new Error('网络已断开');
    }
    
    const token = authToken || localStorage.getItem('auth_token');
    const headers = {
        ...options.headers,
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }
    
    try {
        const response = await fetch(url, { ...options, headers });
        const data = await response.json();
        
        if (!response.ok || !data.success) {
            const msg = data.message || '请求失败';
            if (response.status === 401) {
                showToast('登录已过期，请重新登录', 'warning');
                setTimeout(() => { logout(); }, 1500);
            } else if (response.status === 403) {
                showToast(msg, 'warning');
            } else if (response.status >= 500) {
                showToast('服务器错误，请稍后重试', 'error');
            } else {
                showToast(msg, 'error');
            }
            throw new Error(msg);
        }
        
        return data;
    } catch (error) {
        if (error.message === '网络已断开') throw error;
        console.error('API请求错误:', error);
        throw error;
    }
}

// ==================== 初始化 ====================

// 下拉刷新
function initPullRefresh() {
    const grid = document.getElementById('requests-grid');
    if (!grid) return;
    
    let startY = 0;
    let isRefreshing = false;
    
    document.addEventListener('touchstart', (e) => {
        if (window.scrollY === 0 && !isRefreshing) {
            startY = e.touches[0].clientY;
        }
    }, { passive: true });
    
    document.addEventListener('touchmove', (e) => {
        if (window.scrollY === 0 && !isRefreshing) {
            const currentY = e.touches[0].clientY;
            const diff = currentY - startY;
            if (diff > 100) {
                isRefreshing = true;
                showToast('正在刷新...', 'info');
                loadRequests().then(() => {
                    isRefreshing = false;
                    showToast('刷新成功', 'success');
                });
            }
        }
    }, { passive: true });
}

// 注册 Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('Service Worker 注册成功:', registration.scope);
            })
            .catch((error) => {
                console.log('Service Worker 注册失败:', error);
            });
    });
}

// ==================== 暗黑模式 ====================

// 初始化暗黑模式
function initDarkMode() {
    // 检查本地存储或系统偏好
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
}

// 切换暗黑模式
function toggleDarkMode() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // 更新按钮图标
    updateThemeIcon(newTheme);
}

// 切换用户菜单下拉
function toggleUserMenu() {
    console.log('toggleUserMenu called');
    const dropdown = document.getElementById('user-dropdown');
    console.log('dropdown element:', dropdown);
    if (dropdown) {
        dropdown.classList.toggle('show');
        console.log('dropdown classList after toggle:', dropdown.classList);
    }
}

// 点击其他地方关闭用户菜单
document.addEventListener('click', function(event) {
    const userMenu = document.querySelector('.user-menu');
    const dropdown = document.getElementById('user-dropdown');
    if (userMenu && dropdown && !userMenu.contains(event.target)) {
        dropdown.classList.remove('show');
    }
});

// ==================== 文本域计数器 ====================

// 初始化文本域计数器
function initTextareaCounters() {
    // 详细描述文本域
    const descriptionTextarea = document.querySelector('textarea[name="description"]');
    const descriptionCounter = document.getElementById('description-counter');
    
    if (descriptionTextarea && descriptionCounter) {
        // 初始更新
        updateTextareaCounter(descriptionTextarea, descriptionCounter, 1000);
        
        // 添加输入事件监听
        descriptionTextarea.addEventListener('input', function() {
            updateTextareaCounter(this, descriptionCounter, 1000);
        });
    }
}

// 更新文本域计数器
function updateTextareaCounter(textarea, counter, maxLength) {
    const currentLength = textarea.value.length;
    const remainingLength = maxLength - currentLength;
    
    counter.textContent = `${currentLength}/${maxLength}`;
    
    // 根据剩余长度改变颜色
    if (remainingLength < 0) {
        counter.style.color = '#ef4444'; // 红色
        counter.style.fontWeight = 'bold';
    } else if (remainingLength < 100) {
        counter.style.color = '#f59e0b'; // 橙色
        counter.style.fontWeight = 'normal';
    } else {
        counter.style.color = '#6b7280'; // 灰色
        counter.style.fontWeight = 'normal';
    }
}

// 限制文本域输入长度
function limitTextareaLength(textarea, maxLength) {
    if (textarea.value.length > maxLength) {
        textarea.value = textarea.value.substring(0, maxLength);
    }
}

// 更新主题图标
function updateThemeIcon(theme) {
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
        themeBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
}

// 监听系统主题变化
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
        const newTheme = e.matches ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        updateThemeIcon(newTheme);
    }
});

// ==================== 埋点统计 ====================

// 管理员界面相关函数
let currentPage = 1;
let currentSearch = '';

// 显示管理员界面
function showAdminPanel() {
    if (!currentUser || currentUser.username !== 'admin') {
        showToast('权限不足', 'error');
        return;
    }
    
    // 检查当前页面是否为 index.html
    if (!window.location.pathname.endsWith('index.html') && window.location.pathname !== '/') {
        // 如果不在首页，重定向到首页并在 URL 中添加参数
        window.location.href = 'index.html?showAdmin=true';
        return;
    }
    
    // 隐藏其他所有部分
    document.querySelectorAll('section').forEach(section => {
        if (section) {
            section.style.display = 'none';
        }
    });
    
    // 显示管理员界面
    const adminSection = document.getElementById('admin');
    if (adminSection) {
        adminSection.style.display = 'block';
        // 加载用户列表
        loadUsers();
    } else {
        showToast('管理员界面不存在', 'error');
    }
}

// 退出管理员界面
function exitAdminPanel() {
    // 隐藏管理员界面
    const adminSection = document.getElementById('admin');
    if (adminSection) {
        adminSection.style.display = 'none';
    }
    
    // 显示其他所有部分
    document.querySelectorAll('section').forEach(section => {
        if (section && section.id !== 'admin') {
            section.style.display = '';
        }
    });
    
    // 移除URL参数
    if (window.history.replaceState) {
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    showToast('已退出管理员界面', 'success');
}

// 加载用户列表（管理员专用）
async function loadUsers(page = 1, search = '') {
    currentPage = page;
    currentSearch = search;
    
    // 获取令牌
    const token = authToken || localStorage.getItem('auth_token');
    if (!token) {
        console.log('未登录，跳过加载用户列表');
        renderUserTable([]);
        renderPagination(1, 1);
        return;
    }
    
    try {
        // 构建查询参数
        const params = new URLSearchParams();
        params.append('page', page);
        params.append('limit', 10);
        if (search) {
            params.append('search', search);
        }
        
        console.log('使用令牌:', token);
        
        const response = await fetch(`${CONFIG.API_BASE_URL}/admin/users?${params}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (result.success && result.data) {
            renderUserTable(result.data.users || []);
            renderPagination(result.data.page || 1, result.data.total_pages || 1);
        } else {
            const errorMsg = result.message || result.msg || result.error || '未知错误';
            console.error('API 返回错误:', errorMsg, result);
            renderUserTable([]);
            renderPagination(1, 1);
        }
    } catch (error) {
        console.error('加载用户列表失败:', error);
        renderUserTable([]);
        renderPagination(1, 1);
    }
}

// 渲染用户表格
function renderUserTable(users) {
    const tableBody = document.getElementById('user-table-body');
    if (!tableBody) return; // 如果元素不存在，直接返回
    
    if (!users || users.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 2rem;">暂无用户数据</td></tr>';
        return;
    }
    
    tableBody.innerHTML = users.map(user => `
        <tr>
            <td>${user.id || ''}</td>
            <td><img src="${user.avatar || getAvatar('guest')}" alt="用户头像" class="avatar"></td>
            <td>${user.username || ''}</td>
            <td>${user.email || '-'}</td>
            <td>${user.location || '-'}</td>
            <td>${user.created_at || ''}</td>
            <td>${user.rating || 0}</td>
            <td>${user.help_count || 0}</td>
            <td>${user.request_count || 0}</td>
        </tr>
    `).join('');
}

// 渲染分页控件
function renderPagination(currentPage, totalPages) {
    const pagination = document.getElementById('user-pagination');
    if (!pagination) return; // 如果元素不存在，直接返回
    
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }
    
    let paginationHTML = '';
    
    // 上一页按钮
    paginationHTML += `<button onclick="loadUsers(${currentPage - 1}, '${currentSearch}')" ${currentPage === 1 ? 'disabled' : ''}>&laquo;</button>`;
    
    // 页码按钮
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, startPage + 4);
    
    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `<button onclick="loadUsers(${i}, '${currentSearch}')" ${i === currentPage ? 'class="active"' : ''}>${i}</button>`;
    }
    
    // 下一页按钮
    paginationHTML += `<button onclick="loadUsers(${currentPage + 1}, '${currentSearch}')" ${currentPage === totalPages ? 'disabled' : ''}>&raquo;</button>`;
    
    pagination.innerHTML = paginationHTML;
}

// 搜索用户
function searchUsers() {
    const searchTerm = document.getElementById('user-search').value;
    loadUsers(1, searchTerm);
}

// 埋点统计
const Analytics = {
    // 发送事件
    track(eventName, properties = {}) {
        const event = {
            name: eventName,
            properties: {
                ...properties,
                timestamp: Date.now(),
                url: window.location.href,
                userAgent: navigator.userAgent
            }
        };
        
        // 存储到本地，稍后批量发送
        this.storeEvent(event);
        
        // 开发环境打印日志
        if (location.hostname === 'localhost') {
            console.log('📊 埋点:', event);
        }
    },
    
    // 存储事件
    storeEvent(event) {
        const events = JSON.parse(localStorage.getItem('analytics_events') || '[]');
        events.push(event);
        
        // 最多保留100条
        if (events.length > 100) {
            events.shift();
        }
        
        localStorage.setItem('analytics_events', JSON.stringify(events));
    },
    
    // 页面浏览
    pageView(pageName) {
        this.track('page_view', { page: pageName });
    },
    
    // 点击事件
    click(elementName, properties = {}) {
        this.track('click', { element: elementName, ...properties });
    },
    
    // 性能指标
    performance(metricName, value) {
        this.track('performance', { metric: metricName, value });
    }
};

// 自动追踪页面浏览
function trackPageViews() {
    // 追踪初始页面
    Analytics.pageView('home');
    
    // 监听锚点变化
    window.addEventListener('hashchange', () => {
        const page = window.location.hash.slice(1) || 'home';
        Analytics.pageView(page);
    });
}

// 自动追踪点击事件
document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-track]');
    if (target) {
        const eventName = target.dataset.track;
        const properties = {};
        
        // 收集额外的追踪属性
        if (target.dataset.trackCategory) {
            properties.category = target.dataset.trackCategory;
        }
        if (target.dataset.trackLabel) {
            properties.label = target.dataset.trackLabel;
        }
        
        Analytics.click(eventName, properties);
    }
});

// 性能监控
function initPerformanceTracking() {
    // 页面加载时间
    window.addEventListener('load', () => {
        setTimeout(() => {
            const perfData = performance.timing;
            const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
            Analytics.performance('page_load_time', pageLoadTime);
        }, 0);
    });
    
    // 首次内容绘制
    new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
            if (entry.name === 'first-contentful-paint') {
                Analytics.performance('fcp', entry.startTime);
            }
        }
    }).observe({ entryTypes: ['paint'] });
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    // 初始化暗黑模式
    initDarkMode();
    
    // 初始化图片懒加载
    lazyLoadImages();
    
    // 初始化下拉刷新
    initPullRefresh();
    
    // 监听滚动事件，使用节流优化
    window.addEventListener('scroll', throttle(() => {
        lazyLoadImages();
    }, 200));
    
    // 预加载关键数据
    preloadCriticalData();
    
    // 请求通知权限
    requestNotificationPermission();
    
    // 初始化通知徽章（确保未登录时徽章也能正确隐藏）
    if (!currentUser) {
        unreadCount = 0;
        updateNotificationBadge();
        updateUnreadBadge();
    }
    
    // 初始化 WebSocket（如果已登录）
    if (currentUser) {
        initWebSocket();
    }
    
    // 检查是否需要显示管理员界面
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('showAdmin') === 'true' && currentUser && currentUser.username === 'admin') {
        showAdminPanel();
    }
    
    // 检查是否需要显示登录弹窗 - 直接检查 localStorage
    const storedToken = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('current_user');
    if (urlParams.get('showLogin') === 'true' && (!storedToken || !storedUser)) {
        showLoginModal();
    }
    
    // 检查是否需要显示注册弹窗
    if (urlParams.get('showModal') === 'register' && (!storedToken || !storedUser)) {
        showRegisterModal();
    }
    
    // 检查是否需要显示忘记密码弹窗
    if (urlParams.get('showForgot') === 'true') {
        showForgotModal();
    }
    
    // 初始化埋点统计
    trackPageViews();
    initPerformanceTracking();
    
    console.log('我来帮 - 应用初始化完成');
});

// ==================== 移动端交互功能 ====================

/**
 * 切换移动端侧边栏
 */
function toggleMobileSidebar() {
    console.log('toggleMobileSidebar called');
    const sidebar = document.getElementById('mobile-sidebar');
    console.log('sidebar element:', sidebar);
    if (sidebar) {
        sidebar.classList.toggle('active');
        console.log('sidebar active class toggled, new state:', sidebar.classList.contains('active'));
        // 更新侧边栏用户信息
        updateMobileSidebarUserInfo();
    } else {
        console.error('mobile-sidebar element not found');
    }
}

/**
 * 关闭移动端侧边栏
 */
function closeMobileSidebar() {
    const sidebar = document.getElementById('mobile-sidebar');
    if (sidebar) {
        sidebar.classList.remove('active');
    }
}

/**
 * 更新移动端侧边栏用户信息
 */
function updateMobileSidebarUserInfo() {
    const mobileUserName = document.getElementById('mobile-user-name');
    const mobileUserStatus = document.getElementById('mobile-user-status');
    const mobileLoginBtn = document.getElementById('mobile-login-btn');
    const mobileLogoutBtn = document.getElementById('mobile-logout-btn');
    const mobileAdminItems = document.querySelectorAll('.mobile-sidebar-menu .admin-only');
    
    if (currentUser) {
        // 已登录状态
        if (mobileUserName) {
            mobileUserName.textContent = currentUser.nickname || currentUser.username || '用户';
        }
        if (mobileUserStatus) {
            mobileUserStatus.textContent = currentUser.location || '已登录';
        }
        if (mobileLoginBtn) {
            mobileLoginBtn.style.display = 'none';
        }
        if (mobileLogoutBtn) {
            mobileLogoutBtn.style.display = 'flex';
        }
        
        // 显示/隐藏管理员入口
        const isAdmin = currentUser.username === 'admin';
        mobileAdminItems.forEach(item => {
            item.style.display = isAdmin ? 'flex' : 'none';
        });
    } else {
        // 未登录状态
        if (mobileUserName) {
            mobileUserName.textContent = '未登录';
        }
        if (mobileUserStatus) {
            mobileUserStatus.textContent = '点击登录';
        }
        if (mobileLoginBtn) {
            mobileLoginBtn.style.display = 'flex';
        }
        if (mobileLogoutBtn) {
            mobileLogoutBtn.style.display = 'none';
        }
        mobileAdminItems.forEach(item => {
            item.style.display = 'none';
        });
    }
}

/**
 * 切换移动端菜单
 */
function toggleMobileMenu(event) {
    // 阻止事件冒泡，防止触发document的点击事件
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    toggleMobileSidebar();
}

/**
 * 更新底部导航栏激活状态
 */
function updateMobileBottomNav() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const navItems = document.querySelectorAll('.mobile-bottom-nav .nav-item[data-page]');
    
    navItems.forEach(item => {
        const itemPage = item.getAttribute('data-page');
        if (currentPage.includes('index') && itemPage === 'home') {
            item.classList.add('active');
        } else if (currentPage.includes('requests') && itemPage === 'requests') {
            item.classList.add('active');
        } else if (currentPage.includes('history') && itemPage === 'history') {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

// 在页面加载完成后初始化移动端功能
document.addEventListener('DOMContentLoaded', () => {
    // 初始化移动端底部导航
    updateMobileBottomNav();
    
    // 初始化移动端侧边栏用户信息
    updateMobileSidebarUserInfo();
    
    // 点击页面其他地方关闭侧边栏
    document.addEventListener('click', (e) => {
        const sidebar = document.getElementById('mobile-sidebar');
        const menuToggle = document.querySelector('.mobile-menu-toggle');
        
        if (sidebar && sidebar.classList.contains('active')) {
            // 检查点击是否在侧边栏外部且不是菜单按钮
            const isClickInsideSidebar = sidebar.contains(e.target);
            const isClickOnMenuToggle = menuToggle && (menuToggle === e.target || menuToggle.contains(e.target));
            
            if (!isClickInsideSidebar && !isClickOnMenuToggle) {
                closeMobileSidebar();
            }
        }
    });
    
    // 监听窗口大小变化，在桌面端关闭移动端菜单
    window.addEventListener('resize', debounce(() => {
        if (window.innerWidth > 768) {
            closeMobileSidebar();
        }
    }, 200));
});

// 重写updateNavbar函数以包含移动端更新
const originalUpdateNavbar = updateNavbar;
updateNavbar = function() {
    // 调用原函数
    originalUpdateNavbar();
    
    // 更新移动端侧边栏
    updateMobileSidebarUserInfo();
    
    // 更新移动端问候语
    updateMobileGreeting();
};

// ==================== 移动端首页新功能 ====================

// 根据时间获取问候语和表情
function getGreetingByTime() {
    const hour = new Date().getHours();
    if (hour < 6) return { text: '夜深了', emoji: '🌙' };
    if (hour < 9) return { text: '早上好', emoji: '🌅' };
    if (hour < 12) return { text: '上午好', emoji: '☀️' };
    if (hour < 14) return { text: '中午好', emoji: '🌤️' };
    if (hour < 18) return { text: '下午好', emoji: '🌞' };
    if (hour < 22) return { text: '晚上好', emoji: '🌆' };
    return { text: '夜深了', emoji: '🌙' };
}

// 更新移动端问候语
function updateMobileGreeting() {
    const greetingHello = document.querySelector('.greeting-hello');
    const greetingEmoji = document.querySelector('.greeting-emoji');
    
    if (greetingHello && greetingEmoji) {
        const greeting = getGreetingByTime();
        greetingHello.textContent = greeting.text;
        greetingEmoji.textContent = greeting.emoji;
    }
    
    // 更新用户名
    const greetingName = document.querySelector('.greeting-name');
    if (greetingName && currentUser) {
        greetingName.textContent = currentUser.nickname || currentUser.username || '邻居';
    }
}

// 显示附近求助地图
function showHelpMap() {
    if (!currentUser) {
        showToast('请先登录后查看附近求助', 'warning');
        showLoginModal();
        return;
    }
    
    // 获取当前位置并显示地图
    getCurrentLocation().then(position => {
        if (position) {
            showMap(position.lat, position.lng, '我的位置');
        }
    }).catch(error => {
        console.error('获取位置失败:', error);
        // 使用默认位置
        showMap(39.9042, 116.4074, '北京市');
    });
}

// 显示我的任务
function showMyTasks() {
    if (!currentUser) {
        showToast('请先登录后查看我的任务', 'warning');
        showLoginModal();
        return;
    }
    
    // 跳转到需求页面并筛选我的任务
    window.location.href = 'requests.html?filter=my';
}

// 初始化移动端首页功能
function initMobileHome() {
    // 更新问候语
    updateMobileGreeting();
    
    // 每小时更新一次问候语
    setInterval(updateMobileGreeting, 60 * 60 * 1000);
    
    // 添加分类芯片点击事件
    const categoryChips = document.querySelectorAll('.category-chip');
    categoryChips.forEach(chip => {
        chip.addEventListener('click', function() {
            // 移除其他芯片的active状态
            categoryChips.forEach(c => c.classList.remove('active'));
            // 添加当前芯片的active状态
            this.classList.add('active');
            
            // 获取分类文本
            const categoryText = this.querySelector('.chip-text')?.textContent;
            if (categoryText && categoryText !== '全部') {
                // 跳转到需求页面并筛选分类
                window.location.href = `requests.html?category=${encodeURIComponent(categoryText)}`;
            }
        });
    });
    
    // 添加需求卡片点击事件
    const requestCards = document.querySelectorAll('.mobile-request-card');
    requestCards.forEach(card => {
        card.addEventListener('click', function() {
            // 添加点击动画效果
            this.style.transform = 'scale(0.98)';
            setTimeout(() => {
                this.style.transform = '';
            }, 150);
        });
    });
    
    // 添加统计卡片动画
    animateStatCards();
}

// 统计卡片动画
function animateStatCards() {
    const statCards = document.querySelectorAll('.mobile-stat-card');
    statCards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        setTimeout(() => {
            card.style.transition = 'all 0.5s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, index * 100);
    });
}

// ==================== 新版移动端首页功能 ====================

// 根据时间获取问候语
function getGreetingByTime() {
    const hour = new Date().getHours();
    if (hour < 6) return '凌晨好';
    if (hour < 9) return '早上好';
    if (hour < 12) return '上午好';
    if (hour < 14) return '中午好';
    if (hour < 18) return '下午好';
    if (hour < 22) return '晚上好';
    return '夜深了';
}

// 更新移动端首页问候语
function updateMobileHomeGreeting() {
    const greetingEl = document.getElementById('mobile-greeting');
    if (greetingEl) {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const greeting = getGreetingByTime();
        const name = user.name || user.nickname || '邻居';
        greetingEl.textContent = `${greeting}，${name}`;
    }
}

// 更新移动端首页统计数据
function updateMobileHomeStats() {
    const usersEl = document.getElementById('mobile-stat-users');
    const requestsEl = document.getElementById('mobile-stat-requests');
    const completedEl = document.getElementById('mobile-stat-completed');
    
    // 动画数字增长效果
    function animateNumber(element, target, suffix = '') {
        if (!element) return;
        let current = 0;
        const increment = target / 30;
        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                current = target;
                clearInterval(timer);
            }
            element.textContent = Math.floor(current) + suffix;
        }, 30);
    }
    
    // 模拟数据（实际应从API获取）
    animateNumber(usersEl, 1280, '');
    animateNumber(requestsEl, 356, '');
    animateNumber(completedEl, 892, '');
}

// 加载推荐需求到瀑布流
function loadMobileRecommendRequests() {
    const grid = document.getElementById('mobile-recommend-grid');
    if (!grid) return;
    
    // 模拟推荐数据
    const recommends = [
        { icon: '📦', title: '帮忙搬家具到5楼', reward: '200元', location: '朝阳区', urgent: false },
        { icon: '🐾', title: '周末帮忙遛狗2天', reward: '150元', location: '海淀区', urgent: true },
        { icon: '📚', title: '小学数学作业辅导', reward: '100元/时', location: '东城区', urgent: false },
        { icon: '🔧', title: '修理漏水水龙头', reward: '80元', location: '西城区', urgent: false },
        { icon: '🛒', title: '超市代购生活用品', reward: '50元', location: '丰台区', urgent: false },
        { icon: '🚗', title: '拼车去机场', reward: '分摊油费', location: '通州区', urgent: true },
    ];
    
    grid.innerHTML = recommends.map(item => `
        <div class="waterfall-card" onclick="window.location.href='requests.html'">
            <div class="waterfall-card-image ${item.urgent ? 'urgent' : ''}">
                <span>${item.icon}</span>
                ${item.urgent ? '<span class="waterfall-urgent-badge">加急</span>' : ''}
            </div>
            <div class="waterfall-card-content">
                <h4 class="waterfall-card-title">${item.title}</h4>
                <div class="waterfall-card-meta">
                    <span class="waterfall-card-reward">${item.reward}</span>
                    <span class="waterfall-card-location">${item.location}</span>
                </div>
            </div>
        </div>
    `).join('');
}

// 显示常见场景
function showCommonScenes() {
    const scenes = [
        { icon: '⚡', title: '帮我推下电闸', desc: '家里跳闸了，需要有人帮忙推一下电闸', urgent: true, timePreset: 'now', deadlineDays: 1, category: 'urgent', address: '广州市天河区珠江新城花城大道1号小区A栋1201' },
        { icon: '📦', title: '帮我拿个快递', desc: '快递到了，没时间去取，需要帮忙代取', urgent: false, timePreset: '12h', deadlineDays: 2, category: 'normal', address: '广州市天河区天河路208号天河城购物中心西门快递柜' },
        { icon: '🐕', title: '帮我遛遛狗', desc: '临时有事，需要有人帮忙遛狗', urgent: false, timePreset: '12h', deadlineDays: 1, category: 'normal', address: '广州市天河区黄埔大道西平云路163号广电平云广场B塔' },
        { icon: '📱', title: '教老人用下手机', desc: '家里老人不会使用智能手机，需要耐心教学', urgent: false, timePreset: 'week', deadlineDays: 7, category: 'normal', address: '广州市越秀区东风东路753号天誉商务大厦东塔' },
        { icon: '🗑️', title: '顺手帮我扔个垃圾', desc: '行动不便，需要帮忙扔一下垃圾', urgent: true, timePreset: 'now', deadlineDays: 1, category: 'urgent', address: '广州市海珠区新港中路397号TIT创意园西门' },
        { icon: '💊', title: '帮我带盒药', desc: '身体不舒服，需要帮忙买药送药', urgent: true, timePreset: 'now', deadlineDays: 1, category: 'urgent', address: '广州市天河区林和东路281号天誉花园一期3号楼' },
        { icon: '🏥', title: '陪我去趟医院', desc: '需要有人陪同去医院看病', urgent: true, timePreset: 'now', deadlineDays: 1, category: 'urgent', address: '广州市越秀区中山二路58号中山大学附属第一医院' }
    ];
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'commonScenesModal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="closeCommonScenes()"></div>
        <div class="modal-content" style="padding: 20px; max-width: 90%; border-radius: 16px; position: relative; margin: auto; z-index: 1;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="margin: 0; font-size: 18px;">常见场景</h3>
                <button onclick="closeCommonScenes()" style="background: none; border: none; font-size: 24px; cursor: pointer;">&times;</button>
            </div>
            <div style="display: flex; flex-direction: column; gap: 12px;">
                ${scenes.map(scene => `
                    <div onclick="selectCommonScene('${scene.title}', '${scene.desc}', ${scene.urgent}, '${scene.timePreset}', ${scene.deadlineDays}, '${scene.category}', '${scene.address}')" 
                         style="display: flex; align-items: center; padding: 14px; background: #f9fafb; border-radius: 10px; cursor: pointer; transition: background 0.2s;"
                         onmouseover="this.style.background='#f3f4f6'" 
                         onmouseout="this.style.background='#f9fafb'">
                        <span style="font-size: 28px; margin-right: 14px;">${scene.icon}</span>
                        <div style="flex: 1;">
                            <div style="font-weight: 600; font-size: 15px; color: #1f2937; display: flex; align-items: center; gap: 6px;">
                                ${scene.title}
                                ${scene.urgent ? '<span style="background: #ef4444; color: white; font-size: 10px; padding: 2px 6px; border-radius: 4px;">加急</span>' : ''}
                            </div>
                            <div style="font-size: 13px; color: #6b7280; margin-top: 2px;">${scene.desc}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function closeCommonScenes() {
    const modal = document.getElementById('commonScenesModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    }
}

function selectCommonScene(title, desc, urgent = false, timePreset = 'now', deadlineDays = 1, category = 'normal', address = '') {
    const user = JSON.parse(localStorage.getItem('current_user') || '{}');
    if (!user || !user.id) {
        closeCommonScenes();
        showLoginModal();
        return;
    }
    closeCommonScenes();
    
    // 移动端跳转到独立页面（带参数）
    if (window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        // 使用 localStorage 传递数据，避免浏览器自动填充问题
        localStorage.setItem('pendingPublishData', JSON.stringify({ title, desc, urgent, timePreset, deadlineDays, category, address }));
        window.location.href = 'publish.html';
        return;
    }
    
    // 桌面端：保存要填充的内容到全局变量
    console.log('设置 pendingSceneData:', title, desc, urgent, timePreset, deadlineDays, category, address);
    window.pendingSceneData = { title, desc, urgent, timePreset, deadlineDays, category, address };
    console.log('window.pendingSceneData:', window.pendingSceneData);
    
    // 打开弹窗
    showPublishModal();
    
    // 延迟执行填充，确保弹窗已打开
    setTimeout(() => {
        fillSceneForm(title, desc, urgent, timePreset, deadlineDays, category, address);
    }, 200);
}

// 填充场景表单（桌面端）
function fillSceneForm(title, desc, urgent, timePreset, deadlineDays, category, address) {
    const form = document.getElementById('publish-form');
    if (!form) {
        console.log('表单未找到，重试...');
        setTimeout(() => fillSceneForm(title, desc, urgent, timePreset, deadlineDays, category, address), 100);
        return;
    }
    
    console.log('开始填充表单:', { title, desc, urgent, timePreset, deadlineDays, category, address });
    
    // 填充标题
    const titleInput = form.querySelector('input[name="title"]');
    if (titleInput) {
        titleInput.value = title;
        console.log('已填充标题:', title);
    }
    
    // 填充描述
    const descInput = form.querySelector('textarea[name="description"]');
    if (descInput) {
        descInput.value = desc;
        console.log('已填充描述:', desc);
    }
    
    // 填充详细地址
    const addressInput = form.querySelector('input[name="address"]');
    if (addressInput && address) {
        addressInput.value = address;
        console.log('已填充地址:', address);
    }
    
    // 设置分类
    const categorySelect = form.querySelector('select[name="category"]');
    if (categorySelect) {
        categorySelect.value = category;
        console.log('已填充分类:', category);
    }
    
    // 设置加急状态
    const urgentCheckbox = form.querySelector('input[name="is_urgent"]');
    if (urgentCheckbox) {
        urgentCheckbox.checked = urgent;
        console.log('已设置加急:', urgent);
    }
    
    // 如果是加急，显示加急类型选择并自动选择类型
    if (urgent) {
        const urgentTypeGroup = document.getElementById('urgent_type_group');
        if (urgentTypeGroup) {
            urgentTypeGroup.style.display = 'block';
        }
        
        const urgentTypeSelect = form.querySelector('select[name="urgent_type"]');
        if (urgentTypeSelect) {
            if (title.includes('医院') || title.includes('药')) {
                urgentTypeSelect.value = 'medical';
            } else if (title.includes('电闸') || title.includes('维修')) {
                urgentTypeSelect.value = 'repair';
            } else if (title.includes('快递') || title.includes('取')) {
                urgentTypeSelect.value = 'pickup';
            } else {
                urgentTypeSelect.value = 'other';
            }
            console.log('已设置加急类型:', urgentTypeSelect.value);
        }
    }
    
    // 设置时间预设
    const timeSelect = form.querySelector('select[name="start_time"]');
    if (timeSelect) {
        timeSelect.value = timePreset;
        console.log('已填充时间预设:', timePreset);
    }
    
    // 设置截止日期
    const deadlineInput = form.querySelector('input[name="deadline"]');
    if (deadlineInput) {
        const now = new Date();
        now.setDate(now.getDate() + deadlineDays);
        now.setHours(23, 59, 0, 0);
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        deadlineInput.value = `${year}-${month}-${day}T${hours}:${minutes}`;
        console.log('已填充截止日期:', deadlineInput.value);
    }
    
    console.log('表单填充完成');
}

// 初始化新版移动端首页
function initNewMobileHome() {
    // 更新问候语
    updateMobileHomeGreeting();
    
    // 更新统计数据
    updateMobileHomeStats();
    
    // 加载推荐需求
    loadMobileRecommendRequests();
    
    // 分类芯片点击事件
    document.querySelectorAll('.category-chip').forEach(chip => {
        chip.addEventListener('click', function() {
            document.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            const category = this.querySelector('.chip-text')?.textContent;
            if (category) {
                window.location.href = `requests.html?category=${encodeURIComponent(category)}`;
            }
        });
    });
}

// 页面加载完成后初始化移动端首页
document.addEventListener('DOMContentLoaded', () => {
    // 检查是否是移动端并初始化新版首页
    if (window.innerWidth <= 768) {
        initNewMobileHome();
    }
});

// 窗口大小改变时重新初始化
window.addEventListener('resize', debounce(() => {
    if (window.innerWidth <= 768) {
        updateMobileHomeGreeting();
    }
}, 250));
