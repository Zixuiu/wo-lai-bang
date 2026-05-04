<template>
	<view class="messages-container">
		<view class="header">
			<text class="back-space"></text>
			<text class="header-title">消息</text>
			<view class="header-right"></view>
		</view>

		<scroll-view class="content-scroll" scroll-y>
			<view v-if="conversations.length === 0" class="empty-state">
				<view class="empty-illustration">
					<view class="empty-icon-wrap">
						<text class="empty-icon-emoji">💬</text>
					</view>
				</view>
				<text class="empty-title">暂无消息</text>
				<text class="empty-subtitle">去接单后就可以和邻居聊天啦~</text>
				<view class="debug-btn" @click="generateTestConversation">
					<text class="debug-btn-text">生成测试会话</text>
				</view>
			</view>

			<view v-else class="conversation-list">
				<view
					v-for="conv in conversations"
					:key="conv.id"
					class="conv-wrapper"
					@touchstart="touchStart($event, conv.id)"
					@touchmove="touchMove($event, conv.id)"
					@touchend="touchEnd($event, conv.id)"
				>
					<view
						class="delete-action"
						:class="{ show: deleteId === conv.id }"
						@click.stop="deleteConversation(conv.id)"
					>
						<text>删除</text>
					</view>

					<view
						class="conv-item"
						:class="{ open: deleteId === conv.id }"
						@click="goToChat(conv)"
					>
						<view class="avatar-ring">
							<view class="avatar" :style="{ background: getAvatarBg(conv.nickname) }">
								<text class="avatar-text">{{ conv.nickname.slice(0, 1) }}</text>
							</view>
							<view v-if="conv.online" class="online-dot"></view>
						</view>

						<view class="conv-main">
							<view class="conv-header">
								<text class="conv-name">{{ conv.nickname }}</text>
								<view class="conv-header-right">
									<text class="conv-time">{{ formatTime(conv.lastTime) }}</text>
									<view v-if="conv.relatedOrder" class="view-order-btn" @click.stop="viewOrder(conv)">
										<text class="view-order-text">订单</text>
									</view>
								</view>
							</view>
							<view class="conv-footer">
								<text class="conv-preview" :class="{ unread: conv.unread > 0 }">{{ conv.lastMessage }}</text>
								<view v-if="conv.unread > 0" class="unread-badge">
									<text class="badge-text">{{ conv.unread > 99 ? '99+' : conv.unread }}</text>
								</view>
							</view>
						</view>
					</view>
				</view>
			</view>

			<view class="bottom-safe"></view>
		</scroll-view>

		<!-- 自定义底部导航 -->
		<bottom-nav :current="3"></bottom-nav>

		<!-- 确认弹窗 -->
		<view v-if="confirmVisible" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;" @click="confirmVisible = false">
			<view style="width:560rpx;background:#FFFFFF;border-radius:32rpx;overflow:hidden;" @click.stop>
				<view style="padding:40rpx 40rpx 20rpx;text-align:center;">
					<text style="font-size:34rpx;font-weight:700;color:#1E293B;">{{ confirmTitle }}</text>
				</view>
				<view style="padding:0 40rpx 30rpx;text-align:center;">
					<text style="font-size:28rpx;color:#64748B;line-height:1.6;">{{ confirmContent }}</text>
				</view>
				<view style="display:flex;border-top:1rpx solid #F1F5F9;">
					<view style="flex:1;height:96rpx;display:flex;align-items:center;justify-content:center;" v-if="confirmCancelText" @click="confirmVisible = false">
						<text style="font-size:30rpx;font-weight:600;color:#64748B;">{{ confirmCancelText }}</text>
					</view>
					<view style="flex:1;height:96rpx;display:flex;align-items:center;justify-content:center;border-left:1rpx solid #F1F5F9;" v-if="confirmCancelText" @click="confirmVisible = false; if(onConfirm) onConfirm()">
						<text style="font-size:30rpx;font-weight:700;color:#10B981;">{{ confirmConfirmText }}</text>
					</view>
					<view style="flex:1;height:96rpx;display:flex;align-items:center;justify-content:center;" v-else @click="confirmVisible = false; if(onConfirm) onConfirm()">
						<text style="font-size:30rpx;font-weight:700;color:#10B981;">{{ confirmConfirmText }}</text>
					</view>
				</view>
			</view>
		</view>

		<!-- 订单卡片弹窗 -->
		<view v-if="orderCardVisible" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;" @click="orderCardVisible = false">
			<view style="width:600rpx;background:#FFFFFF;border-radius:32rpx;overflow:hidden;" @click.stop>
				<view style="padding:32rpx;">
					<view style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20rpx;">
						<text style="font-size:32rpx;font-weight:800;color:#1E293B;">订单详情</text>
						<view style="font-size:24rpx;padding:8rpx 16rpx;border-radius:16rpx;" :class="'order-status-' + currentOrder?.status">
							{{ getOrderStatusText(currentOrder?.status) }}
						</view>
					</view>
					<view style="font-size:28rpx;font-weight:700;color:#1E293B;margin-bottom:16rpx;">{{ currentOrder?.title }}</view>
					<view style="display:flex;align-items:center;gap:8rpx;margin-bottom:12rpx;">
						<text style="font-size:24rpx;color:#64748B;">酬劳</text>
						<text style="font-size:32rpx;font-weight:800;color:#10B981;">¥{{ currentOrder?.reward }}</text>
					</view>
					<view style="border-top:1rpx solid #F1F5F9;padding-top:20rpx;margin-top:20rpx;">
						<view style="display:flex;align-items:center;gap:12rpx;margin-bottom:16rpx;">
							<view style="width:40rpx;height:40rpx;border-radius:20rpx;background:#ECFDF5;display:flex;align-items:center;justify-content:center;">
								<text style="font-size:20rpx;font-weight:700;color:#10B981;">发</text>
							</view>
							<text style="font-size:28rpx;color:#1E293B;font-weight:600;">{{ currentOrder?.publisher?.nickname || '发布者' }}</text>
						</view>
						<view style="display:flex;align-items:center;gap:12rpx;">
							<view style="width:40rpx;height:40rpx;border-radius:20rpx;background:#F1F5F9;display:flex;align-items:center;justify-content:center;">
								<text style="font-size:20rpx;font-weight:700;color:#64748B;">帮</text>
							</view>
							<text style="font-size:28rpx;color:#1E293B;font-weight:600;">{{ currentOrder?.helper?.nickname || '帮手' }}</text>
						</view>
					</view>
					<view style="display:flex;gap:16rpx;margin-top:24rpx;">
						<view style="flex:1;height:88rpx;border-radius:22rpx;display:flex;align-items:center;justify-content:center;background:#F1F5F9;" @click="orderCardVisible = false">
							<text style="font-size:28rpx;font-weight:700;color:#64748B;">关闭</text>
						</view>
						<view style="flex:1;height:88rpx;border-radius:22rpx;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#10B981,#059669);" @click="goToOrderDetail">
							<text style="font-size:28rpx;font-weight:700;color:#FFFFFF;">查看详情</text>
						</view>
					</view>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
