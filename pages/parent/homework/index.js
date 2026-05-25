// pages/parent/homework/index.js
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
    wx.cloud.callFunction({ name: 'getParentHomeworkList' }).then(res => {
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

  // 进入作业详情
  goHomework(e) {
    const id = e.currentTarget.dataset.id
    const studentId = e.currentTarget.dataset.studentId
    const studentName = e.currentTarget.dataset.studentName
    wx.navigateTo({ url: '/pages/parent/homeworkDetail/index?homeworkId=' + id + '&studentId=' + (studentId || '') + '&studentName=' + encodeURIComponent(studentName || '') })
  }
})
