# 開発ガイドライン (Development Guidelines)

このドキュメントは、TaskCLIプロジェクトの開発における規約とプロセスを定義します。

## コーディング規約

### 命名規則

#### 変数・関数

**TypeScript/JavaScript**:
```typescript
// ✅ 良い例: 明確で役割が分かる
const taskDatabase = loadTaskDatabase();
const branchName = generateBranchName(taskId, taskTitle);
function validateTaskInput(data: CreateTaskInput): void { }

// ❌ 悪い例: 曖昧で短すぎる
const db = load();
const name = generate(id, title);
function validate(data: any): void { }
```

**原則**:
- 変数: `camelCase`、名詞または名詞句
- 関数: `camelCase`、動詞で始める
- 定数: `UPPER_SNAKE_CASE`
- Boolean: `is`, `has`, `should`, `can`で始める

**例**:
```typescript
// 変数
const taskService = new TaskService();
const gitRepository = new GitService();

// 関数
function createTask(data: CreateTaskInput): Task { }
function formatTaskList(tasks: Task[]): string { }

// Boolean
const isCompleted = task.status === 'completed';
const hasGitRepository = gitService.isGitRepository();
const shouldCreateBackup = !storageService.exists();

// 定数
const MAX_TITLE_LENGTH = 200;
const DEFAULT_STATUS: TaskStatus = 'open';
```

#### クラス・インターフェース

```typescript
// クラス: PascalCase、名詞
class TaskService { }
class GitService { }
class StorageService { }

// インターフェース: PascalCase、I接頭辞なし
interface Task { }
interface TaskDatabase { }
interface CreateTaskInput { }

// 型エイリアス: PascalCase
type TaskStatus = 'open' | 'in_progress' | 'completed' | 'archived';
```

**理由**: TypeScriptではI接頭辞を使わないのが一般的。型とインターフェースの区別は、拡張可能性で判断する。

### 型定義

**明示的な型注釈**:
```typescript
// ✅ 良い例: 引数と戻り値に型注釈
function generateBranchName(taskId: number, taskTitle: string): string {
  const sanitized = sanitizeBranchName(taskTitle);
  return `feature/task-${taskId}-${sanitized}`;
}

// ❌ 悪い例: 型推論に頼りすぎる
function generateBranchName(taskId, taskTitle) {  // any型になる
  return `feature/task-${taskId}-${taskTitle}`;
}
```

**インターフェース vs 型エイリアス**:
```typescript
// インターフェース: 拡張可能なオブジェクト型
interface Task {
  id: number;
  title: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

// 型エイリアス: ユニオン型、プリミティブ型
type TaskStatus = 'open' | 'in_progress' | 'completed' | 'archived';
type TaskId = number;
```

### コードフォーマット

**インデント**: 2スペース

**行の長さ**: 最大100文字

**Prettierを使用**: 自動整形により、フォーマットの議論を排除

**設定ファイル (.prettierrc)**:
```json
{
  "semi": true,
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "trailingComma": "es5"
}
```

### コメント規約

**関数・クラスのドキュメント (TSDoc)**:
```typescript
/**
 * タスクを作成する
 *
 * @param data - 作成するタスクのデータ
 * @returns 作成されたタスク
 * @throws {ValidationError} タイトルが不正な場合
 * @throws {StorageError} データ保存に失敗した場合
 *
 * @example
 * ```typescript
 * const task = taskService.createTask({
 *   title: '新しいタスク',
 *   description: 'タスクの説明'
 * });
 * ```
 */
function createTask(data: CreateTaskInput): Task {
  // 実装
}
```

**インラインコメント**:
```typescript
// ✅ 良い例: なぜそうするかを説明
// 既存ファイルをバックアップしてから書き込み
if (this.exists()) {
  this.backup();
}
this.write(data);

// ❌ 悪い例: 何をしているか(コードを見れば分かる)
// ファイルが存在するか確認
if (this.exists()) {
  this.backup();
}
```

**TODO・FIXMEの活用**:
```typescript
// TODO: GitHub Issues連携を実装 (Issue #45)
// FIXME: 大量データでパフォーマンス劣化 (1000件以上)
// HACK: 一時的な回避策、後でリファクタリング必要
```

### エラーハンドリング

**原則**:
- 予期されるエラー: カスタムエラークラスを定義
- 予期しないエラー: 上位に伝播
- エラーを無視しない（catchして何もしない は禁止）

**カスタムエラークラスの定義**:
```typescript
// エラークラス
class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public value: unknown
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

class TaskNotFoundError extends Error {
  constructor(public taskId: number) {
    super(`タスクが見つかりません (ID: ${taskId})`);
    this.name = 'TaskNotFoundError';
  }
}

class StorageError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'StorageError';
    this.cause = cause;
  }
}
```

