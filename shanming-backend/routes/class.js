const express = require('express');
const { Op } = require('sequelize');
const router = express.Router();
const { Class, ClassStudent, User } = require('../models');
const Response = require('../utils/response');
const auth = require('../middleware/auth');

function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

router.post('/create', auth, async (req, res, next) => {
  try {
    if (req.role !== 'teacher') return res.status(403).json(Response.fail('仅教师可创建班级'));
    const { name, subject, description, inviteCode: customCode } = req.body;
    if (!name) return res.status(400).json(Response.fail('请输入班级名称'));

    const teacher = await User.findByPk(req.userId);
    let inviteCode = customCode || generateInviteCode();
    while (await Class.findOne({ where: { invite_code: inviteCode } })) inviteCode = generateInviteCode();

    const cls = await Class.create({
      name, teacher_id: req.userId, teacher_name: teacher ? (teacher.nickname || '教师') : '教师',
      invite_code: inviteCode, subject: subject || '', description: description || ''
    });
    res.json(Response.success({
      id: cls.id, _id: cls.id, name: cls.name, inviteCode: cls.invite_code,
      teacherId: cls.teacher_id, teacherName: cls.teacher_name,
      subject: cls.subject, description: cls.description, createTime: cls.created_at
    }));
  } catch (err) { next(err); }
});

router.get('/list', auth, async (req, res, next) => {
  try {
    let classes;
    if (req.role === 'teacher') {
      classes = await Class.findAll({ where: { teacher_id: req.userId, status: 'active' }, include: [{ model: User, as: 'teacher', attributes: ['real_name', 'nickname'] }], order: [['created_at', 'DESC']] });
    } else if (req.role === 'student') {
      const myClassIds = await ClassStudent.findAll({ where: { student_id: req.userId, status: 'active' }, attributes: ['class_id'] });
      classes = await Class.findAll({ where: { id: myClassIds.map(c => c.class_id), status: 'active' }, include: [{ model: User, as: 'teacher', attributes: ['real_name', 'nickname'] }], order: [['created_at', 'DESC']] });
    } else {
      return res.json(Response.success([]));
    }
    res.json(Response.success(classes));
  } catch (err) { next(err); }
});

router.get('/detail', auth, async (req, res, next) => {
  try {
    const { id, classId } = req.query;
    const classIdVal = id || classId;
    if (!classIdVal) return res.status(400).json(Response.fail('缺少班级ID'));
    const cls = await Class.findByPk(classIdVal, {
      include: [
        { model: User, as: 'teacher', attributes: ['id', 'real_name', 'nickname', 'avatar'] },
        { model: ClassStudent, where: { status: 'active' }, required: false, include: [{ model: User, as: 'student', attributes: ['id', 'real_name', 'nickname', 'avatar', 'user_code', 'phone', 'is_vip'] }] }
      ]
    });
    if (!cls) return res.status(404).json(Response.fail('班级不存在'));
    const students = (cls.ClassStudents || []).map(cs => ({
      _id: cs.id,
      studentId: cs.student ? cs.student.id : cs.student_id,
      studentName: cs.student ? (cs.student.nickname || cs.student.real_name || '学生') : '学生',
      userCode: cs.student ? cs.student.user_code : '',
      avatarUrl: cs.student ? cs.student.avatar : '',
      phone: cs.student ? cs.student.phone : '',
      isVip: cs.student ? !!cs.student.is_vip : false,
      joinTime: cs.joined_at || cs.created_at,
      parentName: '未绑定'
    }));
    res.json(Response.success({
      id: cls.id, name: cls.name, inviteCode: cls.invite_code, subject: cls.subject, description: cls.description,
      teacher: cls.teacher, studentCount: students.length, students, createdAt: cls.created_at,
      classInfo: {
        _id: cls.id, name: cls.name, teacherId: cls.teacher_id,
        teacherName: cls.teacher_name || (cls.teacher ? cls.teacher.nickname : ''),
        inviteCode: cls.invite_code, createTime: cls.created_at, status: cls.status, studentCount: students.length,
        joinTime: (cls.ClassStudents || []).find(cs => cs.student_id === req.userId) ?
          ((cls.ClassStudents || []).find(cs => cs.student_id === req.userId).joined_at ||
           (cls.ClassStudents || []).find(cs => cs.student_id === req.userId).created_at) : null
      }
    }));
  } catch (err) { next(err); }
});

