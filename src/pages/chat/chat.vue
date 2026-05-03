<template>
	<view class="chat-container">
		<view class="header">
			<view class="header-left"></view>
			<view class="header-info">
				<text class="header-title">{{ nickname }}</text>
				<text class="header-status">在线</text>
			</view>
			<view class="header-right"></view>
		</view>

		<scroll-view
			class="message-list"
			scroll-y
			:scroll-top="scrollTop"
			scroll-with-animation
			@scrolltoupper="loadMore"
			@scroll="onScroll"
			id="messageList"
		>
			<view v-if="messages.length === 0" class="empty-chat">
				<IconFont name="message" :size="64" class="empty-icon" />
				<text class="empty-text">开始和邻居聊天吧~</text>
			</view>

			<view v-else class="messages-wrapper">
				<view
					v-for="(msg, index) in messages"
					:key="index"
					class="message-item"
					:class="{ 'message-self': msg.isSelf }"
				>
					<template v-if="!msg.isSelf">
						<view class="avatar" :style="{ background: getAvatarBg(nickname) }">
							<text class="avatar-text">{{ nickname.slice(0, 1) }}</text>
						</view>
						<view class="message-content">
							<view v-if="msg.type === 'text'" class="bubble bubble-other">
								<text class="bubble-text">{{ msg.text }}</text>
							</view>
							<view v-else-if="msg.type === 'image'" class="bubble image-bubble">
								<image
									class="chat-image"
									:src="msg.imageUrl"
									mode="widthFix"
									@click="previewImage(msg.imageUrl)"
								></image>
							</view>
							<text class="message-time">{{ formatTime(msg.time) }}</text>
						</view>
					</template>

					<template v-else>
						<view class="message-content self-content">
							<view v-if="msg.type === 'text'" class="bubble bubble-self">
								<text class="bubble-text self-text">{{ msg.text }}</text>
							</view>
							<view v-else-if="msg.type === 'image'" class="bubble image-bubble self-bubble">
								<image
									class="chat-image"
									:src="msg.imageUrl"
									mode="widthFix"
									@click="previewImage(msg.imageUrl)"
								></image>
							</view>
							<text class="message-time self-time">{{ formatTime(msg.time) }}</text>
						</view>
						<view class="avatar self-avatar">
							<text class="avatar-text">{{ userStore.currentUser.nickname ? userStore.currentUser.nickname.slice(0, 1) : '我' }}</text>
						</view>
					</template>
				</view>
			</view>
		</scroll-view>

		<view class="input-area" :style="{ paddingBottom: keyboardHeight > 0 ? keyboardHeight + 'px' : 'calc(12px + env(safe-area-inset-bottom))' }">
			<view class="input-main">
				<IconFont name="camera" :size="32" class="add-btn" @click="chooseImage" />
				<view class="input-wrapper">
					<input
					class="input-box"
					v-model="inputText"
					type="text"
					placeholder="输入消息..."
					confirm-type="send"
					:adjust-position="false"
					@focus="onInputFocus"
					@blur="onInputBlur"
					@confirm="sendMessage"
				/>
				</view>
				<text class="emoji-btn" @click="toggleEmoji" style="font-size: 20px;">😀</text>
				<view
					class="send-btn"
					:class="{ active: inputText.trim() }"
					@click="sendMessage"
				>
					<text class="send-text">发送</text>
				</view>
			</view>
			<view class="emoji-picker" v-if="showEmoji" @click.stop>
				<scroll-view class="emoji-scroll" scroll-y>
					<view class="emoji-grid">
						<text v-for="(emoji, idx) in emojis" :key="idx" class="emoji-item" @click="insertEmoji(emoji)">{{ emoji }}</text>
					</view>
				</scroll-view>
			</view>
		</view>
	</view>
</template>

<script>
import { useUserStore } from '@/stores/user'
import IconFont from '@/components/icon-font/icon-font.vue'
import websocketService from '@/utils/websocket'