**エラーハンドリングパターン**:
```typescript
// ✅ 良い例: 適切なエラーハンドリング
function getTask(id: number): Task {
  const db = this.storage.load();
  const task = db.tasks.find(t => t.id === id);

  if (!task) {
    throw new TaskNotFoundError(id);
  }

  return task;
}

// CLIレイヤーでのエラーハンドリング
try {
  const task = taskService.getTask(taskId);
  console.log(uiFormatter.formatTaskDetail(task));
} catch (error) {
  if (error instanceof TaskNotFoundError) {
    console.error(chalk.red(error.message));
    process.exit(1);
  } else if (error instanceof ValidationError) {
    console.error(chalk.red(`検証エラー [${error.field}]: ${error.message}`));
    process.exit(1);
  } else {
    console.error(chalk.red(`予期しないエラー: ${error.message}`));
    process.exit(1);
  }
}

// ❌ 悪い例: エラーを無視
try {
  const task = taskService.getTask(taskId);
} catch (error) {
  // 何もしない - エラー情報が失われる ❌
}
```

**エラーメッセージ**:
```typescript
// ✅ 良い例: 具体的で解決策を示す
throw new ValidationError(
  'タイトルは1-200文字で入力してください。現在の文字数: 250',
  'title',
  title
);

// ❌ 悪い例: 曖昧で役に立たない
throw new Error('Invalid input');
```

### 関数設計

**単一責務の原則**:
```typescript
// ✅ 良い例: 単一の責務
function sanitizeBranchName(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

function generateBranchName(taskId: number, taskTitle: string): string {
  const sanitized = sanitizeBranchName(taskTitle);

  if (sanitized.length === 0) {
    return `feature/task-${taskId}`;
  }

  return `feature/task-${taskId}-${sanitized}`;
}

// ❌ 悪い例: 複数の責務
function generateBranchName(taskId: number, taskTitle: string): string {
  // サニタイズとブランチ名生成が混在
  const sanitized = taskTitle
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);

  if (sanitized.length === 0) {
    return `feature/task-${taskId}`;
  }

  return `feature/task-${taskId}-${sanitized}`;
}
```

**関数の長さ**:
- 目標: 20行以内
- 推奨: 50行以内
- 100行以上: リファクタリングを検討

**パラメータの数**:
```typescript
// ✅ 良い例: オブジェクトでまとめる
interface CreateTaskInput {
  title: string;
  description?: string;
}

function createTask(data: CreateTaskInput): Task {
  // 実装
}

// ❌ 悪い例: パラメータが多すぎる
function createTask(
  title: string,
  description: string | undefined
): Task {
  // まだ許容範囲だが、増える可能性がある場合はオブジェクトに
}
```

## Git運用ルール

### ブランチ戦略 (Git Flow)

**ブランチ構成**:
```
main (本番環境)
└── dev (開発環境)
    ├── feature/[機能名] (新機能開発)
    ├── fix/[修正内容] (バグ修正)
    └── refactor/[対象] (リファクタリング)
```

**運用ルール**:
- **main**: 本番リリース済みの安定版コードのみ。タグでバージョン管理
- **dev**: 次期リリースに向けた最新の開発コード。CIでの自動テスト実施
- **feature/\*、fix/\***: devから分岐し、作業完了後にPRでdevへマージ
- **直接コミット禁止**: すべてのブランチでPRレビューを必須
- **マージ方針**: feature→dev は squash merge、dev→main は merge commit

**ブランチ名の例**:
```bash
feature/task-add-command      # タスク追加コマンドの実装
feature/git-integration       # Git連携機能
fix/task-validation          # タスクバリデーションのバグ修正
refactor/storage-service     # StorageServiceのリファクタリング
```

### コミットメッセージ規約 (Conventional Commits)

**フォーマット**:
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type一覧**:
```
feat: 新機能 (minor version up)
fix: バグ修正 (patch version up)
docs: ドキュメント
style: コードフォーマット (動作に影響なし)
refactor: リファクタリング
test: テスト追加・修正
chore: ビルド、補助ツール等

BREAKING CHANGE: 破壊的変更 (major version up)
```

**良いコミットメッセージの例**:
```
feat(task): タスク作成コマンドを追加

task add コマンドでタスクを作成できるようにしました。

実装内容:
- TaskServiceにcreateTaskメソッドを追加
- CLIにaddコマンドを追加
- タイトルのバリデーション実装

Closes #12
```

```
fix(storage): バックアップ作成時のエラーハンドリング

ファイルが存在しない場合にバックアップ作成でエラーが発生する
問題を修正しました。

変更内容:
- ファイル存在確認を追加
- エラーメッセージを改善

Fixes #23
```

### プルリクエストプロセス

