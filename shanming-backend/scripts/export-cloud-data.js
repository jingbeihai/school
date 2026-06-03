/**
 * 云开发数据导出脚本
 * 将此脚本部署为云函数，运行后从云开发数据库读取所有数据，输出为JSON文件到云存储
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-d7gk7ix8d2ebbb913' });
const db = cloud.database();

const COLLECTIONS = ['users', 'classes', 'class_students', 'questions', 'shared_questions',
  'question_groups', 'group_questions', 'homework', 'homework_questions', 'submissions',
  'student_question_groups', 'student_group_questions', 'parent_students'];

async function getAllData(collectionName) {
  const collection = db.collection(collectionName);
  let allData = [], offset = 0, limit = 100;
  while (true) {
    const res = await collection.skip(offset).limit(limit).get();
    allData = allData.concat(res.data);
    if (res.data.length < limit) break;
    offset += limit;
  }
  return allData;
}

exports.main = async (event, context) => {
  const result = {};
  for (const name of COLLECTIONS) {
    try {
      result[name] = await getAllData(name);
    } catch (err) {
      result[name] = { error: err.message };
    }
  }
  const fs = require('fs');
  const path = require('path');
  const tmpPath = path.join('/tmp', 'cloud-data-export.json');
  fs.writeFileSync(tmpPath, JSON.stringify(result, null, 2));
  const fileRes = await cloud.uploadFile({
    cloudPath: `migration/cloud-data-${Date.now()}.json`,
    fileContent: fs.readFileSync(tmpPath)
  });
  return {
    success: true,
    fileID: fileRes.fileID,
    collections: Object.keys(result).map(k => ({ name: k, count: Array.isArray(result[k]) ? result[k].length : 0 }))
  };
};