import BottomNav from '@/components/bottom-nav/bottom-nav.vue'
import IconFont from '@/components/icon-font/icon-font.vue'
import websocketService from '@/utils/websocket'

export default {
	components: {
		BottomNav,
		IconFont
	},
	data() {
		return {
			deleteId: null,
			startX: 0,
			conversations: [],
			confirmVisible: false,
			confirmTitle: '提示',
			confirmContent: '',
			confirmConfirmText: '确定',
			confirmCancelText: '取消',
			onConfirm: null,
			orderCardVisible: false,
			currentOrder: null
		}
	},
	onLoad() {
		this.initWebSocketListener()
	},
	onShow() {
		uni.hideTabBar()
		this.loadConversations()
		this.updateTabBarBadge()
	},
	onUnload() {
		this.removeWebSocketListener()
	},
	methods: {
		initWebSocketListener() {
			websocketService.on('chat_message', this.handleNewMessage)
		},
		removeWebSocketListener() {
			websocketService.off('chat_message', this.handleNewMessage)
		},
		handleNewMessage(payload) {
			this.loadConversations()
			this.updateTabBarBadge()
		},
		updateTabBarBadge() {
			const notifications = uni.getStorageSync('notifications') || []
			const unreadNotifications = notifications.filter(n => !n.read).length

			let totalUnreadMessages = 0
			this.conversations.forEach(conv => {
				totalUnreadMessages += (conv.unread || 0)
			})

			const totalUnread = unreadNotifications + totalUnreadMessages

			if (totalUnread > 0) {
				uni.setTabBarBadge({
					index: 3,
					text: totalUnread > 99 ? '99+' : String(totalUnread)
				})
			} else {
				uni.removeTabBarBadge({ index: 3 })
			}

			uni.setStorageSync('totalUnreadCount', totalUnread)
		},
		loadConversations() {
			const currentUserId = uni.getStorageSync('userInfo')?.id
			const allConversations = uni.getStorageSync('conversations') || []
			if (allConversations.length > 0) {
				this.conversations = allConversations
					.filter(conv => {
						if (conv.userId && conv.userId.startsWith('sim')) return false
						if (conv.relatedOrder) {
							const order = conv.relatedOrder
							const isPublisherSim = order.publisher?.id && order.publisher.id.startsWith('sim')
							const isHelperSim = order.helper?.id && order.helper.id.startsWith('sim')
							if (isPublisherSim && isHelperSim) return false
						}
						return true
					})
					.sort((a, b) => b.lastTime - a.lastTime)
			}
		},
		clearMessageBadge() {
			const pages = getCurrentPages()
			const currentPage = pages[pages.length - 1]
			if (currentPage && currentPage.getAppGlobalEmitter) {
				const app = getApp({ allowDefault: true })
				if (app.updateTabBarBadge) {
					app.updateTabBarBadge()
				}
			}
			uni.removeTabBarBadge({ index: 3 })
			uni.setStorageSync('totalUnreadCount', 0)
			uni.$emit('clearMessageBadge')
		},
		getAvatarBg(name) {
			const colors = [
				'linear-gradient(135deg, #10B981, #34D399)',
				'linear-gradient(135deg, #3B82F6, #60A5FA)',
				'linear-gradient(135deg, #8B5CF6, #A78BFA)',
				'linear-gradient(135deg, #F59E0B, #FBBF24)',
				'linear-gradient(135deg, #EC4899, #F472B6)',
				'linear-gradient(135deg, #EF4444, #F87171)'
			]
			let hash = 0
			for (let i = 0; i < name.length; i++) {
				hash = name.charCodeAt(i) + ((hash << 5) - hash)
			}
			return colors[Math.abs(hash) % colors.length]
		},
		formatTime(timestamp) {
			if (!timestamp) return ''
			const now = Date.now()
			const diff = now - timestamp
			const minutes = Math.floor(diff / 60000)
			const hours = Math.floor(diff / 3600000)
			const days = Math.floor(diff / 86400000)

			if (minutes < 1) return '刚刚'
			if (minutes < 60) return `${minutes}分钟前`
			if (hours < 24) return `${hours}小时前`
			if (days < 7) return `${days}天前`

			const date = new Date(timestamp)
			return `${date.getMonth() + 1}/${date.getDate()}`
		},
		goToChat(conv) {
			if (this.deleteId !== null) {
				this.deleteId = null
				return
			}
			uni.navigateTo({
				url: `/pages/chat/chat?userId=${conv.userId}&nickname=${conv.nickname}`
			})
		},
		touchStart(e, id) {
			this.startX = e.touches[0].clientX
			this.deleteId = null
		},
		touchMove(e, id) {
			const moveX = e.touches[0].clientX
			if (this.startX - moveX > 60) {
				this.deleteId = id
			} else if (moveX - this.startX > 60) {
				this.deleteId = null
			}
		},
		touchEnd(e, id) {
			this.startX = 0
		},
		deleteConversation(id) {
			this.confirmTitle = '确认删除'
			this.confirmContent = '确定要删除该聊天会话吗？'
			this.confirmConfirmText = '确定'
			this.confirmCancelText = '取消'
			this.onConfirm = () => {
				this.conversations = this.conversations.filter(c => c.id !== id)
				uni.setStorageSync('conversations', this.conversations)
				this.deleteId = null
				uni.showToast({ title: '已删除', icon: 'success' })
			}
			this.confirmVisible = true
		},
		generateTestConversation() {
			const nicknames = ['李阿姨', '小林', '王爷爷', '张大哥', '刘大姐']
			const messages = [
				'好的，快递已放在门卫处~',
				'猫咪已经喂好了，它很乖~',
				'明天下午3点散步，不见不散~',
				'谢谢你的帮助，下次还找你！',
				'已收到，很满意服务~'
			]
			const randomNick = nicknames[Math.floor(Math.random() * nicknames.length)]
			const randomMsg = messages[Math.floor(Math.random() * messages.length)]
			const testConv = {
				id: Date.now(),
				userId: `u_test_${Date.now()}`,
				nickname: randomNick,
				lastMessage: randomMsg,
				lastTime: Date.now(),
				unread: Math.floor(Math.random() * 3),
				online: Math.random() > 0.5
			}
			this.conversations.unshift(testConv)
			uni.setStorageSync('conversations', this.conversations)
			uni.showToast({ title: '已生成测试会话', icon: 'success' })
		},
		viewOrder(conv) {
			this.currentOrder = conv.relatedOrder
			this.orderCardVisible = true
		},
		getOrderStatusText(status) {
			const map = {
				'open': '待接单',
				'accepted': '进行中',
				'pending_confirm': '待确认',
				'completed': '已完成',
				'cancelled': '已取消'
			}
			return map[status] || status
		},
		goToOrderDetail() {
			if (this.currentOrder && this.currentOrder.needId) {
				this.orderCardVisible = false
				uni.navigateTo({
					url: `/pages/need-detail/need-detail?id=${this.currentOrder.needId}`
				})
			}
		}
	}
}
</script>

