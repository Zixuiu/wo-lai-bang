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

		<!-- Action Button (移出scroll-view) -->
		<view class="btn-group-fixed">
			<!-- 调试信息 -->
			<view style="padding: 10px; background: #f5f5f5; margin-bottom: 10px; font-size: 12px;">
				<text>need: {{ need ? '存在' : '不存在' }}</text><br/>
				<text>status: {{ need ? need.status : '无' }}</text><br/>
				<text>点击计数: {{ clickCount }}</text>
			</view>
			
			<!-- 直接显示测试按钮 -->
			<view class="btn btn-p" @click="testClick">测试点击</view>
			<view class="btn-row" style="margin-top: 10px;">
				<view class="btn btn-p" @click="editNeed">编辑需求</view>
				<view class="btn btn-s" @click="republishNeed">再次发布</view>
			</view>
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
			need: null,
			clickCount: 0
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
		testClick() {
			this.clickCount++
			console.log('测试按钮被点击！次数:', this.clickCount)
			alert('按钮点击成功！次数: ' + this.clickCount)
		},
		editNeed() {
			console.log('编辑需求被调用')
			this.clickCount++
			if (!this.need) {
				alert('需求不存在')
				return
			}
			alert('准备编辑需求: ' + this.need.title)
			const needData = {
				id: this.need.id,
				isEdit: true,
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
				category: this.need.category || '其他'
			}
			uni.setStorageSync('editData', needData)
			alert('已保存编辑数据，准备跳转到发布页')
			uni.navigateTo({
				url: '/pages/publish/publish'
			})
		},
		republishNeed() {
			console.log('再次发布被调用')
			this.clickCount++
			alert('准备再次发布: ' + this.need.title)
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
				category: this.need.category || '其他'
			}
			uni.setStorageSync('republishData', needData)
			alert('已保存重新发布数据，准备跳转到发布页')
			uni.navigateTo({
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

.btn-row {
	display: flex;
	gap: 12px;
}

.btn-row .btn {
	flex: 1;
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

.btn-s {
	background: #F3F4F6;
	color: #6B7280;
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