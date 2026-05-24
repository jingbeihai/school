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

  onLongPress(e) {
    const { id, title, status } = e.currentTarget.dataset
    const isWithdrawn = status === 'withdrawn'
    const itemList = isWithdrawn ? ['删除'] : ['撤回', '删除']
    wx.showActionSheet({
      itemList,
      success: res => {
        const action = itemList[res.tapIndex]
        if (action === '撤回') {
          this.onWithdraw(id, title)
        } else if (action === '删除') {
          this.onDelete(id, title)
        }
      }
    })
  },

  onWithdraw(id, title) {
    wx.showModal({
      title: '撤回作业',
      content: `确认撤回"${title}"吗？撤回后学生将无法提交。`,
      success: res => {
        if (res.confirm) {
          wx.cloud.callFunction({ name: 'withdrawHomework', data: { homeworkId: id } }).then(r => {
            if (r.result.success) {
              wx.showToast({ title: '已撤回', icon: 'success' })
              this.loadList()
            } else {
              wx.showToast({ title: r.result.message, icon: 'none' })
            }
          })
        }
      }
    })
  },

  onDelete(id, title) {
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
