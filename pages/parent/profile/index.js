const cloud = require('../../utils/cloud')
// pages/parent/profile/index.js
const app = getApp()

const CARD_GRADIENTS = [
  ['#667eea', '#764ba2'],
  ['#f093fb', '#f5576c'],
  ['#4facfe', '#00f2fe'],
  ['#43e97b', '#38f9d7'],
  ['#fa709a', '#fee140'],
  ['#a18cd1', '#fbc2eb'],
  ['#fccb90', '#d57eeb'],
  ['#e0c3fc', '#8ec5fc']
]

Page({
  data: {
    userInfo: {},
    studentList: [],
    showLinkModal: false,
    showEditModal: false,
    studentCode: '',
    linking: false,
    editNickName: '',
    editPhone: '',
    editAvatarUrl: '',
    editAvatarPath: '',
    saving: false
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().updateTabs()
    }
    this.loadData()
  },

  loadData() {
    const cached = app.globalData.userInfo || wx.getStorageSync('userInfo') || {}
    this.setData({ userInfo: cached })
    this.fetchStudentList()
    if (!cached.avatarUrl) {
      this.syncUserInfo()
    }
  },

  syncUserInfo() {
    const role = wx.getStorageSync('role') || 'parent'
    cloud.callFunction({
      name: 'login',
      data: { role, nickName: '', avatarUrl: '' }
    }).then(res => {
      if (res.result.success) {
        const ui = res.result.userInfo
        wx.setStorageSync('userInfo', ui)
        wx.setStorageSync('role', ui.role)
        app.globalData.userInfo = ui
        app.globalData.role = ui.role
        this.setData({ userInfo: ui })
      }
    }).catch(() => {})
  },

  fetchStudentList() {
    cloud.callFunction({ name: 'getParentStudents' }).then(res => {
      if (res.result.success) {
        const students = (res.result.students || []).map((item, i) => {
          const pair = CARD_GRADIENTS[i % CARD_GRADIENTS.length]
          return { ...item, bgColor: pair[0], bgColor2: pair[1] }
        })
        this.setData({ studentList: students })
      }
    }).catch(() => {
      wx.showToast({ title: '加载失败', icon: 'none' })
    })
  },

  // ===== 退出登录 =====
  onLogout() {
    wx.showModal({
      title: '确认退出',
      content: '退出后需要重新登录',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('userInfo')
          wx.removeStorageSync('role')
          wx.removeStorageSync('token')
          app.globalData.userInfo = null
          app.globalData.role = null
          wx.redirectTo({ url: '/pages/login/index' })
        }
      }
    })
  },

  // ===== 关联学生弹窗 =====
  onLinkStudent() {
    this.setData({ showLinkModal: true, studentCode: '' })
  },
  onCloseLinkModal() {
    this.setData({ showLinkModal: false })
  },
  onCodeInput(e) {
    this.setData({ studentCode: e.detail.value })
  },
  onConfirmLink() {
    const code = this.data.studentCode.trim()
    if (!code || code.length !== 6) {
      wx.showToast({ title: '请输入6位识别码', icon: 'none' })
      return
    }
    this.setData({ linking: true })
    cloud.callFunction({
      name: 'linkStudent',
      data: { code }
    }).then(res => {
      this.setData({ linking: false })
      if (res.result.success) {
        wx.showToast({ title: '关联成功', icon: 'success' })
        this.setData({ showLinkModal: false })
        this.fetchStudentList()
      } else {
        wx.showToast({ title: res.result.message || '关联失败', icon: 'none' })
      }
    }).catch(() => {
      this.setData({ linking: false })
      wx.showToast({ title: '网络错误', icon: 'none' })
    })
  },

  // ===== 修改个人信息弹窗 =====
  onEditProfile() {
    const { userInfo } = this.data
    this.setData({
      showEditModal: true,
      editAvatarUrl: userInfo.avatarUrl || '',
      editAvatarPath: '',
      editNickName: userInfo.nickName || '',
      editPhone: userInfo.phone || ''
    })
  },
  onCloseEditModal() {
    this.setData({ showEditModal: false })
  },
  onEditNickNameInput(e) {
    this.setData({ editNickName: e.detail.value })
  },
  onEditPhoneInput(e) {
    this.setData({ editPhone: e.detail.value })
  },
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail
    this.setData({ editAvatarUrl: avatarUrl, editAvatarPath: avatarUrl })
  },
  async uploadAvatar(tempPath) {
    const cloudPath = 'avatars/' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.png'
    try {
      const res = await cloud.uploadFile({ cloudPath, filePath: tempPath })
      return res.fileID
    } catch (err) {
      console.error('上传头像失败:', err)
      return ''
    }
  },
  async onConfirmEdit() {
    const { editNickName, editPhone, editAvatarPath, userInfo } = this.data
    this.setData({ saving: true })

    try {
      let avatarUrl = ''
      if (editAvatarPath) {
        wx.showLoading({ title: '上传头像...' })
        avatarUrl = await this.uploadAvatar(editAvatarPath)
        wx.hideLoading()
        if (!avatarUrl) {
          this.setData({ saving: false })
          wx.showToast({ title: '头像上传失败', icon: 'none' })
          return
        }
      }

      const res = await cloud.callFunction({
        name: 'updateUserProfile',
        data: {
          role: userInfo.role || 'parent',
          nickName: editNickName.trim(),
          phone: editPhone.trim(),
          avatarUrl: avatarUrl || undefined
        }
      })

      this.setData({ saving: false })
      if (res.result.success) {
        wx.showToast({ title: '保存成功', icon: 'success' })
        const newUserInfo = res.result.userInfo
        wx.setStorageSync('userInfo', newUserInfo)
        app.globalData.userInfo = newUserInfo
        this.setData({ userInfo: newUserInfo, showEditModal: false })
      } else {
        wx.showToast({ title: res.result.message, icon: 'none' })
      }
    } catch (err) {
      this.setData({ saving: false })
      wx.hideLoading()
      wx.showToast({ title: '网络错误', icon: 'none' })
    }
  },

  // ===== 打开学生详情 =====
  onStudentDetail(e) {
    const { id, studentid } = e.currentTarget.dataset
    wx.navigateTo({
      url: '/pages/parent/studentDetail/index?relationId=' + id + '&studentId=' + studentid
    })
  }
})
