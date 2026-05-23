// pages/login/index.js
const app = getApp()

Page({
  data: {
    selectedRole: '',  // teacher | student | parent
    isLoading: false
  },

  // 角色选择
  onRoleSelect(e) {
    const role = e.currentTarget.dataset.role
    this.setData({ selectedRole: role })
  },

  // 登录按钮点击
  onLogin() {
    const { selectedRole, isLoading } = this.data

    // 防止重复点击
    if (isLoading) return

    // 校验角色
    if (!selectedRole) {
      wx.showToast({ title: '请先选择角色', icon: 'none' })
      return
    }

    this.setData({ isLoading: true })

    // 调用 wx.getUserProfile 获取头像和昵称
    wx.getUserProfile({
      desc: '用于完善个人资料',
      success: (profileRes) => {
        const { nickName, avatarUrl } = profileRes.userInfo
        this.doLogin(selectedRole, nickName, avatarUrl)
      },
      fail: () => {
        // 用户拒绝授权，依然可以登录（昵称和头像为空）
        this.doLogin(selectedRole, '', '')
      }
    })
  },

  // 执行登录
  doLogin(role, nickName, avatarUrl) {
    wx.cloud.callFunction({
      name: 'login',
      data: { role, nickName, avatarUrl }
    }).then(res => {
      this.setData({ isLoading: false })

      const result = res.result

      if (result.success) {
        const { userInfo } = result

        // 存入本地存储
        wx.setStorageSync('userInfo', userInfo)
        wx.setStorageSync('role', userInfo.role)

        // 存入全局数据
        app.globalData.userInfo = userInfo
        app.globalData.role = userInfo.role

        // 提示登录成功
        wx.showToast({
          title: '登录成功',
          icon: 'success',
          duration: 1500
        })

        // 延迟跳转到对应首页
        setTimeout(() => {
          this.navigateByRole(userInfo.role)
        }, 1500)

      } else {
        wx.showModal({
          title: '登录失败',
          content: result.message || '请重试',
          showCancel: false
        })
      }
    }).catch(err => {
      this.setData({ isLoading: false })
      console.error('云函数调用失败：', err)
      wx.showModal({
        title: '网络错误',
        content: '请检查网络后重试',
        showCancel: false
      })
    })
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
      // tabBar 页面必须用 switchTab
      if (role === 'teacher') {
        wx.switchTab({ url: path })
      } else {
        wx.redirectTo({ url: path })
      }
    } else {
      wx.showToast({ title: '登录成功，首页开发中', icon: 'none' })
    }
  }
})
