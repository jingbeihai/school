const cloud = require('../../utils/cloud.js')
Page({
  data: {
    homeworkId: '',
    studentId: '',
    submissionId: '',
    homeworkInfo: null,
    studentName: '',
    questions: [],
    currentIndex: 0,
    correctCount: 0,
    totalCount: 0,
    questionComments: {},
    saving: false,
    typeLabel: { single_choice: '单选', multiple_choice: '多选', fill_blank: '填空', essay: '简答' },
    diffLabel: { easy: '简单', medium: '中等', hard: '困难' }
  },

  onLoad(options) {
    this.setData({
      homeworkId: options.homeworkId,
      studentId: options.studentId
    })
    this.loadData()
  },

  loadData() {
    wx.showLoading({ title: '加载中...' })
    cloud.callFunction({
      name: 'getStudentHomeworkDetail',
      data: {
        homeworkId: this.data.homeworkId,
        studentId: this.data.studentId
      }
    }).then(res => {
      wx.hideLoading()
      const r = res.result
      if (!r.success) {
        wx.showToast({ title: r.message, icon: 'none' })
        return
      }
      if (r.empty) {
        wx.showToast({ title: '学生未提交', icon: 'none' })
        setTimeout(() => wx.navigateBack(), 1500)
        return
      }
      const qComments = {}
      r.questions.forEach(q => { qComments[q.questionId] = q.comment || '' })
      const questions = this.prepareQuestions(r.questions || [])
      this.setData({
        submissionId: r.submissionId,
        homeworkInfo: r.homeworkInfo,
        studentName: r.studentName,
        questions,
        currentIndex: 0,
        correctCount: r.correctCount,
        totalCount: r.totalCount,
        questionComments: qComments
      })
    }).catch(err => {
      wx.hideLoading()
      console.error(err)
    })
  },

  prepareQuestions(questions) {
    const choiceTypes = ['single_choice', 'multiple_choice']
    return questions.map(q => {
      if (q.options && q.options.length > 0) {
        q.options = q.options.map((opt, i) => ({
          text: opt,
          letter: String.fromCharCode(65 + i)
        }))
      }
      if (q.type === 'fill_blank' || q.type === 'essay') {
        q.content = (q.content || '').replace(/\\n/g, '\n')
      }
      if (choiceTypes.includes(q.type) && q.answer) {
        const letters = (q.answer || '').replace(/[^a-zA-Z]/g, '').toUpperCase().split('')
        q.answerDisplay = letters.join(', ')
      }
      if (choiceTypes.includes(q.type) && q.userAnswer) {
        const letters = (q.userAnswer || '').replace(/[^a-zA-Z]/g, '').toUpperCase().split('')
        q.userAnswerDisplay = letters.join(', ')
      }
      return q
    })
  },

  onQuestionComment(e) {
    const currentQ = this.data.questions[this.data.currentIndex]
    if (!currentQ) return
    const qComments = { ...this.data.questionComments }
    qComments[currentQ.questionId] = e.detail.value
    this.setData({ questionComments: qComments })
  },

  // 返回
  goBack() {
    wx.navigateBack()
  },

  // 跳转到指定题
  onJumpTo(e) {
    const index = parseInt(e.currentTarget.dataset.index)
    const questions = this.data.questions
    if (!isNaN(index) && index >= 0 && index < questions.length) {
      this.setData({ currentIndex: index })
    }
  },

  // 上一题
  onPrev() {
    if (this.data.currentIndex > 0) {
      this.setData({ currentIndex: this.data.currentIndex - 1 })
    }
  },

  // 下一题
  onNext() {
    if (this.data.currentIndex < this.data.questions.length - 1) {
      this.setData({ currentIndex: this.data.currentIndex + 1 })
    }
  },

  async submitComments() {
    const { submissionId, questionComments, saving } = this.data
    if (saving) return
    if (!submissionId) return

    this.setData({ saving: true })
    wx.showLoading({ title: '提交中...' })

    try {
      for (const qId in questionComments) {
        await cloud.callFunction({
          name: 'saveComment',
          data: { submissionId, questionId: qId, comment: questionComments[qId] }
        })
      }

      wx.hideLoading()
      wx.showToast({ title: '评语已提交', icon: 'success' })
      this.setData({ saving: false })
    } catch (err) {
      wx.hideLoading()
      this.setData({ saving: false })
      wx.showToast({ title: '提交失败', icon: 'none' })
    }
  }
})
