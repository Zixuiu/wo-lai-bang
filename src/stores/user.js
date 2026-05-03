import { defineStore } from 'pinia'
import { userApi } from '@/api/user'
import { walletApi } from '@/api/wallet'

const DEFAULT_USER = {
  id: '',
  nickname: '',
  phone: '',
  avatar: '',
  reputation: 0,
  completedOrders: 0,
  walletBalance: 0,
  walletLevel: 1,
  sharedNeeds: [],
  commissionEarned: 0,
  invitedUsers: [],
  skills: [],
  verified: false
}

function getStoredUser() {
  const isLoggedIn = uni.getStorageSync('isLoggedIn')
  if (isLoggedIn) {
    const userInfo = uni.getStorageSync('userInfo')
    if (userInfo) return userInfo
  }
  return { ...DEFAULT_USER }
}

export const useUserStore = defineStore('user', {
  state: () => ({
    isLoggedIn: uni.getStorageSync('isLoggedIn') || false,
    currentUser: getStoredUser(),
    walletInfo: null,
    token: uni.getStorageSync('token') || '',
    refreshToken: uni.getStorageSync('refreshToken') || ''
  }),

  getters: {
    isAuthenticated: (state) => state.isLoggedIn && !!state.token,

    walletBalance: (state) => {
      if (state.walletInfo && state.walletInfo.balance !== undefined) {
        return parseFloat(state.walletInfo.balance) || 0
      }
      const wallet = uni.getStorageSync('wallet') || {}
      return parseFloat(wallet.balance) || state.currentUser?.walletBalance || 0
    },

    commissionEarned: (state) => {
      return state.currentUser?.commissionEarned || 0
    },

    hasPayPassword: () => {
      return !!uni.getStorageSync('payPasswordSet')
    },

    userId: (state) => state.currentUser?.id || ''
  },

  actions: {
    async login(phone, password) {
      try {
        const data = await userApi.login(phone, password)
        this.setAuthData(data)
        return data
      } catch (e) {
        throw e
      }
    },

    async register(userInfo) {
      try {
        const data = await userApi.register(userInfo)
        this.setAuthData(data)
        return data
      } catch (e) {
        throw e
      }
    },

    setAuthData(data) {
      if (data.token) {
        this.token = data.token
        uni.setStorageSync('token', data.token)
      }
      if (data.refreshToken) {
        this.refreshToken = data.refreshToken
        uni.setStorageSync('refreshToken', data.refreshToken)
      }
      if (data.user) {
        this.currentUser = data.user
        uni.setStorageSync('userInfo', data.user)
      }
      this.isLoggedIn = true
      uni.setStorageSync('isLoggedIn', true)
    },

    async fetchUserInfo() {
      try {
        const userInfo = await userApi.getUserInfo()
        this.currentUser = userInfo
        uni.setStorageSync('userInfo', userInfo)
        return userInfo
      } catch (e) {
        console.error('fetchUserInfo failed', e)
        throw e
      }
    },

    async updateUserInfo(userInfo) {
      try {
        const updated = await userApi.updateUserInfo(userInfo)
        this.currentUser = { ...this.currentUser, ...updated }
        uni.setStorageSync('userInfo', this.currentUser)
        return updated
      } catch (e) {
        throw e
      }
    },

    async fetchWalletInfo() {
      try {
        const wallet = await walletApi.getWalletInfo()
        this.walletInfo = wallet
        uni.setStorageSync('wallet', wallet)
        this.currentUser.walletBalance = parseFloat(wallet.balance) || 0
        return wallet
      } catch (e) {
        console.error('fetchWalletInfo failed', e)
        const wallet = uni.getStorageSync('wallet') || { balance: 0 }
        this.walletInfo = wallet
        return wallet
      }
    },

    updateWalletBalance(balance) {
      if (this.walletInfo) {
        this.walletInfo.balance = balance
      }
      this.currentUser.walletBalance = balance
      const wallet = uni.getStorageSync('wallet') || {}
      wallet.balance = balance
      uni.setStorageSync('wallet', wallet)
    },

    syncWalletBalance() {
      if (this.walletInfo) {
        const balance = parseFloat(this.walletInfo.balance) || 0
        this.currentUser.walletBalance = balance
      }
    },

    logout() {
      this.isLoggedIn = false
      this.currentUser = { ...DEFAULT_USER }
      this.walletInfo = null
      this.token = ''
      this.refreshToken = ''

      uni.removeStorageSync('token')
      uni.removeStorageSync('refreshToken')
      uni.removeStorageSync('isLoggedIn')
      uni.removeStorageSync('userInfo')
      uni.removeStorageSync('wallet')
    },

    setLoggedIn(status) {
      this.isLoggedIn = status
      uni.setStorageSync('isLoggedIn', status)
    },

    setUserInfo(userInfo) {
      this.currentUser = userInfo
      uni.setStorageSync('userInfo', userInfo)
    },

    setPayPasswordSet() {
      uni.setStorageSync('payPasswordSet', true)
    },

    addSharedNeed(needId, needTitle, reward) {
      if (!this.currentUser.sharedNeeds) {
        this.currentUser.sharedNeeds = []
      }
      this.currentUser.sharedNeeds.push({
        needId,
        needTitle,
        reward,
        sharedAt: Date.now(),
        earned: 0
      })
      uni.setStorageSync('userInfo', this.currentUser)
    },

    addCommission(amount, orderTitle) {
      if (!this.currentUser.commissionEarned) {
        this.currentUser.commissionEarned = 0
      }
      this.currentUser.commissionEarned += amount

      const wallet = uni.getStorageSync('wallet') || { balance: 0 }
      wallet.balance = parseFloat(wallet.balance || 0) + amount
      uni.setStorageSync('wallet', wallet)

      if (this.walletInfo) {
        this.walletInfo.balance = wallet.balance
      }

      if (this.currentUser.sharedNeeds && this.currentUser.sharedNeeds.length > 0) {
        const sharedNeed = this.currentUser.sharedNeeds.find(sn => sn.needTitle === orderTitle)
        if (sharedNeed) {
          sharedNeed.earned = (sharedNeed.earned || 0) + amount
        }
      }

      uni.setStorageSync('userInfo', this.currentUser)
    }
  }
})
