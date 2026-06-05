const cloud = require('../../utils/cloud.js')
const config = require('../../utils/config.js')
// pages/teacher/classDetail/index.js
const app = getApp()

Page({
  data: {
    defaultAvatar: config.defaultAvatar,
    classId: '',
    classInfo: null,
    students: [],
    // 弹窗
    showEditModal: false,
    showAddModal: false,
    showStudentModal: false,
    editName: '',
    addUserCode: '',
    saving: false,
    adding: false,
    currentStudentId: '',
    studentDetail: {}
  },

  onLoad(options) {
    if (options.classId) {
      this.setData({ classId: options.classId })
      this.fetchDetail()
    }
  },

  onShow() {
    if (this.data.classId) this.fetchDetail()
  },

  fetchDetail() {
    wx.showLoading({ title: '加载中' })
    cloud.callFunction({
      name: 'getClassDetail',
      data: { classId: this.data.classId }
    }).then(res => {
      wx.hideLoading()
      if (res.result.success) {
        const info = res.result.classInfo
        info.createTimeStr = this.formatDate(info.createTime)
        this.setData({
          classInfo: info,
          students: res.result.students
        })
      } else {
        wx.showToast({ title: res.result.message, icon: 'none' })
      }
    }).catch(() => {
      wx.hideLoading()
      wx.showToast({ title: '网络错误', icon: 'none' })
    })
  },

  formatDate(date) {
    if (!date) return ''
    const d = new Date(date)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  },

  // 复制邀请码
  onCopyInviteCode() {
    wx.setClipboardData({
      data: this.data.classInfo.inviteCode,
      success: () => wx.showToast({ title: '已复制' })
    })
  },

  // 修改班级名
  onEditClassName() {
    this.setData({
      showEditModal: true,
      editName: this.data.classInfo.name
    })
  },
  onCloseEditModal() { this.setData({ showEditModal: false }) },
  onEditNameInput(e) { this.setData({ editName: e.detail.value }) },
  onConfirmEdit() {
    const name = this.data.editName.trim()
    if (!name) return wx.showToast({ title: '请输入名称', icon: 'none' })
    this.setData({ saving: true })
    cloud.callFunction({
      name: 'updateClass',
      data: { classId: this.data.classId, name }
    }).then(res => {
      this.setData({ saving: false })
      if (res.result.success) {
        wx.showToast({ title: '已修改', icon: 'success' })
        this.setData({ showEditModal: false })
        this.fetchDetail()
      } else {
        wx.showToast({ title: res.result.message, icon: 'none' })
      }
    }).catch(() => {
      this.setData({ saving: false })
      wx.showToast({ title: '网络错误', icon: 'none' })
    })
  },

  // 添加学生弹窗
  onShowAddStudent() {
    this.setData({ showAddModal: true, addUserCode: '' })
  },
  onCloseAddModal() { this.setData({ showAddModal: false }) },
  onAddCodeInput(e) { this.setData({ addUserCode: e.detail.value }) },
  onConfirmAdd() {
    const code = this.data.addUserCode.trim()
    if (!code || code.length !== 6) {
      wx.showToast({ title: '请输入6位编号', icon: 'none' })
      return
    }
    this.setData({ adding: true })
    cloud.callFunction({
      name: 'addStudentToClass',
      data: { classId: this.data.classId, userCode: code }
    }).then(res => {
      this.setData({ adding: false })
      if (res.result.success) {
        wx.showToast({ title: '添加成功', icon: 'success' })
        this.setData({ showAddModal: false })
        this.fetchDetail()
      } else {
        wx.showToast({ title: res.result.message, icon: 'none' })
      }
    }).catch(() => {
      this.setData({ adding: false })
      wx.showToast({ title: '网络错误', icon: 'none' })
    })
  },

  // 学生详情
  onStudentTap(e) {
    const id = e.currentTarget.dataset.id
    const name = e.currentTarget.dataset.name
    wx.showLoading({ title: '加载中' })
    cloud.callFunction({
      name: 'getStudentDetail',
      data: { studentId: id, classId: this.data.classId }
    }).then(res => {
      wx.hideLoading()
      if (res.result.success) {
        this.setData({
          showStudentModal: true,
          currentStudentId: id,
          studentDetail: { studentName: name, ...res.result.student }
        })
      } else {
        wx.showToast({ title: res.result.message, icon: 'none' })
      }
    }).catch(() => {
      wx.hideLoading()
      wx.showToast({ title: '网络错误', icon: 'none' })
    })
  },
  onCloseStudentModal() { this.setData({ showStudentModal: false }) },

  // 移除学生
  onRemoveStudent() {
    wx.showModal({
      title: '确认移除',
      content: '确定要从班级中移除该学生吗？',
      success: (res) => {
        if (res.confirm) {
          cloud.callFunction({
            name: 'removeStudentFromClass',
            data: { classId: this.data.classId, studentId: this.data.currentStudentId }
          }).then(res => {
            if (res.result.success) {
              wx.showToast({ title: '已移除', icon: 'success' })
              this.setData({ showStudentModal: false })
              this.fetchDetail()
            } else {
              wx.showToast({ title: res.result.message, icon: 'none' })
            }
          }).catch(() => wx.showToast({ title: '网络错误', icon: 'none' }))
        }
      }
    })
  },

  // 删除班级
  onDeleteClass() {
    wx.showModal({
      title: '确认删除',
      content: '删除班级将同时移除所有学生，确定吗？',
      confirmColor: '#e74c3c',
      success: (res) => {
        if (res.confirm) {
          cloud.callFunction({
            name: 'deleteClass',
            data: { classId: this.data.classId }
          }).then(res => {
            if (res.result.success) {
              wx.showToast({ title: '已删除', icon: 'success' })
              setTimeout(() => wx.navigateBack(), 1500)
            } else {
              wx.showToast({ title: res.result.message, icon: 'none' })
            }
          }).catch(() => wx.showToast({ title: '网络错误', icon: 'none' }))
        }
      }
    })
  }
})