<style scoped>
.messages-container {
	min-height: 100vh;
	background: #F8FAFC;
}

.header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 50px 24px 16px;
	background: #FFFFFF;
}

.back-space {
	width: 44px;
}

.header-title {
	flex: 1;
	font-size: 36rpx;
	font-weight: 800;
	color: #1E293B;
	text-align: center;
}

.header-right {
	width: 44px;
}

.content-scroll {
	height: calc(100vh - 88px);
}

.empty-state {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 120px 24px;
}

.empty-illustration {
	margin-bottom: 24px;
	display: flex;
	align-items: center;
	justify-content: center;
}

.empty-icon-wrap {
	width: 120px;
	height: 120px;
	background: linear-gradient(135deg, #ECFDF5, #D1FAE5);
	border-radius: 32px;
	display: flex;
	align-items: center;
	justify-content: center;
}

.empty-icon-emoji {
	font-size: 48px;
}

.empty-title {
	font-size: 18px;
	font-weight: 800;
	color: #1E293B;
	margin-bottom: 8px;
}

.empty-subtitle {
	font-size: 14px;
	color: #64748B;
}

.conversation-list {
	padding: 8px 0;
}

.conv-wrapper {
	position: relative;
	overflow: hidden;
}

.delete-action {
	position: absolute;
	right: 0;
	top: 0;
	bottom: 0;
	width: 80px;
	background: #EF4444;
	display: flex;
	align-items: center;
	justify-content: center;
	transform: translateX(100%);
	transition: transform 0.3s;
	z-index: 1;
}

.delete-action.show {
	transform: translateX(0);
}

.delete-action text {
	color: #FFFFFF;
	font-size: 14px;
	font-weight: 700;
}

.conv-item {
	display: flex;
	align-items: center;
	padding: 16px 20px;
	background: #FFFFFF;
	transition: transform 0.3s;
	gap: 30px;
	border-bottom: 1px solid #F1F5F9;
}

.conv-item.open {
	transform: translateX(-80px);
}

.avatar-ring {
	position: relative;
}

.avatar {
	width: 42px;
	height: 42px;
	border-radius: 14px;
	display: flex;
	align-items: center;
	justify-content: center;
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.avatar-text {
	font-size: 17px;
	font-weight: 700;
	color: #FFFFFF;
}

.online-dot {
	position: absolute;
	bottom: 0;
	right: 0;
	width: 14px;
	height: 14px;
	background: #10B981;
	border: 2px solid #FFFFFF;
	border-radius: 50%;
}

.conv-main {
	flex: 1;
	min-width: 0;
}

.conv-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 6px;
}

.conv-name {
	font-size: 15px;
	font-weight: 700;
	color: #1E293B;
}

.conv-time {
	font-size: 12px;
	color: #94A3B8;
	flex-shrink: 0;
	margin-left: 8px;
}

.conv-footer {
	display: flex;
	justify-content: space-between;
	align-items: center;
}

.conv-preview {
	font-size: 13px;
	color: #64748B;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	max-width: 200px;
}

.conv-preview.unread {
	color: #1E293B;
	font-weight: 600;
}

.unread-badge {
	min-width: 20px;
	height: 20px;
	background: #EF4444;
	border-radius: 10px;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 0 6px;
	flex-shrink: 0;
	margin-left: 8px;
}

.badge-text {
	font-size: 11px;
	font-weight: 700;
	color: #FFFFFF;
}

.bottom-safe {
	height: 40px;
}

.debug-btn {
	margin-top: 30px;
	padding: 12px 32px;
	background: #10B981;
	border-radius: 100px;
}

.debug-btn-text {
	color: #FFFFFF;
	font-size: 14px;
	font-weight: 600;
}

.conv-header-right {
	display: flex;
	align-items: center;
	gap: 8px;
}

.view-order-btn {
	background: linear-gradient(135deg, #10B981, #059669);
	padding: 4px 10px;
	border-radius: 12px;
}

.view-order-text {
	color: #FFFFFF;
	font-size: 11px;
	font-weight: 600;
}

.order-status-accepted {
	background: #ECFDF5;
	color: #10B981;
}

.order-status-pending_confirm {
	background: #FFFBEB;
	color: #F59E0B;
}

.order-status-completed {
	background: #F1F5F9;
	color: #64748B;
}

.order-status-cancelled {
	background: #FEE2E2;
	color: #EF4444;
}

.order-status-open {
	background: #DBEAFE;
	color: #3B82F6;
}
</style>