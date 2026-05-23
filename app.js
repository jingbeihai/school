// app.js
App({
  globalData: {
    userInfo: null,
    role: null
  },

  onLaunch() {
    // 初始化云开发环境
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        env: 'cloud1-d7gk7ix8d2ebbb913',
        traceUser: true
      })
    }

    // 检查登录状态
    this.checkLoginStatus()
  },

  // 检查登录状态，实现自动登录
  checkLoginStatus() {
    const userInfo = wx.getStorageSync('userInfo')
    const role = wx.getStorageSync('role')

    if (userInfo && role) {
      // 本地已有登录记录，直接使用
      this.globalData.userInfo = userInfo
      this.globalData.role = role
      console.log('自动登录成功，角色：', role)
      
      // 跳转到对应角色首页
      this.navigateByRole(role)
    } else {
      // 未登录，保持在登录页
      console.log('未登录，等待用户登录')
    }
  },

  // 根据角色跳转
  navigateByRole(role) {
    const pagePaths = {
      'teacher': '/pages/teacher/homeworkList/index',
      'student': '/pages/student/home/index',
      'parent': '/pages/parent/home/index'
    }

    const path = pagePaths[role]
    if (path) {
      if (role === 'teacher') {
        wx.switchTab({ url: path })
      } else {
        wx.redirectTo({ url: path })
      }
    }
  }
})
