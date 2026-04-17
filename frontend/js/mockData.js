// 模拟数据模块
// 包含完整的 mockAPI 对象定义

// 获取头像函数 - 使用 app.js 中的 getAvatar 函数
// 计算距离函数 - 使用 app.js 中的 calculateDistance 函数

// 模拟数据 - 使用延迟初始化，确保 app.js 中的函数已加载
let mockRequests = null;
let mockCategories = null;
let mockNotifications = null;
window.mockNotifications = mockNotifications;

// 初始化模拟数据（在 app.js 加载后调用）
function initMockData() {
    if (mockRequests) return; // 已经初始化

    // 获取头像函数（从 app.js）
    const getAvatar = window.getAvatar || function(seed) {
        return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'%3E%3C/path%3E%3Ccircle cx='12' cy='7' r='4'%3E%3C/circle%3E%3C/svg%3E`;
    };

    // 计算距离函数（从 app.js）
    const calculateDistance = window.calculateDistance || function(lat1, lng1, lat2, lng2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    };

    mockRequests = [];

    mockCategories = [
        { id: 1, name: '搬运', icon: '📦', description: '搬家、搬运物品等' },
        { id: 2, name: '教育', icon: '📚', description: '作业辅导、技能培训等' },
        { id: 3, name: '技术', icon: '💻', description: '电脑维修、软件安装等' },
        { id: 4, name: '宠物', icon: '🐕', description: '遛狗、喂猫、宠物照看' },
        { id: 5, name: '家政', icon: '🧹', description: '打扫卫生、洗衣做饭' },
        { id: 6, name: '维修', icon: '🔧', description: '家电维修、管道疏通' }
    ];

    mockNotifications = [];
    window.mockNotifications = mockNotifications;
}

// 全局 mockAPI 对象 - 使用补充模式，不覆盖已存在的 mockAPI
if (typeof window.mockAPI === 'undefined') {
    window.mockAPI = {
        getCategories: () => ({
            success: true,
            data: mockCategories
        }),

        getRequests: (filters = {}) => {
            let data = [...mockRequests];
            if (filters.search) {
                const keyword = filters.search.toLowerCase();
                data = data.filter(req =>
                    req.title.toLowerCase().includes(keyword) ||
                    req.description.toLowerCase().includes(keyword)
                );
            }
            if (filters.category && filters.category !== 'all') {
                data = data.filter(req => req.category === filters.category);
            }
            if (filters.status) {
                data = data.filter(req => req.status === filters.status);
            }
            return { success: true, data };
        },

        getNearbyRequests: (lat, lng, limit = 10) => {
            // 延迟获取 calculateDistance 函数，确保它已加载
            const calcDist = window.calculateDistance || function(lat1, lng1, lat2, lng2) {
                const R = 6371;
                const dLat = (lat2 - lat1) * Math.PI / 180;
                const dLng = (lng2 - lng1) * Math.PI / 180;
                const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                          Math.sin(dLng/2) * Math.sin(dLng/2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                return R * c;
            };
            const withDistance = mockRequests.map(req => ({
                ...req,
                distance: calcDist(lat, lng, req.lat, req.lng)
            })).sort((a, b) => a.distance - b.distance);
            return {
                success: true,
                data: withDistance.slice(0, limit)
            };
        },

        getUsers: () => ({
            success: true,
            data: []
        }),

        getUnreadNotificationCount: () => ({
            success: true,
            data: { count: mockNotifications.filter(n => !n.is_read).length }
        }),

        getNotifications: (userId) => {
            const userNotifications = mockNotifications.filter(n => n.user_id === userId);
            return {
                success: true,
                data: userNotifications
            };
        },

        markNotificationRead: (notificationId) => {
            const notification = mockNotifications.find(n => n.id === notificationId);
            if (notification) {
                notification.is_read = true;
            }
            return { success: true };
        },

        getUser: (id) => ({
            success: false,
            message: '用户不存在'
        }),

        getBadges: () => ({
            success: true,
            data: []
        }),

        getMyRequests: (userId) => {
            const myRequests = mockRequests.filter(req => req.user_id === userId);
            return {
                success: true,
                data: myRequests
            };
        }
    };
} else {
    // 补充缺失的方法
    if (typeof window.mockAPI.getCategories === 'undefined') {
        window.mockAPI.getCategories = () => ({ success: true, data: mockCategories });
    }
    if (typeof window.mockAPI.getRequests === 'undefined') {
        window.mockAPI.getRequests = (filters = {}) => {
            let data = [...mockRequests];
            if (filters.search) {
                const keyword = filters.search.toLowerCase();
                data = data.filter(req =>
                    req.title.toLowerCase().includes(keyword) ||
                    req.description.toLowerCase().includes(keyword)
                );
            }
            if (filters.category && filters.category !== 'all') {
                data = data.filter(req => req.category === filters.category);
            }
            if (filters.status) {
                data = data.filter(req => req.status === filters.status);
            }
            return { success: true, data };
        };
    }
    if (typeof window.mockAPI.getNearbyRequests === 'undefined') {
        window.mockAPI.getNearbyRequests = (lat, lng, limit = 10) => {
            // 延迟获取 calculateDistance 函数，确保它已加载
            const calcDist = window.calculateDistance || function(lat1, lng1, lat2, lng2) {
                const R = 6371;
                const dLat = (lat2 - lat1) * Math.PI / 180;
                const dLng = (lng2 - lng1) * Math.PI / 180;
                const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                          Math.sin(dLng/2) * Math.sin(dLng/2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                return R * c;
            };
            const withDistance = mockRequests.map(req => ({
                ...req,
                distance: calcDist(lat, lng, req.lat, req.lng)
            })).sort((a, b) => a.distance - b.distance);
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
        window.mockAPI.getUnreadNotificationCount = () => ({
            success: true,
            data: { count: mockNotifications.filter(n => !n.is_read).length }
        });
    }
    if (typeof window.mockAPI.getNotifications === 'undefined') {
        window.mockAPI.getNotifications = (userId) => {
            const userNotifications = mockNotifications.filter(n => n.user_id === userId);
            return {
                success: true,
                data: userNotifications
            };
        };
    }
    if (typeof window.mockAPI.markNotificationRead === 'undefined') {
        window.mockAPI.markNotificationRead = (notificationId) => {
            const notification = mockNotifications.find(n => n.id === notificationId);
            if (notification) {
                notification.is_read = true;
            }
            return { success: true };
        };
    }
    if (typeof window.mockAPI.getUser === 'undefined') {
        window.mockAPI.getUser = (id) => ({
            success: false,
            message: '用户不存在'
        });
    }
    if (typeof window.mockAPI.getBadges === 'undefined') {
        window.mockAPI.getBadges = () => ({ success: true, data: [] });
    }
    if (typeof window.mockAPI.getMyRequests === 'undefined') {
        window.mockAPI.getMyRequests = (userId) => {
            const myRequests = mockRequests.filter(req => req.user_id === userId);
            return {
                success: true,
                data: myRequests
            };
        };
    }
    if (typeof window.mockAPI.acceptRequest === 'undefined') {
        window.mockAPI.acceptRequest = (requestId) => {
            const request = mockRequests.find(req => req.id === requestId);
            if (request) {
                request.status = 'accepted';
                return { success: true, message: '接受成功' };
            }
            return { success: false, message: '需求不存在' };
        };
    }
}

// 初始化模拟数据
initMockData();