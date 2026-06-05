// app.js
const cloud = require('./utils/cloud')

App({
  globalData: {
    userInfo: null,
    role: null
  },

  onLaunch() {
    cloud.init()
    console.log('已使用自建后端 API，非微信云开发')
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
