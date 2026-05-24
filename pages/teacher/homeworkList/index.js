const { formatDate } = require('../../../utils/util.js')

Page({
  data: {
    list: [],
    loading: false,
    error: ''
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().updateTabs()
    }
    this.loadData()
  },

  loadData() {
    this.setData({ loading: true, error: '' })
    wx.showLoading({ title: '加载中...' })
    wx.cloud.callFunction({ name: 'getHomeworkForReview' }).then(res => {
      wx.hideLoading()
      const r = res.result
      if (r.success) {
        const list = (r.homeworkList || []).map(item => ({
          ...item,
          publishTime: formatDate(item.publishTime),
          deadline: formatDate(item.deadline)
        }))
        this.setData({ list, loading: false })
      } else {
        this.setData({ loading: false, error: r.message || '加载失败' })
      }
    }).catch(err => {
      wx.hideLoading()
      this.setData({ loading: false, error: '网络异常，请检查网络后重试' })
      console.error('getHomeworkForReview error:', err)
    })
  },

  onLogin() {
    wx.redirectTo({ url: '/pages/login/index' })
  },

  goReview(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/teacher/reviewHomework/index?homeworkId=' + id })
  }
})
