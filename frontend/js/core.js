// core.js - 核心功能，首屏必需
// 这个文件体积小，优先加载

// 全局配置
window.CONFIG = {
    API_BASE_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:5000/api'
        : '/api'
};

// 工具函数
window.showToast = function(message, type = 'error') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => toast.classList.remove('show'), 2500);
};

// 页面跳转
window.navigateTo = function(url) {
    window.location.replace(url);
};

// 检查登录状态
window.checkLogin = function() {
    const user = localStorage.getItem('current_user');
    const token = localStorage.getItem('auth_token');
    return user && token;
};

// 获取当前用户
window.getCurrentUser = function() {
    try {
        return JSON.parse(localStorage.getItem('current_user') || '{}');
    } catch (e) {
        return null;
    }
};

// 显示登录弹窗（简化版）
window.showLoginModal = function() {
    window.location.href = 'index.html?showLogin=true';
};

// 显示发布弹窗/页面
window.showPublishModal = function() {
    const user = window.getCurrentUser();
    if (!user || !user.id) {
        window.showLoginModal();
        return;
    }
    window.location.href = 'publish.html';
};

// 去通知页面
window.goToNotifications = function() {
    window.location.href = 'notifications.html';
};

// 获取头像
window.getAvatar = function(seed) {
    return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'%3E%3C/path%3E%3Ccircle cx='12' cy='7' r='4'%3E%3C/circle%3E%3C/svg%3E`;
};

// 检测并适配系统导航栏高度
function adjustForSystemNav() {
    // 方法1: 使用 visualViewport API 检测
    if (window.visualViewport) {
        const viewportHeight = window.visualViewport.height;
        const windowHeight = window.innerHeight;
        const navHeight = windowHeight - viewportHeight;

        if (navHeight > 0) {
            document.documentElement.style.setProperty('--system-nav-height', navHeight + 'px');
            return;
        }
    }

    // 方法2: 根据屏幕比例估算（Android 三大金刚键约 48-56px）
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isMobile = window.innerWidth <= 768;

    if (isAndroid && isMobile) {
        // 估算系统导航栏高度（48px ≈ 3rem）
        const estimatedNavHeight = 48;
        document.documentElement.style.setProperty('--system-nav-height', estimatedNavHeight + 'px');
    }

    // 方法3: 检测是否为手势导航（较新的 Android）
    // 如果屏幕高度与 window.innerHeight 相差很小，可能是手势导航
    const screenHeight = window.screen.height;
    const windowInnerHeight = window.innerHeight;
    const density = window.devicePixelRatio || 1;

    // 计算物理像素差异
    const heightDiff = (screenHeight - windowInnerHeight) * density;

    // 如果差异小于 100px，可能是手势导航或没有系统导航栏
    if (heightDiff < 100) {
        document.documentElement.style.setProperty('--system-nav-height', '0px');
    }
}

// 初始化核心功能
document.addEventListener('DOMContentLoaded', function() {
    // 更新消息徽章
    const badge = document.getElementById('message-badge');
    if (badge) {
        const unread = parseInt(localStorage.getItem('unread_count') || '0');
        if (unread > 0) {
            badge.textContent = unread;
            badge.style.display = 'flex';
        }
    }

    // 适配系统导航栏
    adjustForSystemNav();

    // 窗口大小变化时重新检测
    window.addEventListener('resize', adjustForSystemNav);
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', adjustForSystemNav);
    }
});

console.log('Core.js 加载完成 - v1.0');
