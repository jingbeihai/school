const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const app = express();

// ==================== 中间件 ====================
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// 静态文件目录（头像、上传图片等）
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==================== 路由 ====================
app.use('/api/auth', require('./routes/auth'));
app.use('/api/user', require('./routes/user'));
app.use('/api/class', require('./routes/class'));
app.use('/api/question', require('./routes/question'));
app.use('/api/homework', require('./routes/homework'));
app.use('/api/submission', require('./routes/submission'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/group', require('./routes/group'));
app.use('/api/student-group', require('./routes/studentGroup'));
app.use('/api/shared', require('./routes/shared'));
app.use('/api/parent', require('./routes/parent'));

// ==================== 健康检查 ====================
app.get('/api/health', (req, res) => {
  res.json({ code: 0, message: 'OK', data: { status: 'running', time: new Date() } });
});

// ==================== 错误处理 ====================
app.use(require('./middleware/errorHandler'));

// ==================== 启动 ====================
const PORT = process.env.PORT || 3000;

// 先同步数据库，再启动服务
const { sequelize } = require('./models');

sequelize.sync({ alter: process.env.DB_ALTER === 'true' }).then(() => {
  console.log('数据库同步完成');
  app.listen(PORT, '127.0.0.1', () => {
    console.log(`服务已启动: http://127.0.0.1:${PORT}`);
    console.log(`环境: ${process.env.NODE_ENV || 'development'}`);
  });
}).catch(err => {
  console.error('数据库同步失败:', err);
  // 即使数据库失败也启动服务，方便调试
  app.listen(PORT, () => {
    console.log(`服务已启动(数据库未连接): http://localhost:${PORT}`);
  });
});

module.exports = app;
