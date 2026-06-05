const cloud = require('../../utils/cloud.js')
// pages/student/questionBank/index.js
const app = getApp()

Page({
  data: {
    activeTab: 'collection',  // 'collection' | 'error'
    collectionGroups: [],
    errorFolders: [],
    showCreateModal: false,
    createName: '',
    createType: 'collection'
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().updateTabs()
    }
    this.loadAll()
  },

  loadAll() {
    this.loadGroups('collection')
    this.loadGroups('error')
  },

  loadGroups(type) {
    cloud.callFunction({ name: 'getStudentGroups', data: { type } }).then(res => {
      if (res.result.success) {
        if (type === 'collection') {
          this.setData({ collectionGroups: res.result.groups })
        } else {
          this.setData({ errorFolders: res.result.groups })
        }
      }
    }).catch(() => {})
  },

  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
  },

  // 新建
  onNewGroup() {
    this.setData({
      showCreateModal: true,
      createName: '',
      createType: this.data.activeTab
    })
  },

  onNameInput(e) {
    this.setData({ createName: e.detail.value })
  },

  onTypeChange(e) {
    this.setData({ createType: e.currentTarget.dataset.type })
  },

  closeCreateModal() {
    this.setData({ showCreateModal: false })
  },

  confirmCreate() {
    const { createName, createType } = this.data
    if (!createName.trim()) {
      return wx.showToast({ title: '请输入名称', icon: 'none' })
    }
    cloud.callFunction({
      name: 'createStudentGroup',
      data: { name: createName.trim(), type: createType }
    }).then(res => {
      if (res.result.success) {
        wx.showToast({ title: '创建成功', icon: 'success' })
        this.setData({ showCreateModal: false })
        this.loadAll()
      } else {
        wx.showToast({ title: res.result.message, icon: 'none' })
      }
    }).catch(() => {
      wx.showToast({ title: '网络错误', icon: 'none' })
    })
  },

  // 进入组详情
  goGroupDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/student/groupDetail/index?groupId=' + id })
  },

  // 长按删除
  onDeleteGroup(e) {
    const { id, name, type } = e.currentTarget.dataset
    const label = type === 'collection' ? '收藏组' : '错题本'
    wx.showModal({
      title: '删除' + label,
      content: `确定删除"${name}"吗？题目不会被删除。`,
      success: res => {
        if (res.confirm) {
          cloud.callFunction({
            name: 'deleteStudentGroup',
            data: { groupId: id }
          }).then(r => {
            if (r.result.success) {
              wx.showToast({ title: '已删除', icon: 'success' })
              this.loadAll()
            } else {
              wx.showToast({ title: r.result.message, icon: 'none' })
            }
          })
        }
      }
    })
  }
})
