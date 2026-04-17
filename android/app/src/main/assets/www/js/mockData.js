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

    mockRequests = [
        {
            id: 1,
            user_id: 1,
            title: '帮忙搬家具',
            description: '周末搬家，需要2-3个壮劳力帮忙搬家具，从3楼搬到1楼，大概2小时，有偿！',
            category: '搬运',
            location: '北京市朝阳区',
            lat: 39.9,
            lng: 116.4,
            reward: '200元',
            status: 'pending',
            created_at: '2026-01-28 09:00:00',
            completed_at: null,
            helper_id: null,
            is_urgent: false,
            user_nickname: '张三',
            user_avatar: getAvatar('zhangsan'),
            user_rating: 4.8
        },
        {
            id: 2,
            user_id: 2,
            title: '辅导小学数学',
            description: '孩子三年级，数学成绩不太好，需要一位有耐心的大学生辅导，每周两次',
            category: '教育',
            location: '上海市浦东新区',
            lat: 31.2,
            lng: 121.5,
            reward: '100元/小时',
            status: 'accepted',
            created_at: '2026-01-27 14:00:00',
            completed_at: null,
            helper_id: 1,
            is_urgent: false,
            user_nickname: '李四',
            user_avatar: getAvatar('lisi'),
            user_rating: 4.9
        },
        {
            id: 3,
            user_id: 3,
            title: '电脑重装系统',
            description: '电脑中毒了，需要重装系统，最好是Win11，带激活',
            category: '技术',
            location: '广州市天河区',
            lat: 23.1,
            lng: 113.3,
            reward: '80元',
            status: 'completed',
            created_at: '2026-01-25 10:30:00',
            completed_at: '2026-01-26 16:00:00',
            helper_id: 4,
            is_urgent: false,
            user_nickname: '王五',
            user_avatar: getAvatar('wangwu'),
            user_rating: 4.7
        },
        {
            id: 4,
            user_id: 4,
            title: '帮忙遛狗',
            description: '临时出差3天，需要有人帮忙照顾家里的金毛，每天遛两次',
            category: '宠物',
            location: '深圳市南山区',
            lat: 22.5,
            lng: 114.0,
            reward: '150元/天',
            status: 'pending',
            created_at: '2026-01-29 08:00:00',
            completed_at: null,
            helper_id: null,
            is_urgent: false,
            user_nickname: '赵六',
            user_avatar: getAvatar('zhaoliu'),
            user_rating: 5.0
        }
    ];

    mockCategories = [
        { id: 1, name: '搬运', icon: '📦', description: '搬家、搬运物品等' },
        { id: 2, name: '教育', icon: '📚', description: '作业辅导、技能培训等' },
        { id: 3, name: '技术', icon: '💻', description: '电脑维修、软件安装等' },
        { id: 4, name: '宠物', icon: '🐕', description: '遛狗、喂猫、宠物照看' },
        { id: 5, name: '家政', icon: '🧹', description: '打扫卫生、洗衣做饭' },
        { id: 6, name: '维修', icon: '🔧', description: '家电维修、管道疏通' }
    ];

    mockNotifications = [
        {
            id: 1,
            user_id: 1,
            type: 'help_request',
            title: '新的需求',
            content: '有人发布了新的需求：帮忙搬家具',
            is_read: false,
            created_at: '2026-01-28 10:00:00',
            related_id: 1
        },
        {
            id: 2,
            user_id: 1,
            type: 'message',
            title: '新消息',
            content: '李四回复了您的评论',
            is_read: true,
            created_at: '2026-01-27 15:00:00',
            related_id: null
        }
    ];
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