**作成前のチェック**:
- [ ] 全てのテストがパス (`npm test`)
- [ ] Lintエラーがない (`npm run lint`)
- [ ] 型チェックがパス (`npm run typecheck`)
- [ ] ビルドが成功 (`npm run build`)
- [ ] 競合が解決されている

**PRテンプレート**:
```markdown
## 変更の種類
- [ ] 新機能 (feat)
- [ ] バグ修正 (fix)
- [ ] リファクタリング (refactor)
- [ ] ドキュメント (docs)
- [ ] その他 (chore)

## 変更内容
### 何を変更したか
[簡潔な説明]

### なぜ変更したか
[背景・理由]

### どのように変更したか
- [変更点1]
- [変更点2]

## テスト
### 実施したテスト
- [ ] ユニットテスト追加
- [ ] 統合テスト追加
- [ ] 手動テスト実施

### テスト結果
[テスト結果の説明]

## 関連Issue
Closes #[番号]

## レビューポイント
[レビュアーに特に見てほしい点]
```

**レビュープロセス**:
1. セルフレビュー（PR作成前に自分でコードを見直す）
2. 自動テスト実行（GitHub Actions）
3. レビュアーアサイン（最低1人）
4. レビューフィードバック対応
5. 承認後マージ

## テスト戦略

### テストの種類

#### ユニットテスト

**対象**: 個別の関数・クラス・メソッド

**カバレッジ目標**: 90%以上

**フレームワーク**: Vitest

**例**:
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskService } from '../../../src/services/TaskService';
import { StorageService } from '../../../src/services/StorageService';

describe('TaskService', () => {
  let taskService: TaskService;
  let storageService: StorageService;

  beforeEach(() => {
    storageService = new StorageService('.task');

    // モック化
    vi.spyOn(storageService, 'load').mockReturnValue({
      tasks: [],
      nextId: 1,
    });
    vi.spyOn(storageService, 'save').mockImplementation(() => {});

    taskService = new TaskService(storageService, new GitService());
  });

  describe('createTask', () => {
    it('正常なデータでタスクを作成できる', () => {
      // Given: 準備
      const data = { title: 'テストタスク' };

      // When: 実行
      const task = taskService.createTask(data);

      // Then: 検証
      expect(task.id).toBe(1);
      expect(task.title).toBe('テストタスク');
      expect(task.status).toBe('open');
      expect(storageService.save).toHaveBeenCalledTimes(1);
    });

    it('タイトルが空の場合ValidationErrorをスローする', () => {
      // Given: 準備
      const data = { title: '' };

      // When/Then: 実行と検証
      expect(() => taskService.createTask(data)).toThrow(ValidationError);
    });

    it('タイトルが200文字を超える場合ValidationErrorをスローする', () => {
      // Given: 準備
      const data = { title: 'a'.repeat(201) };

      // When/Then: 実行と検証
      expect(() => taskService.createTask(data)).toThrow(ValidationError);
    });
  });
});
```

#### 統合テスト

**対象**: 複数コンポーネントの連携

**例**:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { TaskService } from '../../src/services/TaskService';
import { StorageService } from '../../src/services/StorageService';
import { GitService } from '../../src/services/GitService';

describe('Task Lifecycle Integration', () => {
  let tempDir: string;
  let taskService: TaskService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join('/tmp', 'taskcli-test-'));
    const storageService = new StorageService(path.join(tempDir, '.task'));
    const gitService = new GitService();
    taskService = new TaskService(storageService, gitService);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('タスクの作成・取得・完了ができる', () => {
    // 作成
    const created = taskService.createTask({ title: 'テスト' });
    expect(created.id).toBe(1);

    // 取得
    const found = taskService.getTask(created.id);
    expect(found.title).toBe('テスト');

    // 完了
    const completed = taskService.changeStatus(created.id, 'completed');
    expect(completed.status).toBe('completed');
  });
});
```

#### E2Eテスト

**対象**: ユーザーシナリオ全体（CLIコマンドの実行）

**例**:
```typescript
import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';

describe('Basic Workflow E2E', () => {
  it('タスクの追加・一覧表示・完了ができる', () => {
    // タスク追加
    const addResult = execSync('task add "テストタスク"', { encoding: 'utf-8' });
    expect(addResult).toContain('タスクを作成しました');

    // タスク一覧表示
    const listResult = execSync('task list', { encoding: 'utf-8' });
    expect(listResult).toContain('テストタスク');

    // タスク完了
    const doneResult = execSync('task done 1', { encoding: 'utf-8' });
    expect(doneResult).toContain('タスクを完了しました');
  });
});
```

### テストピラミッド

```
       /\
      /E2E\       少 (遅い、高コスト) - 10%
     /------\
    / 統合   \     中 - 20%
   /----------\
  / ユニット   \   多 (速い、低コスト) - 70%
 /--------------\
```

