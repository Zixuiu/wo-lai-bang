<script setup>
import { ref, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import apiService from '@/utils/api'
import websocketService from '@/utils/websocket'

const NEED_LOGIN_PAGES = [
  '/pages/orders/orders',
  '/pages/wallet/wallet',
  '/pages/messages/messages',
  '/pages/recharge/recharge',
  '/pages/withdraw/withdraw',
  '/pages/transfer/transfer',
  '/pages/profile/profile',
  '/pages/edit-profile/edit-profile',
  '/pages/settings/settings',
  '/pages/verify/verify',
  '/pages/order-detail/order-detail',
  '/pages/accept-order/accept-order',
  '/pages/rate/rate',
  '/pages/skills/skills',
  '/pages/blacklist/blacklist',
  '/pages/received-help/received-help',
  '/pages/rating-history/rating-history',
  '/pages/notification-settings/notification-settings',
  '/pages/feedback/feedback',
  '/pages/transaction/transaction',
  '/pages/bind-alipay/bind-alipay',
  '/pages/bind-bank/bind-bank',
  '/pages/complaint/complaint',
  '/pages/complaint-list/complaint-list',
  '/pages/complaint-detail/complaint-detail'
]

const privacyModalVisible = ref(false)
const userStore = useUserStore()

onMounted(() => {
  console.log('App Launch')
  initServices()
  checkPrivacyAgreement()
})

function initServices() {
  apiService.init()
}

function checkPrivacyAgreement() {
  const hasAgreed = uni.getStorageSync('hasAgreedPrivacyPolicy')
  if (!hasAgreed) {
    privacyModalVisible.value = true
  }
}

function confirmPrivacy() {
  uni.setStorageSync('hasAgreedPrivacyPolicy', true)
  privacyModalVisible.value = false
}

function viewPrivacyPolicy() {
  console.log('View privacy policy')
}

function preventClose() {}
</script>

<template>
  <view id="app">
    <privacy-modal v-if="privacyModalVisible" @close="confirmPrivacy" @view="viewPrivacyPolicy" />
  </view>
</template>

<style>
@import "./static/css/common.css";

.privacy-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.privacy-modal {
  width: 640rpx;
  max-height: 80vh;
  background: #F8FAFC;
  border-radius: 24rpx;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20rpx 60rpx rgba(0, 0, 0, 0.15);
}

.privacy-header {
  padding: 40rpx 40rpx 20rpx;
  text-align: center;
}

.privacy-title {
  font-size: 36rpx;
  font-weight: 800;
  color: #1E293B;
}

.privacy-content {
  flex: 1;
  padding: 0 40rpx;
  max-height: 50vh;
  overflow-y: auto;
}

.privacy-desc {
  font-size: 28rpx;
  color: #64748B;
  line-height: 1.6;
  display: block;
  margin-bottom: 30rpx;
}

.privacy-item {
  background: #ECFDF5;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
}

.privacy-item-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #059669;
  display: block;
  margin-bottom: 12rpx;
}

.privacy-item-text {
  font-size: 26rpx;
  color: #64748B;
  line-height: 1.5;
  display: block;
}

.privacy-tip {
  font-size: 24rpx;
  color: #94A3B8;
  line-height: 1.6;
  display: block;
  margin-top: 20rpx;
  margin-bottom: 30rpx;
}

.privacy-footer {
  padding: 20rpx 40rpx 40rpx;
}

.privacy-link {
  text-align: center;
  margin-bottom: 20rpx;
}

.privacy-link-text {
  font-size: 28rpx;
  color: #10B981;
  text-decoration: underline;
}

.privacy-btn {
  width: 100%;
  height: 96rpx;
  background: linear-gradient(135deg, #10B981, #059669);
  color: #FFFFFF;
  font-size: 32rpx;
  font-weight: 800;
  border-radius: 48rpx;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 20rpx rgba(16, 185, 129, 0.25);
  cursor: pointer;
}
</style>
