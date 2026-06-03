const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { User } = require('../models');
const Response = require('../utils/response');
const auth = require('../middleware/auth');
const config = require('../config');

const uploadDir = path.join(__dirname, '..', 'uploads');
['avatars', 'temp', 'documents'].forEach(dir => {
  const p = path.join(uploadDir, dir);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, path.join(uploadDir, req.body.type || 'temp')); },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).substr(2, 8)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: config.upload.maxFileSize }
});

router.post('/avatar', auth, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json(Response.fail('请选择文件'));
    const url = `${config.server.domain}/uploads/avatars/${req.file.filename}`;
    await User.update({ avatar: url }, { where: { id: req.userId } });
    res.json(Response.success({ url }, '上传成功'));
  } catch (err) { next(err); }
});

router.post('/image', auth, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json(Response.fail('请选择文件'));
    const url = `${config.server.domain}/uploads/temp/${req.file.filename}`;
    res.json(Response.success({ url, filename: req.file.filename, path: `/uploads/temp/${req.file.filename}`, size: req.file.size }));
  } catch (err) { next(err); }
});

router.post('/document', auth, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json(Response.fail('请选择文件'));
    const url = `${config.server.domain}/uploads/documents/${req.file.filename}`;
    res.json(Response.success({ url, filename: req.file.filename, path: `/uploads/documents/${req.file.filename}`, originalName: req.file.originalname, size: req.file.size }));
  } catch (err) { next(err); }
});

module.exports = router;
