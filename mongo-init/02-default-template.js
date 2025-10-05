// 默认事件序列模板初始化
db = db.getSiblingDB('waveform-annotation-system');

// 插入默认全局模板
db.event_templates.insertOne({
  name: "标准接触实验",
  isGlobal: true,
  createdBy: null,
  phases: [
    {
      id: "baseline",
      name: "Baseline",
      color: "#38bdf8",
      shortcut: "1",
      order: 0
    },
    {
      id: "approach",
      name: "Approach",
      color: "#a855f7",
      shortcut: "2",
      order: 1
    },
    {
      id: "impact",
      name: "Impact",
      color: "#f97316",
      shortcut: "3",
      order: 2
    },
    {
      id: "ringdown",
      name: "Ringdown",
      color: "#facc15",
      shortcut: "4",
      order: 3
    }
  ],
  createdAt: new Date(),
  updatedAt: new Date()
});

print("✓ Default template created");
