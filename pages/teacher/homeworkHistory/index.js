// pages/teacher/homeworkHistory/index.js
const { formatDate } = require('../../../utils/util.js')

Page({
  data: { list: [] },

  onShow() { this.loadList() },

  loadList() {
    wx.showLoading({ title: '加载中' })
    wx.cloud.callFunction({ name: 'getHomeworkList' }).then(res => {
      wx.hideLoading()
      const list = (res.result?.homeworkList || []).map(item => ({
        ...item,
        publishTime: formatDate(item.publishTime),
        deadline: formatDate(item.deadline)
      }))
      this.setData({ list })
    }).catch(() => { wx.hideLoading() })
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/teacher/homeworkDetail/index?homeworkId=' + e.currentTarget.dataset.id })
  },

  onDelete(e) {
    const { id, title } = e.currentTarget.dataset
    wx.showModal({
      title: '删除作业',
      content: `确认删除"${title}"吗？题目不会被删除。`,
      success: res => {
        if (res.confirm) {
          wx.cloud.callFunction({ name: 'deleteHomework', data: { homeworkId: id } }).then(r => {
            if (r.result.success) {
              wx.showToast({ title: '已删除', icon: 'success' })
              this.loadList()
            } else {
              wx.showToast({ title: r.result.message, icon: 'none' })
            }
          })
        }
      }
    })
  }
})
