const cloud = require('../../utils/cloud.js')
// pages/student/groupDetail/index.js
Page({
  data: {
    groupId: '',
    group: {},
    questions: [],
    allSelected: false,
    showMoveModal: false,
    targetGroups: [],
    selTargetGroupId: '',
    typeLabel: { single_choice: '单选', multiple_choice: '多选', fill_blank: '填空', essay: '简答' },
    diffLabel: { easy: '简单', medium: '中等', hard: '困难' }
  },

  onLoad(options) {
    this.setData({ groupId: options.groupId })
    this.loadData()
  },

  loadData() {
    wx.showLoading({ title: '加载中' })
    cloud.callFunction({
      name: 'getStudentGroupQuestions',
      data: { groupId: this.data.groupId }
    }).then(res => {
      wx.hideLoading()
      if (res.result.success) {
        const questions = (res.result.questions || []).map(q => {
          // 处理选项格式
          if (q.options && q.options.length > 0 && typeof q.options[0] === 'string') {
            q.options = q.options.map((opt, i) => ({
              text: opt,
              letter: String.fromCharCode(65 + i)
            }))
          }
          return { ...q, checked: false }
        })
        this.setData({
          group: res.result.group || {},
          questions,
          allSelected: false
        })
      }
    }).catch(() => {
      wx.hideLoading()
      wx.showToast({ title: '加载失败', icon: 'none' })
    })
  },

  onSelectAll() {
    const all = !this.data.allSelected
    const questions = this.data.questions.map(q => ({ ...q, checked: all }))
    this.setData({ questions, allSelected: all })
  },

  onCheckboxChange(e) {
    const vals = e.detail.value
    const questions = this.data.questions.map(q => ({
      ...q, checked: vals.includes(q._id)
    }))
    this.setData({ questions, allSelected: vals.length === questions.length })
  },

  getSelectedIds() {
    return this.data.questions.filter(q => q.checked).map(q => q._id)
  },

  // 移动到其他组
  onMoveToGroup() {
    const ids = this.getSelectedIds()
    if (!ids.length) return wx.showToast({ title: '请勾选题目', icon: 'none' })

    const groupType = this.data.group.type || 'collection'
    cloud.callFunction({ name: 'getStudentGroups', data: { type: groupType } }).then(res => {
      const list = (res.result.groups || []).filter(g => g._id !== this.data.groupId)
      if (!list.length) return wx.showToast({ title: '暂无其他组', icon: 'none' })
      this.setData({ showMoveModal: true, targetGroups: list, selTargetGroupId: '' })
    }).catch(() => {
      wx.showToast({ title: '加载失败', icon: 'none' })
    })
  },

  onSelectTargetGroup(e) {
    this.setData({ selTargetGroupId: e.currentTarget.dataset.id })
  },

  confirmMove() {
    const { selTargetGroupId } = this.data
    if (!selTargetGroupId) return wx.showToast({ title: '请选择目标组', icon: 'none' })

    const ids = this.getSelectedIds()
    cloud.callFunction({
      name: 'moveStudentGroupQuestions',
      data: { fromGroupId: this.data.groupId, toGroupId: selTargetGroupId, questionIds: ids }
    }).then(res => {
      if (res.result.success) {
        wx.showToast({ title: '移动成功', icon: 'success' })
        this.setData({ showMoveModal: false })
        this.loadData()
      } else {
        wx.showToast({ title: res.result.message, icon: 'none' })
      }
    }).catch(() => {
      wx.showToast({ title: '网络错误', icon: 'none' })
    })
  },

  // 从组中移除
  onRemoveFromGroup() {
    const ids = this.getSelectedIds()
    if (!ids.length) return wx.showToast({ title: '请勾选题目', icon: 'none' })

    wx.showModal({
      title: '移除题目',
      content: '确认将这些题目从该组中移除吗？题目本身不会删除。',
      success: res => {
        if (res.confirm) {
          cloud.callFunction({
            name: 'removeQuestionsFromStudentGroup',
            data: { groupId: this.data.groupId, questionIds: ids }
          }).then(r => {
            if (r.result.success) {
              wx.showToast({ title: '已移除', icon: 'success' })
              this.loadData()
            } else {
              wx.showToast({ title: r.result.message, icon: 'none' })
            }
          })
        }
      }
    })
  },

  closeMoveModal() {
    this.setData({ showMoveModal: false })
  }
})
