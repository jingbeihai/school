const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  const { keyword, page = 1, pageSize = 20 } = event

  try {
    let query = {}
    if (keyword && keyword.trim()) {
      const kw = keyword.trim()
      query = _.or([
        { tags: _.in([kw]) },
        { content: db.RegExp({ regexp: kw, options: 'i' }) },
        { tags: db.RegExp({ regexp: kw, options: 'i' }) }
      ])
    }

    const totalRes = await db.collection('shared_questions').where(query).count()
    const total = totalRes.total

    const res = await db.collection('shared_questions')
      .where(query)
      .orderBy('createTime', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()

    return {
      success: true,
      questions: res.data,
      total,
      hasMore: (page * pageSize) < total
    }
  } catch (err) {
    console.error('getSharedQuestions error:', err)
    return { success: false, message: err.message }
  }
}