export default {
	components: {
		IconFont
	},
	setup() {
		const userStore = useUserStore()
		return { userStore }
	},
	data() {
		return {
			userId: '',
			nickname: '',
			inputText: '',
			messages: [],
			scrollTop: 0,
			isAtBottom: true,
			keyboardHeight: 0,
			showEmoji: false,
			emojis: ['😀', '😃', '😄', '😁', '😎', '🤩', '🥳', '😋', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '👍', '👎', '👏', '🙌', '🧡', '💙', '💚', '💛', '💜', '🧡', '💯', '🔥', '✨', '🌟', '💫', '⭐', '🎉', '🎊', '❤️‍🔥', '😘', '🥰', '😍', '😊', '😗', '😙', '🥹', '😭', '🤯', '🥵', '🥶', '😈', '👿', '💀', '☠️', '👻', '👽', '👾', '🤖', '🎨', '🎭', '🎪', '🎬', '🎤', '🎧', '🎸', '🎹', '🎺', '🎻', '🪘', '🥁', '🎷', '🎵', '🎶', '💃', '🕺', '🎡', '🎢', '🎠', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🏵️', '🎗️', '🎫', '🎟️', '🎁', '🎀', '🎈', '🎉', '🎊', '✨', '🌟', '💫', '⭐', '🪄', '🔮', '🧿', '💎', '💠', '🔵', '🟢', '🟡', '🔴', '🟣', '🟠', '🟤']
		}
	},
	onLoad(options) {
		this.userId = options.userId
		this.nickname = options.nickname || '邻居'
		this.loadMessages()
		this.markAsRead()
		this.initKeyboardListener()
		this.initWebSocket()
	},
	onShow() {
		this.loadMessages()
		this.initKeyboardListener()
	},
	onUnload() {
		this.removeWebSocketListeners()
		try {
			if (this.keyboardChangeCallback && uni.offKeyboardHeightChange) {
				uni.offKeyboardHeightChange(this.keyboardChangeCallback)
			}
		} catch (e) {
			console.log('移除键盘监听失败', e)
		}
	},
	methods: {
		initWebSocket() {
			websocketService.on('chat_message', this.handleIncomingMessage)
			websocketService.on('connect', this.onWsConnect)
			websocketService.on('disconnect', this.onWsDisconnect)
		},
		removeWebSocketListeners() {
			websocketService.off('chat_message', this.handleIncomingMessage)
			websocketService.off('connect', this.onWsConnect)
			websocketService.off('disconnect', this.onWsDisconnect)
		},
		handleIncomingMessage(payload) {
			if (payload.fromUserId == this.userId) {
				const msg = {
					id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
					type: payload.messageType || 'text',
					text: payload.content,
					imageUrl: payload.imageUrl,
					time: payload.timestamp || Date.now(),
					isSelf: false
				}
				this.messages.push(msg)
				this.saveMessages()
				this.$nextTick(() => {
					this.scrollToBottom(true)
				})
			}
		},
		onWsConnect() {
			console.log('Chat: WebSocket connected')
		},
		onWsDisconnect() {
			console.log('Chat: WebSocket disconnected')
		},
		initKeyboardListener() {
			this.keyboardChangeCallback = (res) => {
				this.keyboardHeight = res.height
				if (res.height > 0) {
					setTimeout(() => {
						this.scrollToBottom()
					}, 100)
				}
			}
			uni.onKeyboardHeightChange(this.keyboardChangeCallback)
		},
		onInputFocus() {
			setTimeout(() => {
				this.scrollToBottom()
			}, 300)
		},
		loadMessages() {
			try {
				const allMessages = uni.getStorageSync('chatMessages') || {}
				const key = this.getChatKey()
				this.messages = allMessages[key] || []
			} catch (e) {
				console.error('加载消息失败:', e)
				this.messages = []
			}
			this.$nextTick(() => {
				this.scrollToBottom(true)
			})
		},
		getChatKey() {
			const id1 = this.userStore.currentUser?.id || 'anonymous'
			const id2 = this.userId || 'unknown'
			const ids = [id1, id2].sort()
			return `chat_${ids[0]}_${ids[1]}`
		},
		saveMessages() {
			try {
				const allMessages = uni.getStorageSync('chatMessages') || {}
				const key = this.getChatKey()
				allMessages[key] = this.messages
				uni.setStorageSync('chatMessages', allMessages)
				this.updateConversation()
			} catch (e) {
				console.error('保存消息失败:', e)
				uni.showToast({ title: '消息保存失败', icon: 'none' })
			}
		},
		updateConversation() {
			try {
				const allConvs = uni.getStorageSync('conversations') || []
				const existingIndex = allConvs.findIndex(c => c.userId == this.userId)
				const lastMsg = this.messages.length > 0 ? this.messages[this.messages.length - 1] : null
				const conv = {
					id: `conv_${this.userId}`,
					userId: this.userId,
					nickname: this.nickname,
					lastMessage: lastMsg ? (lastMsg.type === 'text' ? lastMsg.text : '[图片]') : '',
					lastTime: Date.now(),
					unread: 0,
					online: true
				}

				if (existingIndex >= 0) {
					allConvs[existingIndex] = conv
				} else {
					allConvs.unshift(conv)
				}
				uni.setStorageSync('conversations', allConvs)
			} catch (e) {
				console.error('更新会话失败:', e)
			}
		},
		markAsRead() {
			const allConvs = uni.getStorageSync('conversations') || []
			const index = allConvs.findIndex(c => c.userId == this.userId)
			if (index >= 0) {
				allConvs[index].unread = 0
				uni.setStorageSync('conversations', allConvs)
			}
		},
		toggleEmoji() {
			this.showEmoji = !this.showEmoji
			if (this.showEmoji) {
				this.$nextTick(() => {
					document.activeElement?.blur()
				})
			}
		},
		insertEmoji(emoji) {
			this.inputText += emoji
		},
		sendMessage() {
			if (!this.inputText.trim()) return

			const msg = {
				id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
				type: 'text',
				text: this.inputText.trim(),
				time: Date.now(),
				isSelf: true
			}

			this.messages.push(msg)
			this.inputText = ''
			this.saveMessages()
			this.$nextTick(() => {
				this.scrollToBottom(true)
			})

			if (websocketService.isConnected) {
				websocketService.sendMessage(this.userId, msg.text, 'text')
			}
		},
		chooseImage() {
			uni.chooseImage({
				count: 1,
				sizeType: ['compressed'],
				sourceType: ['album', 'camera'],
				success: (res) => {
					const tempFilePath = res.tempFilePaths[0]
					this.sendImage(tempFilePath)
				}
			})
		},
		sendImage(imageUrl) {
			const msg = {
				id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
				type: 'image',
				imageUrl: imageUrl,
				time: Date.now(),
				isSelf: true
			}

			this.messages.push(msg)
			this.saveMessages()
			this.$nextTick(() => {
				this.scrollToBottom(true)
			})

			if (websocketService.isConnected) {
				websocketService.sendImageMessage(this.userId, imageUrl)
			}
		},
		previewImage(imageUrl) {
			uni.previewImage({
				urls: [imageUrl]
			})
		},
		scrollToBottom(force = false) {
			const query = uni.createSelectorQuery().in(this)
			query.select('.messages-wrapper').boundingClientRect()
			query.selectAll('.message-item').boundingClientRect()
			query.exec((res) => {
				if (res[0] && res[1] && res[1].length > 0) {
					const totalHeight = res[1].reduce((sum, item) => sum + item.height, 0) + (res[1].length - 1) * 16 + 100
					if (force || this.isAtBottom) {
						this.scrollTop = totalHeight + 1000
					} else {
						this.scrollTop = totalHeight
					}
				}
			})
		},
		getAvatarBg(name) {
			const colors = [
				'linear-gradient(135deg, #10B981, #34D399)',
				'linear-gradient(135deg, #3B82F6, #60A5FA)',
				'linear-gradient(135deg, #8B5CF6, #A78BFA)',
				'linear-gradient(135deg, #F59E0B, #FBBF24)',
				'linear-gradient(135deg, #EC4899, #F472B6)'
			]
			let hash = 0
			for (let i = 0; i < name.length; i++) {
				hash = name.charCodeAt(i) + ((hash << 5) - hash)
			}
			return colors[Math.abs(hash) % colors.length]
		},
		onScroll(e) {
			const scrollView = e.detail
			const scrollHeight = scrollView.scrollHeight
			const scrollTop = scrollView.scrollTop
			const clientHeight = scrollView.clientHeight
			this.isAtBottom = (scrollHeight - scrollTop - clientHeight) < 50
		},
		loadMore() {
		},
		formatTime(timestamp) {
			const date = new Date(timestamp)
			const hours = date.getHours().toString().padStart(2, '0')
			const minutes = date.getMinutes().toString().padStart(2, '0')
			return `${hours}:${minutes}`
		},
		goBack() {
			uni.navigateBack()
		}
	}
}
</script>

<style scoped>
.chat-container {
	height: 100vh;
	height: 100dvh;
	background: #F8FAFC;
	display: flex;
	flex-direction: column;
	overflow: hidden;
}

.header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 20px 24px;
	padding-top: 44px;
	background: #FFFFFF;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
	flex-shrink: 0;
}

