// pages/teacher/profile/index.js
const app = getApp()

Page({
  data: {
    userInfo: {},
    classList: [],
    showCreateModal: false,
    showEditModal: false,
    newClassName: '',
    newInviteCode: '',
    creating: false,
    editNickName: '',
    editPhone: '',
    saving: false
  },

  onShow() {
    this.loadData()
  },

  loadData() {
    this.setData({ userInfo: app.globalData.userInfo || {} })
    this.fetchClassList()
  },

  // 获取班级列表
  fetchClassList() {
    wx.cloud.callFunction({ name: 'getClassList' }).then(res => {
      if (res.result.success) {
        this.setData({ classList: res.result.list })
      }
    }).catch(err => console.error(err))
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

  // 新建班级弹窗
  onCreateClass() {
    this.setData({ showCreateModal: true, newClassName: '', newInviteCode: '' })
  },
  onCloseCreateModal() {
    this.setData({ showCreateModal: false })
  },
  onClassNameInput(e) {
    this.setData({ newClassName: e.detail.value })
  },
  onInviteCodeInput(e) {
    this.setData({ newInviteCode: e.detail.value })
  },
  onConfirmCreate() {
    const { newClassName, newInviteCode } = this.data
    if (!newClassName.trim()) {
      wx.showToast({ title: '请输入班级名称', icon: 'none' })
      return
    }
    this.setData({ creating: true })
    wx.cloud.callFunction({
      name: 'createClass',
      data: { name: newClassName.trim(), inviteCode: newInviteCode.trim() || undefined }
    }).then(res => {
      this.setData({ creating: false })
      if (res.result.success) {
        wx.showToast({ title: '创建成功', icon: 'success' })
        this.setData({ showCreateModal: false })
        this.fetchClassList()
      } else {
        wx.showToast({ title: res.result.message, icon: 'none' })
      }
    }).catch(() => {
      this.setData({ creating: false })
      wx.showToast({ title: '网络错误', icon: 'none' })
    })
  },

  // 修改个人信息弹窗
  onEditProfile() {
    const { userInfo } = this.data
    this.setData({
      showEditModal: true,
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
  onConfirmEdit() {
    const { editNickName, editPhone } = this.data
    this.setData({ saving: true })
    wx.cloud.callFunction({
      name: 'updateUserProfile',
      data: { nickName: editNickName.trim(), phone: editPhone.trim() }
    }).then(res => {
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
    }).catch(() => {
      this.setData({ saving: false })
      wx.showToast({ title: '网络错误', icon: 'none' })
    })
  },

  // 打开班级详情
  onOpenClass(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/teacher/classDetail/index?classId=' + id })
  }
})