### カバレッジ目標

**測定可能な目標**:
```javascript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 80,
        statements: 90,
      },
    },
  },
});
```

**理由**:
- サービス層は高いカバレッジを要求（ビジネスロジックの保証）
- 100%を目指さない（コストと効果のバランス）

## コードレビュー基準

### レビューポイント

**機能性**:
- [ ] 要件を満たしているか
- [ ] エッジケースが考慮されているか（空文字、null、境界値）
- [ ] エラーハンドリングが適切か

**可読性**:
- [ ] 命名が明確か（変数、関数、クラス）
- [ ] コメントが適切か（なぜを説明）
- [ ] 複雑なロジックが説明されているか

**保守性**:
- [ ] 重複コードがないか（DRY原則）
- [ ] 責務が明確に分離されているか（SRP原則）
- [ ] 変更の影響範囲が限定的か

**パフォーマンス**:
- [ ] 不要な計算がないか
- [ ] ループ内での重い処理がないか
- [ ] データ構造の選択が適切か

**セキュリティ**:
- [ ] 入力検証が適切か
- [ ] 機密情報がハードコードされていないか
- [ ] パストラバーサルの脆弱性がないか

### レビューコメントの書き方

**建設的なフィードバック**:
```markdown
## ❌ 悪い例
このコードはダメです。

## ✅ 良い例
この実装だと、タスク数が増えた時にパフォーマンスが劣化する可能性があります。
代わりに、Mapを使った検索を検討してはどうでしょうか？

```typescript
const taskMap = new Map(tasks.map(t => [t.id, t]));
const result = taskMap.get(id); // O(1)
```
```

**優先度の明示**:
- `[必須]`: 修正必須（セキュリティ、バグ）
- `[推奨]`: 修正推奨（パフォーマンス、保守性）
- `[提案]`: 検討してほしい（可読性、設計）
- `[質問]`: 理解のための質問

**ポジティブなフィードバック**:
```markdown
✨ この実装は分かりやすいですね！
👍 エッジケースがしっかり考慮されています
💡 このパターンは他でも使えそうです
```

## 開発環境セットアップ

### 必要なツール

| ツール | バージョン | インストール方法 |
|--------|-----------|-----------------|
| Node.js | v24.11.0 (LTS) | https://nodejs.org/ |
| npm | 11.x | Node.jsに同梱 |
| Git | 2.0以上 | https://git-scm.com/ |
| TypeScript | 5.x | `npm install -g typescript` |

### セットアップ手順

```bash
# 1. リポジトリのクローン
git clone https://github.com/your-org/taskcli.git
cd taskcli

# 2. 依存関係のインストール
npm install

# 3. ビルド
npm run build

# 4. テスト実行
npm test

# 5. 開発モードで実行
npm run dev
```

### 推奨開発ツール

- **VS Code**: TypeScript開発に最適、拡張機能が豊富
  - 推奨拡張機能:
    - ESLint
    - Prettier
    - TypeScript Vue Plugin (Volar)
- **GitHub CLI**: PR作成・レビューが効率化
- **Husky**: Git hooksでコミット前に自動チェック

## 自動化の推進

### 品質チェックの自動化

**自動化項目と採用ツール**:

1. **Lintチェック**: ESLint 9.x + @typescript-eslint
2. **コードフォーマット**: Prettier 3.x
3. **型チェック**: TypeScript Compiler (tsc) 5.x
4. **テスト実行**: Vitest 2.x
5. **ビルド確認**: TypeScript Compiler (tsc)

### CI/CD (GitHub Actions)

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push:
    branches: [main, dev]
  pull_request:
    branches: [main, dev]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npm run typecheck

      - name: Test
        run: npm test

      - name: Build
        run: npm run build
```

### Pre-commit フック (Husky + lint-staged)

```json
// package.json
{
  "scripts": {
    "prepare": "husky",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "build": "tsc"
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ]
  }
}
```

```bash
# .husky/pre-commit
npm run lint-staged
npm run typecheck
```

**導入効果**:
- コミット前に自動チェックが走り、不具合コードの混入を防止
- PR作成時に自動でCI実行され、マージ前に品質を担保
- 早期発見により、修正コストを最大80%削減

## まとめ

このガイドラインは、TaskCLIプロジェクトの開発における共通のルールです。

**重要なポイント**:
1. **命名は明確に**: 変数・関数・クラスの役割が一目で分かるように
2. **エラーハンドリングを適切に**: 予期されるエラーは明示的に処理
3. **テストを書く**: カバレッジ90%以上を目標に
4. **PRは小さく**: 1PR = 1機能、300行以内を推奨
5. **レビューは建設的に**: 理由を説明し、代替案を提示

疑問点があれば、チームで議論して改善していきましょう。
