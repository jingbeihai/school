const cloud = require('../../utils/cloud')
// pages/teacher/questionGroups/index.js
const { formatDate } = require('../../../utils/util.js')

Page({
  data: { groups: [] },

  onShow() { this.loadGroups() },

  loadGroups() {
    wx.showLoading({ title: '加载中' })
    cloud.callFunction({ name: 'getGroups' }).then(res => {
      wx.hideLoading()
      const groups = (res.result?.groups || []).map(item => ({
        ...item,
        updateTime: formatDate(item.updateTime)
      }))
      this.setData({ groups })
    }).catch(() => { wx.hideLoading() })
  },

  onNewGroup() {
    wx.showModal({
      title: '新建收藏组',
      editable: true,
      placeholderText: '输入组名称',
      success: res => {
        if (res.confirm && res.content) {
          cloud.callFunction({ name: 'createGroup', data: { name: res.content } }).then(r => {
            if (r.result.success) this.loadGroups()
            else wx.showToast({ title: r.result.message, icon: 'none' })
          })
        }
      }
    })
  },

  goGroupDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/teacher/groupQuestions/index?groupId=' + id })
  },

  onDeleteGroup(e) {
    const idx = e.currentTarget.dataset.index
    const group = this.data.groups[idx]
    wx.showModal({
      title: '删除收藏组',
      content: `确定删除"${group.name}"吗？题目不会被删除。`,
      success: res => {
        if (res.confirm) {
          cloud.callFunction({ name: 'deleteGroup', data: { groupId: group._id } }).then(r => {
            if (r.result.success) {
              wx.showToast({ title: '已删除', icon: 'success' })
              this.loadGroups()
            } else {
              wx.showToast({ title: r.result.message, icon: 'none' })
            }
          })
        }
      }
    })
  }
})
