// pages/student/homeworkDetail/index.js
const app = getApp()

Page({
  data: {
    homeworkId: '',
    submitted: false,
    homeworkInfo: {},
    questions: [],
    currentIndex: 0,
    // 答题模式
    answers: {},
    submitting: false,
    submittedQuestions: {},
    questionResults: {},
    submittingQuestionId: '',
    correctCount: 0,
    answeredCount: 0,
    // 收藏
    showFavModal: false,
    favGroups: [],
    selFavGroupId: '',
    favNewName: '',
    favSelectedCount: 0,
    allChecked: false,
    // 标签映射
    typeLabel: { single_choice: '单选', multiple_choice: '多选', fill_blank: '填空', essay: '简答' },
    diffLabel: { easy: '简单', medium: '中等', hard: '困难' }
  },

  onLoad(options) {
    const homeworkId = options.homeworkId || ''
    const submitted = options.submitted === '1'
    this.setData({ homeworkId, submitted })

    if (submitted) {
      this.loadSubmissionDetail()
    } else {
      this.loadQuestions()
    }
  },

  // 计算当前已回答数量
  updateAnsweredCount() {
    const count = Object.keys(this.data.submittedQuestions).length
    this.setData({ answeredCount: count, currentAnsweredCount: count })
  },

  // 预处理题目数据
  prepareQuestions(questions) {
    const choiceTypes = ['single_choice', 'multiple_choice']
    return (questions || []).map(q => {
      if (q.options && q.options.length > 0) {
        q.options = q.options.map((opt, i) => ({
          text: opt,
          letter: String.fromCharCode(65 + i)
        }))
      }
      if (q.type === 'fill_blank' || q.type === 'essay') {
        q.content = (q.content || '').replace(/\\n/g, '\n')
      }
      if (choiceTypes.includes(q.type) && q.userAnswer) {
        const letters = (q.userAnswer || '').replace(/[^a-zA-Z]/g, '').toUpperCase().split('')
        q.userAnswerDisplay = letters.join(', ')
      }
      return q
    })
  },

  // 加载答题题目
  loadQuestions() {
    wx.showLoading({ title: '加载中...' })
    wx.cloud.callFunction({
      name: 'getHomeworkQuestions',
      data: { homeworkId: this.data.homeworkId }
    }).then(res => {
      wx.hideLoading()
      if (res.result.success) {
        const questions = this.prepareQuestions(res.result.questions)
        const data = {
          homeworkInfo: res.result.homeworkInfo || {},
          questions,
          currentIndex: 0,
          currentAnsweredCount: 0
        }

        // 恢复逐题提交的中间状态
        const existingAnswers = res.result.existingAnswers
        if (existingAnswers && existingAnswers.length > 0) {
          const submittedQuestions = {}
          const questionResults = {}
          const answers = {}
          existingAnswers.forEach(item => {
            submittedQuestions[item.questionId] = true
            answers[item.questionId] = item.userAnswer
            questionResults[item.questionId] = {
              isCorrect: item.isCorrect,
              correctAnswer: item.correctAnswer,
              explanation: item.explanation || ''
            }
          })
          data.submittedQuestions = submittedQuestions
          data.answers = answers
          data.questionResults = questionResults
          data.answeredCount = Object.keys(submittedQuestions).length
          data.correctCount = existingAnswers.filter(a => a.isCorrect).length
          data.currentAnsweredCount = Object.keys(submittedQuestions).length
          // 自动定位到第一个未提交的题目
          let firstUnsubmitted = 0
          for (let i = 0; i < questions.length; i++) {
            if (!submittedQuestions[questions[i]._id]) {
              firstUnsubmitted = i
              break
            }
          }
          data.currentIndex = firstUnsubmitted
        }
        this.setData(data)
      }
    }).catch(() => {
      wx.hideLoading()
      wx.showToast({ title: '加载失败', icon: 'none' })
    })
  },

  // 加载已提交详情
  loadSubmissionDetail() {
    wx.showLoading({ title: '加载中...' })
    const cached = app.globalData.userInfo || {}
    wx.cloud.callFunction({
      name: 'getStudentHomeworkDetail',
      data: {
        homeworkId: this.data.homeworkId,
        studentId: cached._id
      }
    }).then(res => {
      wx.hideLoading()
      if (res.result.success) {
        const questions = this.prepareQuestions(res.result.questions)
        this.setData({
          homeworkInfo: res.result.homeworkInfo || {},
          questions,
          currentIndex: 0,
          correctCount: res.result.correctCount,
          answeredCount: res.result.totalCount
        })
      }
    }).catch(() => {
      wx.hideLoading()
      wx.showToast({ title: '加载失败', icon: 'none' })
    })
  },

  // === 导航 ===

  onBack() {
    wx.navigateBack()
  },

  onPrev() {
    if (this.data.currentIndex > 0) {
      this.setData({ currentIndex: this.data.currentIndex - 1 })
    }
  },

  onNext() {
    if (this.data.currentIndex < this.data.questions.length - 1) {
      this.setData({ currentIndex: this.data.currentIndex + 1 })
    }
  },

  onJumpTo(e) {
    const index = parseInt(e.currentTarget.dataset.index)
    if (!isNaN(index) && index >= 0 && index < this.data.questions.length) {
      this.setData({ currentIndex: index })
    }
  },

  // === 答题 ===

  onSingleChoice(e) {
    const { qid, opt } = e.currentTarget.dataset
    this.setData({ ['answers.' + qid]: opt })
  },

  onMultiChoice(e) {
    const { qid, opt } = e.currentTarget.dataset
    let current = this.data.answers[qid] || ''
    const opts = current ? current.split('').filter(c => c) : []
    const idx = opts.indexOf(opt)
    if (idx >= 0) {
      opts.splice(idx, 1)
    } else {
      opts.push(opt)
    }
    this.setData({ ['answers.' + qid]: opts.sort().join('') })
  },

  onTextInput(e) {
    const qid = e.currentTarget.dataset.qid
    this.setData({ ['answers.' + qid]: e.detail.value })
  },

  // 提交当前题目
  onSubmitQuestion(e) {
    const qid = e.currentTarget.dataset.qid
    const userAnswer = this.data.answers[qid]
    if (!userAnswer || !userAnswer.trim()) {
      return wx.showToast({ title: '请先作答', icon: 'none' })
    }
    this.setData({ submittingQuestionId: qid })
    wx.cloud.callFunction({
      name: 'submitAnswer',
      data: {
        homeworkId: this.data.homeworkId,
        questionId: qid,
        userAnswer: userAnswer.trim()
      }
    }).then(res => {
      this.setData({ submittingQuestionId: '' })
      if (res.result.success) {
        const result = {
          isCorrect: res.result.isCorrect,
          correctAnswer: res.result.correctAnswer,
          explanation: res.result.explanation || ''
        }
        const submittedQuestions = { ...this.data.submittedQuestions, [qid]: true }
        const questionResults = { ...this.data.questionResults, [qid]: result }
        const correctCount = this.data.correctCount + (res.result.isCorrect ? 1 : 0)
        const answeredCount = Object.keys(submittedQuestions).length
        this.setData({
          submittedQuestions,
          questionResults,
          correctCount,
          answeredCount,
          currentAnsweredCount: answeredCount
        })

        // 如果当前题是最后一题且全部提交完毕
        if (answeredCount >= this.data.questions.length) {
          wx.showToast({ title: '全部题目已完成！', icon: 'success' })
        } else {
          wx.showToast({ title: res.result.isCorrect ? '回答正确！' : '回答错误', icon: 'none' })
        }
      } else {
        wx.showToast({ title: res.result.message, icon: 'none' })
      }
    }).catch(() => {
      this.setData({ submittingQuestionId: '' })
      wx.showToast({ title: '网络错误', icon: 'none' })
    })
  },

  // ===== 收藏功能 =====

  onToggleFav(e) {
    const index = parseInt(e.currentTarget.dataset.index)
    if (isNaN(index)) return
    const questions = this.data.questions
    questions[index]._checked = !questions[index]._checked
    const favSelectedCount = questions.filter(q => q._checked).length
    const allChecked = favSelectedCount === questions.length
    this.setData({ questions, favSelectedCount, allChecked })
  },

  onToggleSelectAll() {
    const allChecked = !this.data.allChecked
    const questions = this.data.questions.map(q => ({ ...q, _checked: allChecked }))
    const favSelectedCount = allChecked ? questions.length : 0
    this.setData({ questions, allChecked, favSelectedCount })
  },

  getFavSelectedIds() {
    return this.data.questions.filter(q => q._checked).map(q => q._id)
  },

  // 收藏当前题目（自动选中当前题）
  onFavCurrent() {
    const { questions, currentIndex } = this.data
    // 保存旧状态
    this._prevChecked = questions.map(q => !!q._checked)
    this._favSingleMode = true
    const newQuestions = questions.map((q, i) => ({ ...q, _checked: i === currentIndex }))
    this.setData({ questions: newQuestions, favSelectedCount: 1, allChecked: false }, () => {
      this.onOpenFavModal()
    })
  },

  // 恢复收藏前的勾选状态
  _restoreFavChecked() {
    if (!this._favSingleMode) return
    this._favSingleMode = false
    const questions = this.data.questions.map((q, i) => ({
      ...q,
      _checked: this._prevChecked ? !!this._prevChecked[i] : false
    }))
    const favSelectedCount = questions.filter(q => q._checked).length
    const allChecked = favSelectedCount === questions.length && favSelectedCount > 0
    this.setData({ questions, favSelectedCount, allChecked })
  },

  onOpenFavModal() {
    const ids = this.getFavSelectedIds()
    if (!ids.length) return wx.showToast({ title: '请先点击题目旁的 ☆ 选择题目', icon: 'none' })

    wx.cloud.callFunction({ name: 'getStudentGroups', data: { type: 'collection' } }).then(res => {
      if (res.result.success) {
        this.setData({
          showFavModal: true,
          favGroups: res.result.groups || [],
          selFavGroupId: '',
          favNewName: ''
        })
      } else {
        wx.showToast({ title: res.result.message || '加载收藏组失败', icon: 'none' })
      }
    }).catch(() => {
      wx.showToast({ title: '加载收藏组失败', icon: 'none' })
    })
  },

  closeFavModal() {
    this.setData({ showFavModal: false })
    this._restoreFavChecked()
  },

  onSelectFavGroup(e) {
    this.setData({ selFavGroupId: e.currentTarget.dataset.id, favNewName: '' })
  },

  onFavNewNameInput(e) {
    this.setData({ favNewName: e.detail.value, selFavGroupId: '' })
  },

  confirmFav() {
    const { selFavGroupId, favNewName, homeworkId } = this.data
    const ids = this.getFavSelectedIds()

    const doAdd = (groupId) => {
      wx.cloud.callFunction({
        name: 'addQuestionsToStudentGroup',
        data: { groupId, questionIds: ids, homeworkId }
      }).then(res => {
        if (res.result.success) {
          wx.showToast({ title: '收藏成功', icon: 'success' })
          this.setData({ showFavModal: false })
          this._restoreFavChecked()
        } else {
          wx.showToast({ title: res.result.message, icon: 'none' })
        }
      }).catch(() => {
        wx.showToast({ title: '网络错误', icon: 'none' })
      })
    }

    if (favNewName.trim()) {
      wx.cloud.callFunction({
        name: 'createStudentGroup',
        data: { name: favNewName.trim(), type: 'collection' }
      }).then(res => {
        if (res.result.success) {
          doAdd(res.result.groupId)
        } else {
          wx.showToast({ title: res.result.message, icon: 'none' })
        }
      }).catch(() => {
        wx.showToast({ title: '创建失败', icon: 'none' })
      })
    } else if (selFavGroupId) {
      doAdd(selFavGroupId)
    } else {
      wx.showToast({ title: '请选择收藏组或输入新组名', icon: 'none' })
    }
  }
})