.header-left {
	width: 44px;
}

.back-btn {
	font-size: 18px;
	color: #10B981;
	font-weight: 600;
	width: 44px;
}

.header-info {
	flex: 1;
	text-align: center;
}

.header-title {
	font-size: 17px;
	font-weight: 800;
	color: #1E293B;
	display: block;
}

.header-status {
	font-size: 11px;
	color: #10B981;
	font-weight: 600;
}

.header-right {
	width: 44px;
}

.message-list {
	flex: 1;
	padding: 16px 20px;
	box-sizing: border-box;
	overflow-y: auto;
	-webkit-overflow-scrolling: touch;
}

.empty-chat {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	flex: 1;
}

.empty-icon {
	margin-bottom: 16px;
	display: flex;
	align-items: center;
	justify-content: center;
}

.empty-text {
	font-size: 14px;
	color: #94A3B8;
}

.messages-wrapper {
	padding-bottom: 20px;
}

.message-item {
	display: flex;
	margin-bottom: 20px;
	align-items: flex-start;
	justify-content: flex-start;
}

.message-item.message-self {
	justify-content: flex-end;
}

.avatar {
	width: 36px;
	height: 36px;
	border-radius: 12px;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.self-avatar {
	background: linear-gradient(135deg, #10B981, #34D399);
}

.avatar-text {
	font-size: 15px;
	font-weight: 700;
	color: #FFFFFF;
}

.message-content {
	max-width: 70%;
	margin: 0 16px;
}

.self-content {
	display: flex;
	flex-direction: column;
	align-items: flex-end;
}

.bubble {
	border-radius: 20px;
	padding: 12px 16px;
	position: relative;
}

.bubble-other {
	background: #FFFFFF;
	border-bottom-left-radius: 6px;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.bubble-self {
	background: linear-gradient(135deg, #10B981, #059669);
	border-bottom-right-radius: 6px;
	box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25);
}

.bubble-text {
	font-size: 15px;
	color: #1E293B;
	line-height: 1.5;
}

.self-text {
	color: #FFFFFF;
}

.image-bubble {
	padding: 6px;
	background: #FFFFFF;
	border-radius: 16px;
}

.self-bubble {
	background: transparent;
}

.chat-image {
	max-width: 200px;
	border-radius: 12px;
}

.message-time {
	font-size: 11px;
	color: #94A3B8;
	margin-top: 6px;
	display: block;
}

.self-time {
	text-align: right;
}

.input-area {
	background: #FFFFFF;
	padding: 12px 20px;
	border-top: 1px solid #F1F5F9;
	z-index: 999;
}

.input-main {
	display: flex;
	align-items: center;
	gap: 12px;
}

.add-btn {
	width: 40px;
	height: 40px;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	cursor: pointer;
}

.input-wrapper {
	flex: 1;
	background: #F8FAFC;
	border-radius: 22px;
	border: 1px solid transparent;
	transition: all 0.3s;
	min-height: 44px;
	display: flex;
	align-items: center;
}

.input-wrapper:focus-within {
	background: #FFFFFF;
	border-color: #10B981;
	box-shadow: 0 4px 12px rgba(16, 185, 129, 0.1);
}

.input-box {
	flex: 1;
	padding: 10px 16px;
	font-size: 15px;
	font-weight: 600;
	color: #1E293B;
	border: none;
	outline: none;
	background: transparent;
	height: 44px;
	line-height: 24px;
}

.send-btn {
	width: 44px;
	height: 44px;
	background: #E2E8F0;
	border-radius: 22px;
	display: flex;
	align-items: center;
	justify-content: center;
	transition: all 0.3s;
	flex-shrink: 0;
}

.send-btn.active {
	background: linear-gradient(135deg, #10B981, #059669);
	box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35);
}

.send-text {
	font-size: 15px;
	font-weight: 700;
	color: #94A3B8;
}

.send-btn.active .send-text {
	color: #FFFFFF;
}

.send-icon {
	color: #FFFFFF;
	display: flex;
	align-items: center;
	justify-content: center;
}

.emoji-btn {
	font-size: 28px;
	padding: 8px;
	flex-shrink: 0;
}

.emoji-picker {
	background: #FFFFFF;
	border-top: 1px solid #E2E8F0;
	padding: 16px;
}

.emoji-scroll {
	max-height: 200px;
}

.emoji-grid {
	display: grid;
	grid-template-columns: repeat(8, 1fr);
	gap: 8px;
}

.emoji-item {
	font-size: 24px;
	text-align: center;
	padding: 6px;
	border-radius: 8px;
	transition: background 0.2s;
}

.emoji-item:active {
	background: #F1F5F9;
}
</style>