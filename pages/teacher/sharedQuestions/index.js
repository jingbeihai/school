const cloud = require('../../utils/cloud.js')
// pages/teacher/sharedQuestions/index.js
Page({
  data: {
    keyword: '',
    activeTag: '',
    questions: [],
    total: 0,
    page: 1,
    hasMore: false,
    loading: false,
    loadingMore: false,
    allSelected: false,
    hotTags: [],
    // 弹窗
    showPublishModal: false,
    showCollectModal: false,
    classList: [],
    selClassId: '',
    customTitle: '',
    groupList: [],
    selGroupId: '',
    publishing: false,
    collecting: false,
    // 标签映射
    typeLabel: { single_choice: '单选', multiple_choice: '多选', fill_blank: '填空', essay: '简答' },
    diffLabel: { easy: '简单', medium: '中等', hard: '困难' }
  },

  onLoad() {
    this.loadData()
  },

  // 加载数据
  loadData(append = false) {
    const { keyword, page } = this.data
    if (this.data.loading || this.data.loadingMore) return

    this.setData(append ? { loadingMore: true } : { loading: true })

    cloud.callFunction({
      name: 'getSharedQuestions',
      data: { keyword: keyword.trim(), page, pageSize: 20 }
    }).then(res => {
      const r = res.result
      if (r.success) {
        let questions = r.questions.map(q => ({ ...q, checked: false }))
        if (append) {
          questions = [...this.data.questions, ...questions]
        }
        // 收集标签
        let hotTags = this.data.hotTags
        if (!append) {
          const tagSet = new Set(hotTags)
          questions.forEach(q => (q.tags || []).forEach(t => tagSet.add(t)))
          hotTags = [...tagSet].slice(0, 15)
        }
        this.setData({
          questions,
          total: r.total,
          hasMore: r.hasMore,
          allSelected: false,
          hotTags,
          loading: false,
          loadingMore: false
        })
      } else {
        this.setData({ loading: false, loadingMore: false })
        wx.showToast({ title: r.message || '加载失败', icon: 'none' })
      }
    }).catch(() => {
      this.setData({ loading: false, loadingMore: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    })
  },

  // 搜索
  onKeywordInput(e) { this.setData({ keyword: e.detail.value }) },
  onSearch() {
    this.setData({ page: 1, questions: [], activeTag: '' }, () => this.loadData())
  },

  // 标签筛选
  onTagTap(e) {
    const tag = e.currentTarget.dataset.tag
    const activeTag = this.data.activeTag === tag ? '' : tag
    this.setData({ activeTag, keyword: activeTag, page: 1, questions: [] }, () => this.loadData())
  },

  // 加载更多
  onLoadMore() {
    this.setData({ page: this.data.page + 1 }, () => this.loadData(true))
  },

  // 全选
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

  // ========== 发布作业 ==========
  onPublishHomework() {
    const ids = this.getSelectedIds()
    if (!ids.length) return wx.showToast({ title: '请勾选题目', icon: 'none' })

    cloud.callFunction({ name: 'getClassList' }).then(res => {
      const list = res.result?.list || []
      if (!list.length) return wx.showToast({ title: '请先创建班级', icon: 'none' })
      this.setData({ showPublishModal: true, classList: list, selClassId: '' })
    })
  },

  onSelectClass(e) { this.setData({ selClassId: e.currentTarget.dataset.id }) },
  onCustomTitle(e) { this.setData({ customTitle: e.detail.value }) },

  onConfirmPublish() {
    const { selClassId, customTitle, publishing } = this.data
    if (publishing) return
    if (!selClassId) return wx.showToast({ title: '请选择班级', icon: 'none' })

    // 获取实际 questionId
    const selectedQuestions = this.data.questions.filter(q => q.checked)
    const qIds = selectedQuestions.map(q => q.questionId)

    this.setData({ publishing: true })
    cloud.callFunction({
      name: 'publishHomework',
      data: { classId: selClassId, questionIds: qIds, title: customTitle.trim() || undefined }
    }).then(res => {
      if (res.result.success) {
        wx.showToast({ title: '发布成功', icon: 'success' })
        this.setData({ showPublishModal: false, publishing: false, customTitle: '' })
      } else {
        this.setData({ publishing: false })
        wx.showModal({ title: '失败', content: res.result.message, showCancel: false })
      }
    }).catch(() => {
      this.setData({ publishing: false })
      wx.showToast({ title: '网络错误', icon: 'none' })
    })
  },

  // ========== 收藏到组 ==========
  onCollectToGroup() {
    const ids = this.getSelectedIds()
    if (!ids.length) return wx.showToast({ title: '请勾选题目', icon: 'none' })

    cloud.callFunction({ name: 'getGroups' }).then(res => {
      const list = res.result?.groups || []
      this.setData({ showCollectModal: true, groupList: list, selGroupId: '' })
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
          cloud.callFunction({ name: 'createGroup', data: { name: res.content } }).then(r => {
            if (r.result.success) {
              cloud.callFunction({ name: 'getGroups' }).then(gRes => {
                this.setData({
                  groupList: gRes.result?.groups || [],
                  selGroupId: r.result.groupId
                })
              })
            } else {
              wx.showToast({ title: r.result.message, icon: 'none' })
            }
          })
        }
      }
    })
  },

  onConfirmCollect() {
    const { selGroupId, collecting } = this.data
    if (collecting) return
    if (!selGroupId) return wx.showToast({ title: '请选择收藏组', icon: 'none' })

    const selectedQuestions = this.data.questions.filter(q => q.checked)
    const qIds = selectedQuestions.map(q => q.questionId)

    this.setData({ collecting: true })
    cloud.callFunction({
      name: 'addQuestionsToGroup',
      data: { groupId: selGroupId, questionIds: qIds }
    }).then(res => {
      if (res.result.success) {
        wx.showToast({ title: '收藏成功', icon: 'success' })
        this.setData({ showCollectModal: false, collecting: false })
      } else {
        this.setData({ collecting: false })
        wx.showModal({ title: '失败', content: res.result.message, showCancel: false })
      }
    }).catch(() => {
      this.setData({ collecting: false })
      wx.showToast({ title: '网络错误', icon: 'none' })
    })
  },

  closeModal() {
    this.setData({ showPublishModal: false, showCollectModal: false })
  }
})
