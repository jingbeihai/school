// utils/cloud.js - 云函数兼容层，将 wx.cloud 调用转发到自建后端
const config = require('./config');

const GROUP_TYPE_TO_API = { collection: 'favorite', error: 'wrong' };
const GROUP_TYPE_FROM_API = { favorite: 'collection', wrong: 'error' };

function mapGroupTypeToApi(type) {
  return GROUP_TYPE_TO_API[type] || type;
}

function mapGroupTypeFromApi(type) {
  return GROUP_TYPE_FROM_API[type] || type;
}

function toCloudObject(obj) {
  if (obj == null) return obj;
  if (Array.isArray(obj)) return obj.map(toCloudObject);
  if (typeof obj !== 'object') return obj;

  const result = {};
  Object.keys(obj).forEach(key => {
    const val = obj[key];
    if (key === 'id' && obj._id === undefined) {
      result._id = val;
    } else if (key === 'nickname') {
      result.nickName = val;
    } else if (key === 'avatar') {
      result.avatarUrl = val;
    } else if (key === 'teacher_id') {
      result.teacherId = val;
    } else if (key === 'invite_code') {
      result.inviteCode = val;
    } else if (key === 'teacher_name') {
      result.teacherName = val;
    } else if (key === 'created_at') {
      result.createTime = val;
    } else if (key === 'user_code') {
      result.userCode = val;
    } else if (key === 'class_id') {
      result.classId = val;
    } else if (key === 'is_vip') {
      result.isVip = !!val;
    } else if (key === 'type' && GROUP_TYPE_FROM_API[val]) {
      result.type = mapGroupTypeFromApi(val);
    } else {
      result[key] = toCloudObject(val);
    }
  });
  if (obj.id !== undefined && result._id === undefined) result._id = obj.id;
  return result;
}

function apiSuccess(data) {
  if (data == null) return { success: true };
  if (typeof data !== 'object' || Array.isArray(data)) {
    return { success: true, data };
  }
  const mapped = toCloudObject(data);
  return { success: true, ...mapped };
}

function apiFail(res) {
  return { success: false, message: res.message || '操作失败' };
}

function request(method, path, data = {}, needAuth = true) {
  return new Promise((resolve, reject) => {
    const header = { 'Content-Type': 'application/json' };
    if (needAuth) {
      const token = wx.getStorageSync('token');
      if (token) header.Authorization = 'Bearer ' + token;
    }
    wx.request({
      url: config.baseUrl + path,
      method,
      data,
      header,
      timeout: config.timeout,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          reject(res.data || { message: '请求失败 ' + res.statusCode });
        }
      },
      fail: (err) => reject(err)
    });
  });
}

function get(path, params) {
  const qs = params ? '?' + Object.keys(params).map(k => `${k}=${encodeURIComponent(params[k])}`).join('&') : '';
  return request('GET', path + qs);
}

function post(path, data) { return request('POST', path, data); }
function put(path, data) { return request('PUT', path, data); }
function del(path, data) { return request('DELETE', path, data); }

async function wxLoginCode() {
  return new Promise((resolve, reject) => {
    wx.login({ success: r => r.code ? resolve(r.code) : reject(new Error('获取code失败')), fail: reject });
  });
}

