// app.js
const cloudAdapter = require('./utils/cloud')

// 必须在 App 启动前覆盖 wx.cloud，否则会走微信云开发（报 -601034）
function installCloudAdapter() {
  wx.cloud = {
    init: cloudAdapter.init.bind(cloudAdapter),
    callFunction: cloudAdapter.callFunction.bind(cloudAdapter),
    uploadFile: cloudAdapter.uploadFile.bind(cloudAdapter)
  }
}

installCloudAdapter()

App({
  globalData: {
    userInfo: null,
    role: null
  },

  onLaunch() {
    wx.cloud.init()
    console.log('已使用自建后端，非微信云开发')
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
