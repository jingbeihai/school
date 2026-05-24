// pages/student/profile/index.js
const app = getApp()

const CARD_GRADIENTS = [
  ['#667eea', '#764ba2'],
  ['#f093fb', '#f5576c'],
  ['#4facfe', '#00f2fe'],
  ['#43e97b', '#38f9d7'],
  ['#fa709a', '#fee140'],
  ['#a18cd1', '#fbc2eb'],
  ['#fccb90', '#d57eeb'],
  ['#e0c3fc', '#8ec5fc'],
]

Page({
  data: {
    userInfo: {},
    classList: [],
    showJoinModal: false,
    showEditModal: false,
    inviteCode: '',
    joining: false,
    editNickName: '',
    editPhone: '',
    editAvatarUrl: '',
    editAvatarPath: '',
    saving: false
  },

  onShow() {
    // 每次显示时更新 tab bar
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().updateTabs()
    }
    this.loadData()
  },

  loadData() {
    const cached = app.globalData.userInfo || {}
    this.setData({ userInfo: cached })
    this.fetchClassList()
    if (!cached.avatarUrl) {
      this.syncUserInfo()
    }
  },

  syncUserInfo() {
    const role = wx.getStorageSync('role') || 'student'
    wx.cloud.callFunction({
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

  fetchClassList() {
    wx.cloud.callFunction({ name: 'getStudentClasses' }).then(res => {
      if (res.result.success) {
        const list = (res.result.list || []).map((item, i) => {
          const colors = CARD_GRADIENTS[i % CARD_GRADIENTS.length]
          const joinTime = item.joinTime ? this.formatDate(item.joinTime) : ''
          return { ...item, bgColor: colors[0], bgColor2: colors[1], joinTimeText: joinTime }
        })
        this.setData({ classList: list })
      }
    }).catch(err => console.error(err))
  },

  formatDate(dateStr) {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    const y = d.getFullYear()
    const m = (d.getMonth() + 1).toString().padStart(2, '0')
    const day = d.getDate().toString().padStart(2, '0')
    return y + '/' + m + '/' + day
  },

  // 退出登录
  onLogout() {
    wx.showModal({
      title: '确认退出',
      content: '退出后需要重新登录',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('userInfo')
          wx.removeStorageSync('role')
          app.globalData.userInfo = null
          app.globalData.role = null
          wx.redirectTo({ url: '/pages/login/index' })
        }
      }
    })
  },

  // 加入班级弹窗
  onJoinClass() {
    this.setData({ showJoinModal: true, inviteCode: '' })
  },
  onCloseJoinModal() {
    this.setData({ showJoinModal: false })
  },
  onInviteCodeInput(e) {
    this.setData({ inviteCode: e.detail.value })
  },
  onConfirmJoin() {
    const { inviteCode } = this.data
    if (!inviteCode.trim()) {
      wx.showToast({ title: '请输入邀请码', icon: 'none' })
      return
    }
    this.setData({ joining: true })
    wx.cloud.callFunction({
      name: 'joinClass',
      data: { inviteCode: inviteCode.trim() }
    }).then(res => {
      this.setData({ joining: false })
      if (res.result.success) {
        wx.showToast({ title: '加入成功', icon: 'success' })
        this.setData({ showJoinModal: false })
        this.fetchClassList()
      } else {
        wx.showToast({ title: res.result.message, icon: 'none' })
      }
    }).catch(() => {
      this.setData({ joining: false })
      wx.showToast({ title: '网络错误', icon: 'none' })
    })
  },

  // 修改个人信息弹窗
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
      const res = await wx.cloud.uploadFile({ cloudPath, filePath: tempPath })
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

      const res = await wx.cloud.callFunction({
        name: 'updateUserProfile',
        data: { role: userInfo.role, nickName: editNickName.trim(), phone: editPhone.trim(), avatarUrl: avatarUrl || undefined }
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

  // 打开班级详情
  onOpenClass(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/student/classDetail/index?classId=' + id })
  },

  // 长按退出班级
  onLeaveClass(e) {
    const id = e.currentTarget.dataset.id
    const name = e.currentTarget.dataset.name || '该班级'
    wx.showModal({
      title: '退出班级',
      content: '确定要退出「' + name + '」吗？退出后老师布置的作业将不再向你推送。',
      confirmText: '确定退出',
      confirmColor: '#e74c3c',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '退出中...' })
          wx.cloud.callFunction({
            name: 'leaveClass',
            data: { classId: id }
          }).then(res => {
            wx.hideLoading()
            if (res.result.success) {
              wx.showToast({ title: '已退出', icon: 'success' })
              this.fetchClassList()
            } else {
              wx.showToast({ title: res.result.message || '退出失败', icon: 'none' })
            }
          }).catch(() => {
            wx.hideLoading()
            wx.showToast({ title: '网络错误', icon: 'none' })
          })
        }
      }
    })
  }
})
