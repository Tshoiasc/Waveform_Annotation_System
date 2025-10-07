# TypeScript 错误修复指南

## 需要修复的错误

### 1. 未使用的变量错误

#### `src/components/AnnotationToolbar.tsx:83`
```typescript
// 错误：'handleEditMyVersion' is declared but its value is never read
const handleEditMyVersion = () => { ... }

// 修复方案：
// 方案1: 如果确实不需要，删除该函数
// 方案2: 如果将来会使用，添加下划线前缀
const _handleEditMyVersion = () => { ... }

// 方案3: 如果是事件处理函数，确保绑定到UI元素
<button onClick={handleEditMyVersion}>编辑版本</button>
```

#### `src/store/annotationStore.ts:354, 793`
```typescript
// 错误：'username' is declared but its value is never read
const username = getUsername();

// 修复方案：
// 方案1: 删除未使用的变量
// 方案2: 添加下划线前缀（表示故意未使用）
const _username = getUsername();

// 方案3: 实际使用该变量
const username = getUsername();
console.log('Current user:', username);
```

#### `src/store/annotationStore.ts:536`
```typescript
// 错误：'payload' is declared but its value is never read
const payload = action.payload;

// 修复方案：
// 如果是解构赋值但未使用，可以用下划线
const { payload: _payload } = action;

// 或者直接删除
// 如果确实需要使用，添加相应逻辑
const payload = action.payload;
if (payload) {
  // 处理 payload
}
```

### 2. 类型错误

#### `src/store/annotationStore.ts:564`
```typescript
// 错误：Type 'null' is not assignable to type 'string | undefined'
someStringVariable = null;  // ❌

// 修复方案：
// 方案1: 使用 undefined 替代 null
someStringVariable = undefined;  // ✅

// 方案2: 修改类型定义允许 null
let someStringVariable: string | null | undefined;

// 方案3: 使用类型断言（确保安全）
someStringVariable = null as any;
```

## 快速修复脚本

如果需要快速添加忽略注释：

```bash
# 在 frontend 目录下运行
cd frontend/src

# 为未使用变量添加 ESLint 忽略注释
# 在变量声明前添加：
# // eslint-disable-next-line @typescript-eslint/no-unused-vars

# 或者在文件顶部添加：
# /* eslint-disable @typescript-eslint/no-unused-vars */
```

## 推荐修复顺序

1. **立即修复**：删除确实不需要的变量和函数
2. **标记待用**：对将来可能使用的变量添加下划线前缀
3. **类型修复**：修复 null/undefined 类型不匹配
4. **验证修复**：运行 `npm run build:check` 验证

## 验证命令

```bash
# 检查类型错误
npm run build:check

# 运行 linter
npm run lint

# 完整构建测试
npm run build
```