# 山鸣谷应学堂 - 自建后端服务

## 云服务器部署（1Panel）

### 1. 上传代码

将 `shanming-backend/` 目录上传到服务器，例如 `/opt/shanming-backend/`。

### 2. 配置环境变量

复制并编辑 `.env`：

```bash
cp .env.example .env
nano .env
```

必须填写：

| 变量 | 说明 |
|------|------|
| `WX_SECRET` | 微信小程序 AppSecret（[微信公众平台](https://mp.weixin.qq.com) → 开发 → 开发管理 → 开发设置） |
| `JWT_SECRET` | 随机字符串，用于登录 token |
| `DB_*` | 数据库连接信息（已在 .env 中预填） |

### 3. 安装依赖并启动

```bash
cd /opt/shanming-backend
npm install
npm start
```

建议使用 PM2 守护进程：

```bash
npm install -g pm2
pm2 start app.js --name shanming-api
pm2 save
pm2 startup
```

### 4. 反向代理

在 1Panel 中将 `101.43.84.176:1357` 反向代理到 Node 服务（默认监听 `PORT=1357`）。

验证：

```bash
curl http://127.0.0.1:1357/api/health
```

### 5. 微信小程序配置

1. 登录 [微信公众平台](https://mp.weixin.qq.com)
2. **开发 → 开发管理 → 服务器域名** 中添加：
   - request 合法域名：`http://101.43.84.176:1357`（生产环境建议配置 HTTPS 域名）
   - uploadFile 合法域名：同上
3. 小程序端 `utils/config.js` 中的 `baseUrl` 需与服务器地址一致

### 6. 数据迁移（可选）

若需从微信云开发迁移历史数据：

1. 运行 `node scripts/export-cloud-data.js` 导出云数据库 JSON
2. 运行 `node scripts/import-data.js 导出的文件.json` 导入 MySQL

---

## 云函数 → API 路由对照表

| 原云函数 | 对应 API 路由 |
|---------|-------------|
| login | POST /api/auth/wx-login |
| updateUserProfile | PUT /api/user/profile |
| createClass | POST /api/class/create |
| deleteClass | DELETE /api/class/delete |
| updateClass | PUT /api/class/update |
| getClassList | GET /api/class/list |
| getClassDetail | GET /api/class/detail |
| addStudentToClass | POST /api/class/add-student |
| removeStudentFromClass | POST /api/class/remove-student |
| joinClass | POST /api/class/join |
| leaveClass | POST /api/class/leave |
| createGroup | POST /api/question/group/create |
| deleteGroup | DELETE /api/question/group/delete |
| getGroups | GET /api/question/group/list |
| getGroupQuestions | GET /api/question/group/questions |
| addQuestionsToGroup | POST /api/question/group/add-questions |
| removeQuestionsFromGroup | POST /api/question/group/remove-questions |
| publishHomework | POST /api/homework/publish |
| deleteHomework | DELETE /api/homework/delete |
| withdrawHomework | PUT /api/homework/withdraw |
| getHomeworkList | GET /api/homework/list |
| getHomeworkForReview | GET /api/homework/for-review |
| getHomeworkQuestions | GET /api/homework/questions |
| getHomeworkStudentsProgress | GET /api/homework/student-progress |
| getStudentHomeworkList | GET /api/homework/student-homework-list |
| getStudentHomeworkDetail | GET /api/submission/student-homework-detail |
| submitAnswer | POST /api/submission/submit-answer |
| saveComment | POST /api/submission/review |
| createStudentGroup | POST /api/student-group/create |
| deleteStudentGroup | DELETE /api/student-group/delete |
| getStudentGroups | GET /api/student-group/list |
| getStudentGroupQuestions | GET /api/student-group/questions |
| addQuestionsToStudentGroup | POST /api/student-group/add-questions |
| removeQuestionsFromStudentGroup | POST /api/student-group/remove-questions |
| moveStudentGroupQuestions | POST /api/student-group/move-questions |
| getParentHomeworkList | GET /api/parent/homework-list |
| getParentHomeworkDetail | GET /api/submission/student-homework-detail |
| getParentStudents | GET /api/parent/students |
| getParentStudentDetail | GET /api/parent/student-detail |
| linkStudent | POST /api/parent/link |
| unlinkStudent | DELETE /api/parent/unlink |
| generateQuestions | POST /api/ai/generate-questions |
| ocrImage | POST /api/ai/ocr（需配置OCR服务） |
| parseDocument | POST /api/ai/parse-document（需配置） |
| reuseQuestions | POST /api/homework/reuse |
| getSharedQuestions | GET /api/shared/questions |

## 项目结构

```
shanming-backend/
├── app.js           # 入口
├── config/          # 配置
├── middleware/      # 中间件（auth认证、错误处理）
├── models/          # Sequelize 数据模型
├── routes/          # API 路由
├── scripts/         # 工具脚本（数据迁移）
├── uploads/         # 上传文件目录
└── utils/           # 工具函数
```