const handlers = {
  async login(data) {
    const code = await wxLoginCode();
    const res = await post('/api/auth/wx-login', { code, ...data }, false);
    if (res.code === 0) {
      wx.setStorageSync('token', res.data.token);
      return { result: { success: true, userInfo: res.data.userInfo } };
    }
    return { result: apiFail(res) };
  },

  async updateUserProfile(data) {
    const res = await put('/api/user/profile', data);
    if (res.code === 0) {
      const userInfo = res.data.userInfo || res.data;
      return { result: { success: true, userInfo } };
    }
    return { result: apiFail(res) };
  },

  async getClassList() {
    const res = await get('/api/class/list');
    if (res.code !== 0) return { result: apiFail(res) };
    const list = (res.data || []).map(c => toCloudObject({
      id: c.id, name: c.name, teacherId: c.teacher_id,
      teacherName: c.teacher_name || (c.teacher ? c.teacher.nickname : ''),
      inviteCode: c.invite_code, createTime: c.created_at,
      status: c.status, studentCount: c.student_count
    }));
    return { result: { success: true, list } };
  },

  async getStudentClasses() {
    const res = await get('/api/class/list');
    if (res.code !== 0) return { result: apiFail(res) };
    const list = (res.data || []).map(c => toCloudObject({
      id: c.id, name: c.name, teacherId: c.teacher_id,
      teacherName: c.teacher_name || (c.teacher ? c.teacher.nickname : ''),
      inviteCode: c.invite_code, createTime: c.created_at,
      status: c.status, studentCount: c.student_count, joinTime: c.joined_at
    }));
    return { result: { success: true, list } };
  },

  async createClass(data) {
    const res = await post('/api/class/create', data);
    if (res.code === 0) {
      return { result: { success: true, classInfo: toCloudObject(res.data) } };
    }
    return { result: apiFail(res) };
  },

  async deleteClass(data) {
    const res = await del('/api/class/delete', { id: data.classId });
    return { result: res.code === 0 ? { success: true } : apiFail(res) };
  },

  async updateClass(data) {
    const res = await put('/api/class/update', { id: data.classId, name: data.name });
    return { result: res.code === 0 ? { success: true } : apiFail(res) };
  },

  async getClassDetail(data) {
    const res = await get('/api/class/detail', { classId: data.classId });
    if (res.code === 0) return { result: { success: true, ...res.data, classInfo: res.data.classInfo, students: res.data.students } };
    return { result: apiFail(res) };
  },

  async getStudentClassDetail(data) {
    const res = await get('/api/class/detail', { classId: data.classId });
    if (res.code !== 0) return { result: apiFail(res) };
    const cls = res.data;
    const classInfo = {
      _id: cls.id, name: cls.name, teacherName: cls.teacher_name || (cls.teacher ? cls.teacher.nickname : ''),
      inviteCode: cls.invite_code, createTime: cls.created_at, status: cls.status,
      studentCount: cls.student_count || (cls.students ? cls.students.length : 0),
      joinTime: (cls.classInfo && cls.classInfo.joinTime) || cls.joinTime || cls.created_at
    };
    const teacherInfo = cls.teacher ? toCloudObject({
      nickname: cls.teacher.nickname, avatar: cls.teacher.avatar, real_name: cls.teacher.real_name
    }) : {};
    return { result: { success: true, classInfo, teacherInfo } };
  },

  async getStudentDetail(data) {
    const res = await get('/api/user/student-detail', { studentId: data.studentId, classId: data.classId });
    if (res.code !== 0) return { result: apiFail(res) };
    return { result: { success: true, student: toCloudObject(res.data.student) } };
  },

  async addStudentToClass(data) {
    const res = await post('/api/class/add-student', { classId: data.classId, userCode: data.userCode, studentId: data.studentId });
    return { result: res.code === 0 ? { success: true } : apiFail(res) };
  },

  async removeStudentFromClass(data) {
    const res = await post('/api/class/remove-student', data);
    return { result: res.code === 0 ? { success: true } : apiFail(res) };
  },

  async joinClass(data) {
    const res = await post('/api/class/join', data);
    return { result: res.code === 0 ? { success: true, message: res.message } : apiFail(res) };
  },

  async leaveClass(data) {
    const res = await post('/api/class/leave', data);
    return { result: res.code === 0 ? { success: true } : apiFail(res) };
  },

  async createGroup(data) {
    const res = await post('/api/question/group/create', data);
    if (res.code === 0) return { result: { success: true, groupId: res.data.id } };
    return { result: apiFail(res) };
  },

  async deleteGroup(data) {
    const res = await del('/api/question/group/delete', { id: data.groupId });
    return { result: res.code === 0 ? { success: true } : apiFail(res) };
  },

  async getGroups() {
    const res = await get('/api/question/group/list');
    if (res.code !== 0) return { result: apiFail(res) };
    const groups = (res.data || []).map(g => toCloudObject({ _id: g.id, name: g.name, questionCount: g.questionCount, createTime: g.createdAt }));
    return { result: { success: true, groups } };
  },

  async getGroupQuestions(data) {
    const res = await get('/api/question/group/questions', { groupId: data.groupId });
    if (res.code !== 0) return { result: apiFail(res) };
    const questions = (res.data.questions || []).map(q => toCloudObject(q));
    return { result: { success: true, questions, groupName: res.data.name } };
  },

  async addQuestionsToGroup(data) {
    const res = await post('/api/question/group/add-questions', data);
    return { result: res.code === 0 ? { success: true } : apiFail(res) };
  },

  async removeQuestionsFromGroup(data) {
    const res = await post('/api/question/group/remove-questions', data);
    return { result: res.code === 0 ? { success: true } : apiFail(res) };
  },

  async publishHomework(data) {
    const res = await post('/api/homework/publish', data);
    if (res.code === 0) return { result: { success: true, homeworkId: res.data.homeworkId || res.data.id } };
    return { result: apiFail(res) };
  },

  async deleteHomework(data) {
    const res = await del('/api/homework/delete', { homeworkId: data.homeworkId });
    return { result: res.code === 0 ? { success: true } : apiFail(res) };
  },

  async withdrawHomework(data) {
    const res = await put('/api/homework/withdraw', { homeworkId: data.homeworkId });
    return { result: res.code === 0 ? { success: true } : apiFail(res) };
  },

  async getHomeworkList() {
    const res = await get('/api/homework/list');
    if (res.code !== 0) return { result: apiFail(res) };
    const list = (res.data || []).map(h => toCloudObject({
      _id: h.id, title: h.title, classId: h.class_id,
      className: h.Class ? h.Class.name : '',
      publishTime: h.created_at, deadline: h.deadline, status: h.status
    }));
    return { result: { success: true, list } };
  },

  async getHomeworkForReview() {
    const res = await get('/api/homework/for-review');
    if (res.code !== 0) return { result: apiFail(res) };
    return { result: { success: true, homeworkList: res.data.homeworkList || [] } };
  },

  async getHomeworkQuestions(data) {
    const res = await get('/api/homework/questions', { homeworkId: data.homeworkId });
    if (res.code !== 0) return { result: apiFail(res) };
    return { result: { success: true, ...res.data, questions: (res.data.questions || []).map(q => toCloudObject(q)) } };
  },

  async getHomeworkStudentsProgress(data) {
    const res = await get('/api/homework/student-progress', { homeworkId: data.homeworkId });
    if (res.code !== 0) return { result: apiFail(res) };
    const hwRes = await get('/api/homework/detail', { id: data.homeworkId });
    const homework = hwRes.code === 0 ? hwRes.data : {};
    const students = (res.data.progress || []).map(p => {
      const sub = p.status !== 'pending';
      return {
        studentId: p.student ? p.student.id : null,
        name: p.student ? (p.student.nickname || p.student.real_name || '') : '',
        userCode: p.student ? p.student.user_code : '',
        status: sub ? 'answered' : 'not_answered',
        correctCount: 0, totalCount: 0, answeredCount: sub ? 1 : 0,
        correctRate: 0, submitTime: p.submitTime
      };
    });
    return {
      result: {
        success: true,
        homework: { _id: data.homeworkId, title: homework.title || '', className: homework.class ? homework.class.name : '', deadline: homework.deadline },
        students
      }
    };
  },

  async getStudentHomeworkList() {
    const res = await get('/api/homework/student-homework-list');
    if (res.code !== 0) return { result: apiFail(res) };
    return { result: { success: true, list: res.data.list || [] } };
  },

  async getStudentHomeworkDetail(data) {
    const res = await get('/api/submission/student-homework-detail', { homeworkId: data.homeworkId, studentId: data.studentId });
    if (res.code !== 0) return { result: apiFail(res) };
    if (res.data.empty) return { result: { success: true, empty: true, message: res.data.message } };
    return { result: { success: true, ...res.data } };
  },

  async submitAnswer(data) {
    const res = await post('/api/submission/submit-answer', data);
    if (res.code === 0) return { result: { success: true, ...res.data } };
    return { result: apiFail(res) };
  },

  async saveComment(data) {
    const res = await post('/api/submission/review', data);
    return { result: res.code === 0 ? { success: true } : apiFail(res) };
  },

  async createStudentGroup(data) {
    const res = await post('/api/student-group/create', { name: data.name, type: mapGroupTypeToApi(data.type) });
    if (res.code === 0) return { result: { success: true, groupId: res.data.id } };
    return { result: apiFail(res) };
  },

  async deleteStudentGroup(data) {
    const res = await del('/api/student-group/delete', { id: data.groupId });
    return { result: res.code === 0 ? { success: true } : apiFail(res) };
  },

  async getStudentGroups(data) {
    const type = data.type ? mapGroupTypeToApi(data.type) : undefined;
    const res = await get('/api/student-group/list', type ? { type } : {});
    if (res.code !== 0) return { result: apiFail(res) };
    const groups = (res.data || []).map(g => {
      const mapped = toCloudObject(g);
      mapped.type = mapGroupTypeFromApi(g.type);
      mapped.questionCount = g.questionCount || 0;
      return mapped;
    });
    return { result: { success: true, groups } };
  },

  async getStudentGroupQuestions(data) {
    const res = await get('/api/student-group/questions', { groupId: data.groupId });
    if (res.code !== 0) return { result: apiFail(res) };
    return { result: { success: true, questions: (res.data.questions || []).map(q => toCloudObject(q)), group: toCloudObject(res.data) } };
  },

  async addQuestionsToStudentGroup(data) {
    const res = await post('/api/student-group/add-questions', data);
    return { result: res.code === 0 ? { success: true } : apiFail(res) };
  },

  async removeQuestionsFromStudentGroup(data) {
    const res = await post('/api/student-group/remove-questions', data);
    return { result: res.code === 0 ? { success: true } : apiFail(res) };
  },

  async moveStudentGroupQuestions(data) {
    const res = await post('/api/student-group/move-questions', {
      fromGroupId: data.fromGroupId, toGroupId: data.toGroupId, questionIds: data.questionIds
    });
    return { result: res.code === 0 ? { success: true } : apiFail(res) };
  },

  async getParentHomeworkList() {
    const res = await get('/api/parent/homework-list');
    if (res.code !== 0) return { result: apiFail(res) };
    return { result: { success: true, list: res.data.list || res.data || [] } };
  },

  async getParentHomeworkDetail(data) {
    return handlers.getStudentHomeworkDetail({ homeworkId: data.homeworkId, studentId: data.studentId });
  },

  async getParentStudents() {
    const res = await get('/api/parent/students');
    if (res.code !== 0) return { result: apiFail(res) };
    const students = (res.data || []).map(s => toCloudObject({
      _id: s.id, studentId: s.id, studentName: s.nickname || s.real_name,
      nickName: s.nickname, avatarUrl: s.avatar, userCode: s.user_code
    }));
    return { result: { success: true, students } };
  },

  async getParentStudentDetail(data) {
    const res = await get('/api/parent/student-detail', { studentId: data.studentId });
    if (res.code !== 0) return { result: apiFail(res) };
    const student = res.data.student ? toCloudObject(res.data.student) : {};
    const studentInfo = {
      _id: student._id || student.id,
      nickName: student.nickName || student.nickname || student.real_name || '',
      avatarUrl: student.avatarUrl || student.avatar || '',
      userCode: student.userCode || student.user_code || '',
      createTime: student.createTime || student.created_at || ''
    };
    const classList = (res.data.classes || []).map(c => toCloudObject({
      _id: c.id, name: c.name, teacherName: c.teacher_name || '',
      studentCount: c.student_count, inviteCode: c.invite_code
    }));
    return { result: { success: true, studentInfo, classList, recentScores: res.data.recentScores || [] } };
  },

  async linkStudent(data) {
    const res = await post('/api/parent/link', { code: data.code });
    return { result: res.code === 0 ? { success: true, message: res.message || '关联成功' } : apiFail(res) };
  },

  async unlinkStudent(data) {
    const res = await del('/api/parent/unlink', { studentId: data.studentId || data.relationId });
    return { result: res.code === 0 ? { success: true } : apiFail(res) };
  },

  async generateQuestions(data) {
    const res = await post('/api/ai/generate-questions', { userPrompt: data.userPrompt });
    if (res.code === 0) return { result: { success: true, questions: res.data.questions || res.data } };
    return { result: apiFail(res) };
  },

  async ocrImage(data) {
    const res = await post('/api/ai/ocr', { fileID: data.fileID, url: data.url });
    return { result: res.code === 0 ? apiSuccess(res.data) : apiFail(res) };
  },

  async parseDocument(data) {
    const res = await post('/api/ai/parse-document', { fileID: data.fileID });
    return { result: res.code === 0 ? apiSuccess(res.data) : apiFail(res) };
  },

  async getSharedQuestions(data) {
    const res = await get('/api/shared/questions', { page: data.page || 1, pageSize: data.pageSize || 20 });
    if (res.code !== 0) return { result: apiFail(res) };
    const questions = (res.data.list || []).map(item => toCloudObject(item.question || item));
    const total = res.data.pagination ? res.data.pagination.total : questions.length;
    const page = data.page || 1;
    const pageSize = data.pageSize || 20;
    return { result: { success: true, questions, total, hasMore: page * pageSize < total } };
  },

  async reuseQuestions(data) {
    const res = await post('/api/homework/reuse', data);
    return { result: res.code === 0 ? { success: true, ...res.data } : apiFail(res) };
  }
};

