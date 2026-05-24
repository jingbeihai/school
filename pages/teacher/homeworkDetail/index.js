// pages/teacher/homeworkDetail/index.js
Page({
  data: {
    homeworkId: '', homework: null, questions: [], allSelected: false,
    showClassModal: false, showGroupModal: false,
    classList: [], selClassId: '',
    groupList: [], selGroupId: '',
    typeLabel: { single_choice: '单选', multiple_choice: '多选', fill_blank: '填空', essay: '简答' }
  },

  onLoad(options) {
    this.setData({ homeworkId: options.homeworkId })
    this.loadData()
  },

  loadData() {
    wx.showLoading({ title: '加载中' })
    wx.cloud.callFunction({ name: 'getHomeworkQuestions', data: { homeworkId: this.data.homeworkId } }).then(res => {
      wx.hideLoading()
      const r = res.result
      const qs = (r.questions || []).map(q => ({ ...q, checked: false }))
      this.setData({ homework: r.homework, questions: qs, allSelected: false })
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
      const list = res.result?.list || []
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
      data: { sourceType: 'homework', sourceId: this.data.homeworkId, targetType: 'homework', questionIds: ids, classId: selClassId }
    }).then(res => {
      if (res.result.success) {
        wx.showToast({ title: '发布成功', icon: 'success' })
        this.setData({ showClassModal: false })
      } else {
        wx.showModal({ title: '失败', content: res.result.message, showCancel: false })
      }
    })
  },

  // 收藏
  onCollect() {
    const ids = this.getSelectedIds()
    if (!ids.length) return wx.showToast({ title: '请勾选题目', icon: 'none' })
    wx.cloud.callFunction({ name: 'getGroups' }).then(res => {
      this.setData({ showGroupModal: true, groupList: res.result?.groups || [], selGroupId: '' })
    })
  },

  onSelectGroup(e) { this.setData({ selGroupId: e.currentTarget.dataset.id }) },

  onNewGroup() {
    wx.showModal({
      title: '新建收藏组',
      editable: true,
      placeholderText: '输入组名称',
      success: res => {
        if (res.confirm && res.content) {
          wx.cloud.callFunction({ name: 'createGroup', data: { name: res.content } }).then(r => {
            if (r.result.success) {
              wx.cloud.callFunction({ name: 'getGroups' }).then(gRes => {
                this.setData({ groupList: gRes.result?.groups || [], selGroupId: r.result.groupId })
              })
            }
          })
        }
      }
    })
  },

  onConfirmCollect() {
    const { selGroupId } = this.data
    if (!selGroupId) return wx.showToast({ title: '请选择收藏组', icon: 'none' })
    const ids = this.getSelectedIds()
    wx.cloud.callFunction({
      name: 'reuseQuestions',
      data: { sourceType: 'homework', sourceId: this.data.homeworkId, targetType: 'group', targetId: selGroupId, questionIds: ids }
    }).then(res => {
      if (res.result.success) {
        wx.showToast({ title: '收藏成功', icon: 'success' })
        this.setData({ showGroupModal: false })
      } else {
        wx.showModal({ title: '失败', content: res.result.message, showCancel: false })
      }
    })
  },

  closeModal() { this.setData({ showClassModal: false, showGroupModal: false }) }
})
