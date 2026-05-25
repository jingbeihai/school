const app = getApp()

Component({
  data: {
    list: [],
    selected: 0
  },

  lifetimes: {
    attached() {
      this.updateTabs()
    }
  },

  pageLifetimes: {
    show() {
      this.updateTabs()
    }
  },

  methods: {
    updateTabs() {
      const role = app.globalData.role || wx.getStorageSync('role') || 'teacher'
      const pages = getCurrentPages()
      const currentPage = pages[pages.length - 1]
      const currentPath = '/' + currentPage.route

      let tabs = []
      if (role === 'teacher') {
        tabs = [
          { pagePath: '/pages/teacher/homeworkList/index', text: '批阅', icon: '📝' },
          { pagePath: '/pages/teacher/publishHomework/index', text: '题库', icon: '📚' },
          { pagePath: '/pages/teacher/profile/index', text: '我的', icon: '👤' }
        ]
      } else if (role === 'student') {
        tabs = [
          { pagePath: '/pages/student/homework/index', text: '作业', icon: '📝' },
          { pagePath: '/pages/student/questionBank/index', text: '题库', icon: '📚' },
          { pagePath: '/pages/student/profile/index', text: '我的', icon: '👤' }
        ]
      } else if (role === 'parent') {
        tabs = [
          { pagePath: '/pages/parent/homework/index', text: '作业', icon: '📝' },
          { pagePath: '/pages/parent/profile/index', text: '我的', icon: '👤' }
        ]
      }

      const selected = tabs.findIndex(t => t.pagePath === currentPath)

      this.setData({
        list: tabs,
        selected: selected >= 0 ? selected : 0
      })
    },

    switchTab(e) {
      const index = e.currentTarget.dataset.index
      const tab = this.data.list[index]
      if (tab && index !== this.data.selected) {
        wx.switchTab({ url: tab.pagePath })
      }
    }
  }
})
