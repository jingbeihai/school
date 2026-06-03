// app.js
const cloudAdapter = require('./utils/cloud')

App({
  globalData: {
    userInfo: null,
    role: null
  },

  onLaunch() {
    // 使用自建后端替代微信云开发
    wx.cloud = cloudAdapter
    wx.cloud.init()

    this.checkLoginStatus()
  },

  checkLoginStatus() {
    const userInfo = wx.getStorageSync('userInfo')
    const role = wx.getStorageSync('role')
    const token = wx.getStorageSync('token')

    if (userInfo && role && token) {
      this.globalData.userInfo = userInfo
      this.globalData.role = role
      console.log('自动登录成功，角色：', role)
      this.navigateByRole(role)
    } else {
      console.log('未登录，等待用户登录')
    }
  },

  navigateByRole(role) {
    const pagePaths = {
      'teacher': '/pages/teacher/homeworkList/index',
      'student': '/pages/student/homework/index',
      'parent': '/pages/parent/homework/index'
    }

    const path = pagePaths[role]
    if (path) {
      if (role === 'teacher' || role === 'student' || role === 'parent') {
        wx.switchTab({ url: path })
      } else {
        wx.redirectTo({ url: path })
      }
    }
  }
})
