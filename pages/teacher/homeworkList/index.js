// pages/teacher/homeworkList/index.js
Page({
  data: { list: [] },

  onShow() { this.loadList() },

  loadList() {
    wx.cloud.callFunction({ name: 'getHomeworkList' }).then(res => {
      this.setData({ list: res.result?.homeworkList || [] })
    }).catch(() => {})
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/teacher/homeworkDetail/index?homeworkId=' + e.currentTarget.dataset.id })
  },

  goPublish() {
    wx.switchTab({ url: '/pages/teacher/publishHomework/index' })
  }
})
