const cloud = require('../../utils/cloud.js')
const config = require('../../utils/config.js')
// pages/parent/studentDetail/index.js
Page({
  data: {
    defaultAvatar: config.defaultAvatar,
    relationId: '',
    studentId: '',
    studentInfo: {},
    classList: [],
    studentName: ''
  },

  onLoad(options) {
    this.setData({
      relationId: options.relationId || '',
      studentId: options.studentId || ''
    })
    this.loadData()
  },

  loadData() {
    wx.showLoading({ title: '加载中' })
    cloud.callFunction({
      name: 'getParentStudentDetail',
      data: {
        relationId: this.data.relationId,
        studentId: this.data.studentId
      }
    }).then(res => {
      wx.hideLoading()
      if (res.result.success) {
        const studentInfo = res.result.studentInfo || {}
        const createTime = studentInfo.createTime ? this.formatDate(studentInfo.createTime) : ''
        const classList = (res.result.classList || []).map(item => ({
          ...item
        }))
        this.setData({
          studentInfo: { ...studentInfo, createTimeStr: createTime },
          classList,
          studentName: studentInfo.nickName || '学生'
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

  // 复制识别码
  onCopyCode() {
    wx.setClipboardData({
      data: this.data.studentInfo.userCode || '',
      success: () => wx.showToast({ title: '已复制' })
    })
  },

  // 解除关联
  onUnlink() {
    const name = this.data.studentName
    wx.showModal({
      title: '解除关联',
      content: '确定要解除与「' + name + '」的关联吗？解除后将无法查看该学生的作业信息。',
      confirmText: '确定解除',
      confirmColor: '#e74c3c',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '解除中...' })
          cloud.callFunction({
            name: 'unlinkStudent',
            data: { studentId: this.data.studentId, relationId: this.data.relationId }
          }).then(res => {
            wx.hideLoading()
            if (res.result.success) {
              wx.showToast({ title: '已解除', icon: 'success' })
              setTimeout(() => wx.navigateBack(), 1500)
            } else {
              wx.showToast({ title: res.result.message || '操作失败', icon: 'none' })
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
