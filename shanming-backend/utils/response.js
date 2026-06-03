class Response {
  static success(data = null, message = 'OK') {
    return { code: 0, message, data };
  }

  static fail(message = '操作失败', code = -1) {
    return { code, message, data: null };
  }

  static paginate(rows, total, page, pageSize) {
    return {
      code: 0,
      message: 'OK',
      data: {
        list: rows,
        pagination: {
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize)
        }
      }
    };
  }
}

module.exports = Response;
