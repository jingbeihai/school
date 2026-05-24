// pages/teacher/publishHomework/index.js
const app = getApp()

Page({
  data: {
    activeTab: 'ai',
    loading: false,
    // AI出题
    aiPrompt: '',
    // 图片
    ocrImage: '',
    ocrText: '',
    // 文件
    fileName: '',
    fileID: '',
    docText: '',
    // 题目
    questions: [],
    allSelected: false,
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
    // 快捷入口
    groupCount: 0,
    homeworkCount: 0,
    // 标签映射
    typeLabel: { single_choice: '单选', multiple_choice: '多选', fill_blank: '填空', essay: '简答' },
    diffLabel: { easy: '简单', medium: '中等', hard: '困难' }
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().updateTabs()
    }
    this.loadQuickData()
  },

  loadQuickData() {
    wx.cloud.callFunction({ name: 'getGroups' }).then(res => {
      const groups = res.result?.groups || []
      this.setData({ groupCount: groups.length, groupList: groups })
    }).catch(() => {})
    wx.cloud.callFunction({ name: 'getHomeworkList' }).then(res => {
      const list = res.result?.homeworkList || []
      this.setData({ homeworkCount: list.length })
    }).catch(() => {})
  },

  switchTab(e) {
    this.setData({ activeTab: e.currentTarget.dataset.tab })
  },

  goHome() {
    this.setData({ questions: [], allSelected: false })
  },

  // ========== AI出题 ==========
  onAiPrompt(e) { this.setData({ aiPrompt: e.detail.value }) },

  onGenerateAI() {
    const { aiPrompt, loading } = this.data
    if (!aiPrompt.trim()) return wx.showToast({ title: '请输入出题需求', icon: 'none' })
    if (loading) return

    this.setData({ loading: true })
    wx.showLoading({ title: 'AI生成中...' })
    wx.cloud.callFunction({ name: 'generateQuestions', data: { userPrompt: aiPrompt } }).then(res => {
      wx.hideLoading()
      const result = res.result
      if (result.success) {
        const qs = (result.questions || []).map(q => ({ ...q, checked: false }))
        this.setData({ questions: qs, loading: false, allSelected: false })
        wx.showToast({ title: `已生成${qs.length}道题`, icon: 'success' })
      } else {
        this.setData({ loading: false })
        wx.showModal({ title: '生成失败', content: result.message, showCancel: false })
      }
    }).catch(err => {
      wx.hideLoading()
      this.setData({ loading: false })
      wx.showModal({ title: '错误', content: err.message, showCancel: false })
    })
  },

  // ========== 图片识别 ==========
  onChooseImage() {
    wx.chooseMedia({
      count: 1, mediaType: ['image'],
      success: res => {
        const path = res.tempFiles[0].tempFilePath
        wx.showLoading({ title: '上传中...' })
        wx.cloud.uploadFile({
          cloudPath: 'ocr/' + Date.now() + '.png',
          filePath: path
        }).then(r => {
          wx.hideLoading()
          this.setData({ ocrImage: path, ocrFileID: r.fileID })
        }).catch(() => { wx.hideLoading() })
      }
    })
  },

  onOCR() {
    const { ocrFileID, loading } = this.data
    if (loading) return
    if (!ocrFileID) return wx.showToast({ title: '请先上传图片', icon: 'none' })

    this.setData({ loading: true })
    wx.showLoading({ title: '识别中...' })
    wx.cloud.callFunction({ name: 'ocrImage', data: { fileID: ocrFileID } }).then(res => {
      wx.hideLoading()
      const r = res.result
      if (r.success) {
        this.setData({ ocrText: r.text, loading: false })
        if (r.needManual) wx.showToast({ title: 'OCR需配置，可手动编辑', icon: 'none' })
      } else {
        this.setData({ loading: false })
        wx.showModal({ title: '识别失败', content: r.message, showCancel: false })
      }
    }).catch(err => {
      wx.hideLoading()
      this.setData({ loading: false })
      wx.showModal({ title: '错误', content: err.message, showCancel: false })
    })
  },

  onOCRToAI() {
    this.onOCR()
    // 识别后可自动转为AI出题
  },

  onOcrText(e) { this.setData({ ocrText: e.detail.value }) },

  onOCRTextToAI() {
    this.setData({ aiPrompt: '请根据以下资料出题：\n' + this.data.ocrText, activeTab: 'ai' })
  },

  // ========== 文件识别 ==========
  onChooseFile() {
    wx.chooseMessageFile({
      count: 1,
      success: res => {
        const file = res.tempFiles[0]
        const ext = file.name.split('.').pop().toLowerCase()
        if (!['txt', 'doc', 'docx', 'pdf'].includes(ext)) {
          return wx.showToast({ title: '仅支持 txt/doc/docx/pdf', icon: 'none' })
        }
        wx.showLoading({ title: '上传中...' })
        wx.cloud.uploadFile({
          cloudPath: 'docs/' + Date.now() + '.' + ext,
          filePath: file.path
        }).then(r => {
          wx.hideLoading()
          this.setData({ fileName: file.name, fileID: r.fileID, fileType: ext })
        }).catch(() => { wx.hideLoading() })
      }
    })
  },

  onParseDoc() {
    const { fileID, fileType, loading } = this.data
    if (loading) return
    if (!fileID) return wx.showToast({ title: '请先上传文件', icon: 'none' })

    this.setData({ loading: true })
    wx.showLoading({ title: '解析中...' })
    wx.cloud.callFunction({ name: 'parseDocument', data: { fileID, fileType } }).then(res => {
      wx.hideLoading()
      const r = res.result
      if (r.success) {
        this.setData({ docText: r.text, loading: false })
      } else {
        this.setData({ loading: false })
        wx.showModal({ title: '解析失败', content: r.message, showCancel: false })
      }
    }).catch(err => {
      wx.hideLoading()
      this.setData({ loading: false })
      wx.showModal({ title: '错误', content: err.message, showCancel: false })
    })
  },

  onDocText(e) { this.setData({ docText: e.detail.value }) },

  onDocTextToAI() {
    this.setData({ aiPrompt: '请根据以下资料出题：\n' + this.data.docText, activeTab: 'ai' })
  },

  // ========== 题目操作 ==========
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

  // ========== 发布作业 ==========
  onPublishHomework() {
    const selected = this.data.questions.filter(q => q.checked)
    if (!selected.length) return wx.showToast({ title: '请勾选题目', icon: 'none' })

    // 加载班级列表
    wx.cloud.callFunction({ name: 'getClassList' }).then(res => {
      const list = res.result?.list || []
      if (!list.length) return wx.showToast({ title: '请先创建班级', icon: 'none' })
      this.setData({ showPublishModal: true, classList: list, selClassId: '' })
    })
  },

  onSelectClass(e) { this.setData({ selClassId: e.currentTarget.dataset.id }) },

  onCustomTitle(e) { this.setData({ customTitle: e.detail.value }) },

  onConfirmPublish() {
    const { selClassId, questions, publishing, customTitle } = this.data
    if (publishing) return
    if (!selClassId) return wx.showToast({ title: '请选择班级', icon: 'none' })

    const qIds = questions.filter(q => q.checked).map(q => q._id)
    this.setData({ publishing: true })
    wx.cloud.callFunction({
      name: 'publishHomework',
      data: { classId: selClassId, questionIds: qIds, title: customTitle.trim() || undefined }
    }).then(res => {
      const r = res.result
      if (r.success) {
        wx.showToast({ title: '发布成功', icon: 'success' })
        this.setData({ showPublishModal: false, publishing: false, questions: [], allSelected: false })
        this.loadQuickData()
      } else {
        this.setData({ publishing: false })
        wx.showModal({ title: '发布失败', content: r.message, showCancel: false })
      }
    }).catch(err => {
      this.setData({ publishing: false })
      wx.showModal({ title: '错误', content: err.message, showCancel: false })
    })
  },

  // ========== 收藏 ==========
  onCollectToGroup() {
    const selected = this.data.questions.filter(q => q.checked)
    if (!selected.length) return wx.showToast({ title: '请勾选题目', icon: 'none' })

    wx.cloud.callFunction({ name: 'getGroups' }).then(res => {
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
          wx.cloud.callFunction({ name: 'createGroup', data: { name: res.content } }).then(r => {
            if (r.result.success) {
              wx.cloud.callFunction({ name: 'getGroups' }).then(gRes => {
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
    const { selGroupId, questions, collecting } = this.data
    if (collecting) return
    if (!selGroupId) return wx.showToast({ title: '请选择收藏组', icon: 'none' })

    const qIds = questions.filter(q => q.checked).map(q => q._id)
    this.setData({ collecting: true })
    wx.cloud.callFunction({
      name: 'addQuestionsToGroup',
      data: { groupId: selGroupId, questionIds: qIds }
    }).then(res => {
      const r = res.result
      if (r.success) {
        wx.showToast({ title: '收藏成功', icon: 'success' })
        this.setData({ showCollectModal: false, collecting: false })
        this.loadQuickData()
      } else {
        this.setData({ collecting: false })
        wx.showModal({ title: '失败', content: r.message, showCancel: false })
      }
    }).catch(err => {
      this.setData({ collecting: false })
      wx.showModal({ title: '错误', content: err.message, showCancel: false })
    })
  },

  closeModal() {
    this.setData({ showPublishModal: false, showCollectModal: false })
  },

  goGroups() { wx.navigateTo({ url: '/pages/teacher/questionGroups/index' }) },
  goHomeworkHistory() { wx.navigateTo({ url: '/pages/teacher/homeworkHistory/index' }) }
})
