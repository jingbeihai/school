// pages/teacher/groupQuestions/index.js
Page({
  data: {
    groupId: '', group: {}, questions: [], allSelected: false,
    showClassModal: false, showGroupModal: false,
    classList: [], selClassId: '',
    groupList: [], selGroupId: '',
    typeLabel: { single_choice: '单选', multiple_choice: '多选', fill_blank: '填空', essay: '简答' }
  },

  onLoad(options) {
    this.setData({ groupId: options.groupId })
    this.loadData()
  },

  loadData() {
    wx.showLoading({ title: '加载中' })
    wx.cloud.callFunction({ name: 'getGroupQuestions', data: { groupId: this.data.groupId } }).then(res => {
      wx.hideLoading()
      const r = res.result
      const qs = (r.questions || []).map(q => ({ ...q, checked: false }))
      this.setData({ group: r.group || {}, questions: qs, allSelected: false })
    }).catch(() => { wx.hideLoading() })
  },

  onSelectAll() {
    const all = !this.data.allSelected
    const qs = this.data.questions.map(q => ({ ...q, checked: all }))
    this.setData({ questions: qs, allSelected: all })
  },

  onCheckboxChange(e) {
    const vals = e.detail.value
    const qs = this.data.questions.map(q => ({ ...q, checked: vals.includes(q._id) }))
    this.setData({ questions: qs, allSelected: vals.length === qs.length })
  },

  getSelectedIds() {
    return this.data.questions.filter(q => q.checked).map(q => q._id)
  },

  // 重新发布
  onRepublish() {
    const ids = this.getSelectedIds()
    if (!ids.length) return wx.showToast({ title: '请勾选题目', icon: 'none' })
    wx.cloud.callFunction({ name: 'getClassList' }).then(res => {
      const list = res.result?.classes || []
      if (!list.length) return wx.showToast({ title: '请先创建班级', icon: 'none' })
      this.setData({ showClassModal: true, classList: list, selClassId: '' })
    })
  },

  onSelectClass(e) { this.setData({ selClassId: e.currentTarget.dataset.id }) },

  onConfirmRepublish() {
    const { selClassId } = this.data
    if (!selClassId) return wx.showToast({ title: '请选择班级', icon: 'none' })
    const ids = this.getSelectedIds()
    wx.cloud.callFunction({
      name: 'reuseQuestions',
      data: { sourceType: 'group', sourceId: this.data.groupId, targetType: 'homework', questionIds: ids, classId: selClassId }
    }).then(res => {
      if (res.result.success) {
        wx.showToast({ title: '发布成功', icon: 'success' })
        this.setData({ showClassModal: false })
      } else {
        wx.showModal({ title: '失败', content: res.result.message, showCancel: false })
      }
    })
  },

  // 移动到组
  onMoveToGroup() {
    const ids = this.getSelectedIds()
    if (!ids.length) return wx.showToast({ title: '请勾选题目', icon: 'none' })
    wx.cloud.callFunction({ name: 'getGroups' }).then(res => {
      const list = (res.result?.groups || []).filter(g => g._id !== this.data.groupId)
      if (!list.length) return wx.showToast({ title: '暂无其他组', icon: 'none' })
      this.setData({ showGroupModal: true, groupList: list, selGroupId: '' })
    })
  },

  onSelectTargetGroup(e) { this.setData({ selGroupId: e.currentTarget.dataset.id }) },

  onConfirmMove() {
    const { selGroupId } = this.data
    if (!selGroupId) return wx.showToast({ title: '请选择目标组', icon: 'none' })
    const ids = this.getSelectedIds()
    wx.cloud.callFunction({
      name: 'reuseQuestions',
      data: { sourceType: 'group', sourceId: this.data.groupId, targetType: 'group', targetId: selGroupId, questionIds: ids }
    }).then(res => {
      if (res.result.success) {
        wx.showToast({ title: '移动成功', icon: 'success' })
        this.setData({ showGroupModal: false })
        this.loadData()
      } else {
        wx.showModal({ title: '失败', content: res.result.message, showCancel: false })
      }
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
          wx.cloud.callFunction({
            name: 'removeQuestionsFromGroup',
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

  closeModal() { this.setData({ showClassModal: false, showGroupModal: false }) }
})
