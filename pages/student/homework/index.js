// pages/student/homework/index.js
const { formatDate } = require('../../../utils/util.js')

Page({
  data: {
    list: [],
    loading: false
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().updateTabs()
    }
    this.loadData()
  },

  loadData() {
    this.setData({ loading: true })
    wx.cloud.callFunction({ name: 'getStudentHomeworkList' }).then(res => {
      this.setData({ loading: false })
      if (res.result.success) {
        const list = (res.result.list || []).map(item => ({
          ...item,
          publishTime: formatDate(item.publishTime),
          deadline: formatDate(item.deadline)
        }))
        this.setData({ list })
      }
    }).catch(() => {
      this.setData({ loading: false })
    })
  },

  // 进入作业
  goHomework(e) {
    const id = e.currentTarget.dataset.id
    const answered = parseInt(e.currentTarget.dataset.answered) || 0
    const total = parseInt(e.currentTarget.dataset.total) || 0
    const submitted = (answered >= total && total > 0) ? '1' : '0'
    wx.navigateTo({ url: '/pages/student/homeworkDetail/index?homeworkId=' + id + '&submitted=' + submitted })
  }
})