function callFunction(options) {
  const { name, data = {} } = options;
  const handler = handlers[name];
  if (!handler) {
    return Promise.reject(new Error('未实现的云函数: ' + name));
  }
  return handler(data).catch(err => {
    console.error('API调用失败 [' + name + ']:', err);
    throw err;
  });
}

function uploadFile(options) {
  const { filePath, cloudPath } = options;
  const token = wx.getStorageSync('token');
  const isAvatar = cloudPath && cloudPath.indexOf('avatars/') === 0;
  const uploadUrl = config.baseUrl + (isAvatar ? '/api/upload/avatar' : '/api/upload/image');

  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: uploadUrl,
      filePath,
      name: 'file',
      header: token ? { Authorization: 'Bearer ' + token } : {},
      formData: { type: isAvatar ? 'avatars' : 'temp' },
      success: (res) => {
        try {
          const body = JSON.parse(res.data);
          if (body.code === 0) {
            resolve({ fileID: body.data.url, statusCode: res.statusCode });
          } else {
            reject(new Error(body.message || '上传失败'));
          }
        } catch (e) {
          reject(e);
        }
      },
      fail: reject
    });
  });
}

module.exports = {
  init() {
    console.log('已切换到自建后端:', config.baseUrl);
  },
  callFunction,
  uploadFile
};
