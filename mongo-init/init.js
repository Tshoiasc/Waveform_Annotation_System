// 初始化数据库和集合
db = db.getSiblingDB('waveform-annotation-system');

// 创建集合
db.createCollection('users');
db.createCollection('event_templates');
db.createCollection('event_annotations');
db.createCollection('trial_metadata');

// 创建索引
db.users.createIndex({ username: 1 }, { unique: true });
db.users.createIndex({ email: 1 }, { unique: true });

db.event_annotations.createIndex({ fileId: 1, trialIndex: 1 }, { unique: true });
db.event_annotations.createIndex({ userId: 1 });
db.event_annotations.createIndex({ status: 1 });

db.event_templates.createIndex({ isGlobal: 1 });
db.event_templates.createIndex({ createdBy: 1 });

db.trial_metadata.createIndex({ fileId: 1, trialIndex: 1 }, { unique: true });

print("✅ 基础结构初始化完成");