router.put('/update', auth, async (req, res, next) => {
  try {
    if (req.role !== 'teacher') return res.status(403).json(Response.fail('仅教师可操作'));
    const { id, name, subject, description } = req.body;
    const cls = await Class.findOne({ where: { id, teacher_id: req.userId } });
    if (!cls) return res.status(404).json(Response.fail('班级不存在或无权限'));
    const updateData = {};
    if (name) updateData.name = name;
    if (subject !== undefined) updateData.subject = subject;
    if (description !== undefined) updateData.description = description;
    await cls.update(updateData);
    res.json(Response.success(null, '更新成功'));
  } catch (err) { next(err); }
});

router.delete('/delete', auth, async (req, res, next) => {
  try {
    if (req.role !== 'teacher') return res.status(403).json(Response.fail('仅教师可操作'));
    const { id } = req.body;
    const cls = await Class.findOne({ where: { id, teacher_id: req.userId } });
    if (!cls) return res.status(404).json(Response.fail('班级不存在或无权限'));
    await cls.update({ status: 'archived' });
    res.json(Response.success(null, '删除成功'));
  } catch (err) { next(err); }
});

router.post('/join', auth, async (req, res, next) => {
  try {
    if (req.role !== 'student') return res.status(403).json(Response.fail('仅学生可加入班级'));
    const { inviteCode } = req.body;
    if (!inviteCode) return res.status(400).json(Response.fail('请输入邀请码'));
    const cls = await Class.findOne({ where: { invite_code: inviteCode.toUpperCase(), status: 'active' } });
    if (!cls) return res.status(404).json(Response.fail('邀请码无效'));
    const existing = await ClassStudent.findOne({ where: { class_id: cls.id, student_id: req.userId } });
    if (existing) {
      if (existing.status === 'left') { await existing.update({ status: 'active' }); await cls.increment('student_count'); return res.json(Response.success(null, '重新加入成功')); }
      return res.json(Response.fail('您已在该班级中'));
    }
    await ClassStudent.create({ class_id: cls.id, student_id: req.userId });
    await cls.increment('student_count');
    res.json(Response.success(null, '加入成功'));
  } catch (err) { next(err); }
});

router.post('/leave', auth, async (req, res, next) => {
  try {
    const { classId } = req.body;
    const cs = await ClassStudent.findOne({ where: { class_id: classId, student_id: req.userId, status: 'active' } });
    if (!cs) return res.status(404).json(Response.fail('未找到班级成员'));
    await cs.update({ status: 'left' });
    await Class.decrement('student_count', { where: { id: classId } });
    res.json(Response.success(null, '已退出班级'));
  } catch (err) { next(err); }
});

router.post('/add-student', auth, async (req, res, next) => {
  try {
    if (req.role !== 'teacher') return res.status(403).json(Response.fail('仅教师可操作'));
    const { classId, studentId, userCode } = req.body;
    const cls = await Class.findOne({ where: { id: classId, teacher_id: req.userId } });
    if (!cls) return res.status(404).json(Response.fail('班级不存在或无权限'));

    let targetStudentId = studentId;
    if (!targetStudentId && userCode) {
      const student = await User.findOne({ where: { user_code: userCode, role: 'student' } });
      if (!student) return res.status(404).json(Response.fail('未找到该识别码对应的学生'));
      targetStudentId = student.id;
    }
    if (!targetStudentId) return res.status(400).json(Response.fail('请提供学生ID或识别码'));

    const existing = await ClassStudent.findOne({ where: { class_id: classId, student_id: targetStudentId } });
    if (existing) {
      if (existing.status === 'left') { await existing.update({ status: 'active' }); await cls.increment('student_count'); return res.json(Response.success(null, '已重新添加')); }
      return res.json(Response.fail('该学生已在班级中'));
    }
    await ClassStudent.create({ class_id: classId, student_id: targetStudentId });
    await cls.increment('student_count');
    res.json(Response.success(null, '添加成功'));
  } catch (err) { next(err); }
});

router.post('/remove-student', auth, async (req, res, next) => {
  try {
    if (req.role !== 'teacher') return res.status(403).json(Response.fail('仅教师可操作'));
    const { classId, studentId } = req.body;
    const cls = await Class.findOne({ where: { id: classId, teacher_id: req.userId } });
    if (!cls) return res.status(404).json(Response.fail('班级不存在或无权限'));
    const cs = await ClassStudent.findOne({ where: { class_id: classId, student_id: studentId, status: 'active' } });
    if (!cs) return res.status(404).json(Response.fail('该学生不在班级中'));
    await cs.update({ status: 'left' });
    await cls.decrement('student_count');
    res.json(Response.success(null, '已移除'));
  } catch (err) { next(err); }
});

module.exports = router;
