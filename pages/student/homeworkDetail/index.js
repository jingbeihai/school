// pages/student/homeworkDetail/index.js
const app = getApp()

Page({
  data: {
    homeworkId: '',
    submitted: false,
    homeworkInfo: {},
    questions: [],
    // 答题模式
    answers: {},        // { questionId: answerString }
    submitting: false,
    // 逐题提交
    submittedQuestions: {},   // { questionId: true }
    questionResults: {},      // { questionId: { isCorrect, correctAnswer, explanation } }
    submittingQuestionId: '',
    allSubmitted: false,
    remainCount: 0,
    // 收藏模式
    allFavSelected: false,
    showFavModal: false,
    favGroups: [],
    selFavGroupId: '',
    favNewName: '',
    // 类型/难度映射
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

  // 预处理题目数据（添加选项字母、处理换行、格式化用户答案）
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
        q.userAnswerDisplay = q.userAnswer || ''
      }
      // 选择题：格式化 userAnswer 为字母展示（如 "A" / "B, C"）
      if (choiceTypes.includes(q.type) && q.userAnswer) {
        const letters = (q.userAnswer || '').replace(/[^a-zA-Z]/g, '').toUpperCase().split('')
        q.userAnswerDisplay = letters.join(', ')
      }
      return q
    })
  },

  // 加载答题题目（不含答案）
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
          questions
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
          data.remainCount = questions.length - Object.keys(submittedQuestions).length
          data.allSubmitted = data.remainCount <= 0
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
          correctCount: res.result.correctCount,
          totalCount: res.result.totalCount
        })
      }
    }).catch(() => {
      wx.hideLoading()
      wx.showToast({ title: '加载失败', icon: 'none' })
    })
  },

  // === 答题模式 ===

  // 单选题
  onSingleChoice(e) {
    const { qid, opt } = e.currentTarget.dataset
    this.setData({ ['answers.' + qid]: opt })
  },

  // 多选题
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

  // 填空/简答
  onTextInput(e) {
    const qid = e.currentTarget.dataset.qid
    this.setData({ ['answers.' + qid]: e.detail.value })
  },

  // 逐题提交
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
        const allSubmitted = Object.keys(submittedQuestions).length >= this.data.questions.length
        const remainCount = this.data.questions.length - Object.keys(submittedQuestions).length
        this.setData({ submittedQuestions, questionResults, allSubmitted, remainCount })
      } else {
        wx.showToast({ title: res.result.message, icon: 'none' })
      }
    }).catch(() => {
      this.setData({ submittingQuestionId: '' })
      wx.showToast({ title: '网络错误', icon: 'none' })
    })
  },

  // 提交答案（批量提交未提交的题目）
  onSubmit() {
    const { questions, answers, submittedQuestions } = this.data
    const unsubmitted = questions.filter(q => !submittedQuestions[q._id] && answers[q._id] && answers[q._id].trim())
    if (unsubmitted.length === 0) {
      return wx.showToast({ title: '所有题目已提交', icon: 'none' })
    }
    const skipped = questions.filter(q => !submittedQuestions[q._id] && (!answers[q._id] || !answers[q._id].trim()))
    if (skipped.length > 0) {
      wx.showModal({
        title: '提示',
        content: '还有 ' + skipped.length + ' 道题未作答，确定提交吗？',
        success: (res) => {
          if (res.confirm) this.doSubmit()
        }
      })
    } else {
      this.doSubmit()
    }
  },

  doSubmit() {
    const { homeworkId, questions, answers, submittedQuestions } = this.data
    // 只提交未提交过的题目
    const answerList = questions
      .filter(q => !submittedQuestions[q._id])
      .map(q => ({
        questionId: q._id,
        userAnswer: answers[q._id] || ''
      }))

    if (answerList.length === 0) {
      return wx.showToast({ title: '无待提交题目', icon: 'none' })
    }

    this.setData({ submitting: true })
    wx.cloud.callFunction({
      name: 'submitHomeworkAnswers',
      data: { homeworkId, answers: answerList }
    }).then(res => {
      this.setData({ submitting: false })
      if (res.result.success) {
        wx.showToast({ title: '提交成功', icon: 'success' })
        setTimeout(() => {
          // 将所有未提交的标记为已提交
          const submittedQuestions = { ...this.data.submittedQuestions }
          answerList.forEach(a => { submittedQuestions[a.questionId] = true })
          this.setData({
            submitted: true,
            allSubmitted: true,
            submittedQuestions,
            remainCount: 0
          })
          this.loadSubmissionDetail()
        }, 1000)
      } else {
        wx.showToast({ title: res.result.message, icon: 'none' })
      }
    }).catch(() => {
      this.setData({ submitting: false })
      wx.showToast({ title: '网络错误', icon: 'none' })
    })
  },

  // ===== 收藏功能 =====

  // 已提交模式下勾选题目
  onFavCheck(e) {
    const vals = e.detail.value
    const questions = this.data.questions.map(q => ({
      ...q, _checked: vals.includes(q._id)
    }))
    this.setData({
      questions,
      allFavSelected: vals.length === questions.length
    })
  },

  // 全选/取消全选
  onFavSelectAll() {
    const allChecked = !this.data.allFavSelected
    const questions = this.data.questions.map(q => ({
      ...q, _checked: allChecked
    }))
    this.setData({ questions, allFavSelected: allChecked })
  },

  // 获取已勾选的题目 IDs
  getFavSelectedIds() {
    return this.data.questions.filter(q => q._checked).map(q => q._id)
  },

  // 打开收藏弹窗
  onOpenFavModal() {
    const ids = this.getFavSelectedIds()
    if (!ids.length) return wx.showToast({ title: '请至少勾选一题', icon: 'none' })

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
  },

  onSelectFavGroup(e) {
    this.setData({ selFavGroupId: e.currentTarget.dataset.id, favNewName: '' })
  },

  onFavNewNameInput(e) {
    this.setData({ favNewName: e.detail.value, selFavGroupId: '' })
  },

  // 确认收藏
  confirmFav() {
    const { selFavGroupId, favNewName, homeworkId, questions } = this.data
    const ids = this.getFavSelectedIds()

    const doAdd = (groupId) => {
      wx.cloud.callFunction({
        name: 'addQuestionsToStudentGroup',
        data: { groupId, questionIds: ids, homeworkId }
      }).then(res => {
        if (res.result.success) {
          wx.showToast({ title: '收藏成功', icon: 'success' })
          this.setData({ showFavModal: false })
        } else {
          wx.showToast({ title: res.result.message, icon: 'none' })
        }
      }).catch(() => {
        wx.showToast({ title: '网络错误', icon: 'none' })
      })
    }

    if (favNewName.trim()) {
      // 创建新组并入题
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
