// pages/student/classDetail/index.js
Page({
  data: {
    classId: '',
    classInfo: {},
    teacherInfo: {}
  },

  onLoad(options) {
    this.setData({ classId: options.classId || '' })
    this.loadData()
  },

  loadData() {
    wx.showLoading({ title: '加载中' })
    wx.cloud.callFunction({
      name: 'getStudentClassDetail',
      data: { classId: this.data.classId }
    }).then(res => {
      wx.hideLoading()
      if (res.result.success) {
        const info = res.result.classInfo
        info.createTimeStr = this.formatDate(info.createTime)
        info.joinTimeStr = this.formatDate(info.joinTime)
        this.setData({
          classInfo: info,
          teacherInfo: res.result.teacherInfo || {}
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

  // 退出班级
  onLeaveClass() {
    const name = this.data.classInfo.name || '该班级'
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
            data: { classId: this.data.classId }
          }).then(res => {
            wx.hideLoading()
            if (res.result.success) {
              wx.showToast({ title: '已退出', icon: 'success' })
              setTimeout(() => wx.navigateBack(), 1500)
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
