module.exports = (err, req, res, next) => {
  console.error('服务器错误:', err);

  // Sequelize 验证错误
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      code: -1,
      message: '数据验证失败: ' + err.errors.map(e => e.message).join(', ')
    });
  }

  // Sequelize 唯一约束冲突
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      code: -1,
      message: '数据已存在'
    });
  }

  // Multer 文件上传错误
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      code: -1,
      message: '文件大小不能超过 10MB'
    });
  }

  // 默认错误
  res.status(err.status || 500).json({
    code: -1,
    message: err.message || '服务器内部错误'
  });
};
