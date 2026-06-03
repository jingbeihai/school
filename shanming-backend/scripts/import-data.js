/**
 * 数据导入脚本 - 将云开发导出的JSON导入MySQL
 * 使用: node scripts/import-data.js <导出的JSON文件路径>
 */
const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');

const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 3306,
  database: process.env.DB_NAME || 'shanming_edu',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'your_password'
};

const FIELD_MAP = {
  'openId': 'openid', '_openid': 'openid', 'realName': 'real_name',
  'is_vip': 'is_vip', 'vipExpireDate': 'vip_expire_date',
  'free_trial_used': 'free_trial_used', 'userCode': 'user_code',
  'teacherId': 'teacher_id', 'inviteCode': 'invite_code',
  'studentCount': 'student_count', 'classId': 'class_id',
  'studentId': 'student_id', 'joinedAt': 'joined_at',
  'isPublic': 'is_public', 'questionCount': 'question_count',
  'submittedCount': 'submitted_count', 'homeworkId': 'homework_id',
  'totalScore': 'total_score', 'submitTime': 'submit_time',
  'reviewTime': 'review_time', 'reviewerId': 'reviewer_id',
  'sharedBy': 'shared_by', 'sharedAt': 'shared_at',
  'sortOrder': 'sort_order', 'addedAt': 'added_at',
  'parentId': 'parent_id', 'linkedAt': 'linked_at'
};

const COLLECTION_MAP = {
  'users': 'users', 'classes': 'classes', 'class_students': 'class_students',
  'questions': 'questions', 'shared_questions': 'shared_questions',
  'question_groups': 'question_groups', 'group_questions': 'group_questions',
  'homework': 'homework', 'homework_questions': 'homework_questions',
  'submissions': 'submissions', 'student_question_groups': 'student_question_groups',
  'student_group_questions': 'student_group_questions', 'parent_students': 'parent_students'
};

function transformFields(record) {
  const transformed = {};
  for (const [key, value] of Object.entries(record)) {
    if (key === '_id' || key === 'id') { transformed['id'] = value; continue; }
    const mapped = FIELD_MAP[key] || key;
    transformed[mapped] = value;
  }
  return transformed;
}

async function main() {
  const jsonPath = process.argv[2];
  if (!jsonPath) { console.error('请指定数据文件路径'); process.exit(1); }

  const raw = fs.readFileSync(jsonPath, 'utf-8');
  const data = JSON.parse(raw);

  const sequelize = new Sequelize(DB_CONFIG.database, DB_CONFIG.user, DB_CONFIG.password, {
    host: DB_CONFIG.host, port: DB_CONFIG.port, dialect: 'mysql', logging: true
  });
  await sequelize.authenticate();
  console.log('数据库连接成功');

  for (const [cloudName, tableName] of Object.entries(COLLECTION_MAP)) {
    const records = data[cloudName];
    if (!records || !records.length) { console.log(`${cloudName}: 无数据`); continue; }
    let success = 0, fail = 0;
    for (const record of records) {
      try {
        const transformed = transformFields(record);
        Object.keys(transformed).forEach(k => { if (transformed[k] === undefined) delete transformed[k]; });
        await sequelize.query(`INSERT INTO \`${tableName}\` SET ? ON DUPLICATE KEY UPDATE ?`, {
          replacements: [transformed, transformed], type: Sequelize.QueryTypes.INSERT
        });
        success++;
      } catch (err) { fail++; if (fail <= 3) console.error(`失败: ${err.message.substring(0, 100)}`); }
    }
    console.log(`${cloudName}: 成功${success}, 失败${fail}`);
  }
  await sequelize.close();
  console.log('导入完成!');
}

main().catch(err => { console.error(err); process.exit(1); });
