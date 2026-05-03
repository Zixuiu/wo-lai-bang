<template>
	<view class="container">
		<!-- Content -->
		<scroll-view class="screen" scroll-y v-if="need">
			<view class="hero-title">{{ need.title }}</view>

			<view class="detail-item">
				<view class="label">当前状态</view>
				<view class="value status" :class="need.status">{{ getStatusText(need.status) }}</view>
			</view>

			<view class="detail-item">
				<view class="label">服务位置</view>
				<view class="value">{{ need.location }}</view>
			</view>

			<view class="detail-item" v-if="need.detailAddress">
				<view class="label">具体位置</view>
				<view class="value">{{ need.detailAddress }}</view>
			</view>

			<view class="detail-item">
				<view class="label">订单报酬</view>
				<view class="value">¥ {{ need.reward }}</view>
			</view>

			<view class="detail-item" v-if="need.description">
				<view class="label">详情描述</view>
				<view class="value desc">{{ need.description }}</view>
			</view>

			<view class="detail-item">
				<view class="label">现场图片</view>
				<view v-if="need.image" class="image-wrapper">
					<image :src="need.image" mode="aspectFill" class="need-image" />
				</view>
				<view v-else class="no-image">暂无图片展示</view>
			</view>

			<view class="detail-item">
				<view class="value">{{ formatTime(need.createdAt) }}</view>
			</view>

			<view class="detail-item" v-if="need.deadline">
				<view class="label">最晚什么时候</view>
				<view class="value deadline-text">{{ need.deadline }}</view>
			</view>
		</scroll-view>

		<!-- Action Button -->
		<view class="btn-group-fixed">
			<view class="btn btn-p" @click="republishNeed">再次发布</view>
		</view>

		<!-- 加载中 -->
		<view v-if="!need" class="loading">
			<text class="loading-text">加载中...</text>
		</view>
	</view>
</template>

<script>
import { useUserStore } from '@/stores/user'
import { useNeedStore } from '@/stores/need'
import { useOrderStore } from '@/stores/order'

export default {
	setup() {
		const userStore = useUserStore()
		const needStore = useNeedStore()
		const orderStore = useOrderStore()
		return { userStore, needStore, orderStore }
	},
	data() {
		return {
			need: null
		}
	},
	onLoad(options) {
		const id = options.id
		if (!id) return;

		const findFromAll = () => {
			const sources = [
				...(this.needStore.needs || []),
				...(this.orderStore.orders || [])
			]
			return sources.find(item => item.id == id || (item.needId && item.needId == id))
		}

		this.need = findFromAll()
	},
	methods: {
		getStatusText(status) {
			const map = {
				'open': '等待接单',
				'accepted': '帮手已接单',
				'completed': '订单已完成',
				'cancelled': '已取消'
			}
			return map[status] || status
		},
		formatTime(timestamp) {
			if (!timestamp) return ''
			const date = new Date(timestamp)
			return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
		},
		republishNeed() {
			if (!this.need) {
				uni.showToast({ title: '需求不存在', icon: 'none' })
				return
			}
			
			// 保存原来的数据
			const needData = {
				title: this.need.title,
				description: this.need.description,
				reward: this.need.reward,
				location: this.need.location,
				detailAddress: this.need.detailAddress || '',
				address: this.need.address,
				latitude: this.need.latitude,
				longitude: this.need.longitude,
				image: this.need.image || '',
				deadline: this.need.deadline || '',
				category: this.need.category || '其他',
				originalId: this.need.id
			}
			
			uni.setStorageSync('republishData', needData)
			uni.showToast({ title: '数据已准备，即将跳转', icon: 'success' })
			
			// 跳转到发布页面
			uni.switchTab({
				url: '/pages/publish/publish'
			})
		}
	}
}
</script>

<style scoped>
.container {
	min-height: 100vh;
	background: #FFFFFF;
	display: flex;
	flex-direction: column;
}

.screen {
	flex: 1;
	padding: 0 30px;
	padding-bottom: 100px;
	overflow-y: auto;
	-webkit-overflow-scrolling: touch;
}

.hero-title {
	font-size: 32px;
	font-weight: 800;
	margin: 20px 0 40px;
	letter-spacing: -1px;
	color: #1F2937;
	line-height: 1.2;
}

.detail-item {
	margin-bottom: 35px;
	border-left: 3px solid #D1FAE5;
	padding-left: 20px;
}

.label {
	font-size: 12px;
	color: #6B7280;
	margin-bottom: 8px;
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 1px;
}

.value {
	font-size: 18px;
	font-weight: 600;
	color: #1F2937;
}

.value.status {
	color: #10B981;
}

.value.desc {
	font-size: 15px;
	font-weight: 400;
	color: #4B5563;
	line-height: 1.6;
}

.image-wrapper {
	margin-top: 10px;
	border-radius: 12px;
	overflow: hidden;
}

.need-image {
	width: 100%;
	height: 200px;
	border-radius: 12px;
}

.no-image {
	font-size: 14px;
	color: #9CA3AF;
	font-style: italic;
	margin-top: 8px;
}

.deadline-text {
	color: #EF4444;
	font-weight: 700;
}

.btn-group-fixed {
	padding: 20px 30px;
	padding-bottom: env(safe-area-inset-bottom, 20px);
	background: #FFFFFF;
	position: fixed;
	bottom: 0;
	left: 0;
	right: 0;
}

.btn {
	height: 56px;
	border-radius: 28px;
	display: flex;
	align-items: center;
	justify-content: center;
	font-weight: 700;
	font-size: 16px;
	cursor: pointer;
	user-select: none;
}

.btn-p {
	background: #10B981;
	color: white;
	box-shadow: 0 10px 20px rgba(16, 185, 129, 0.2);
}

.loading {
	display: flex;
	align-items: center;
	justify-content: center;
	height: 100vh;
}

.loading-text {
	color: #6B7280;
}
</style>