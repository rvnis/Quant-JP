# リポジトリ構造定義書 (Repository Structure Document)

## プロジェクト構造

```
taskcli/
├── src/                          # ソースコード
│   ├── cli/                      # CLIインターフェース（プレゼンテーション層）
│   ├── services/                 # ビジネスロジック（サービス層）
│   ├── ui/                       # UI整形（プレゼンテーション層）
│   ├── types/                    # 型定義
│   └── index.ts                  # エントリーポイント
├── tests/                        # テストコード
│   ├── unit/                     # ユニットテスト
│   ├── integration/              # 統合テスト
│   └── e2e/                      # E2Eテスト
├── docs/                         # プロジェクトドキュメント
│   ├── ideas/                    # アイデア・ブレインストーミング
│   ├── product-requirements.md  # プロダクト要求定義書
│   ├── functional-design.md     # 機能設計書
│   ├── architecture.md          # アーキテクチャ設計書
│   ├── repository-structure.md  # リポジトリ構造定義書（本ドキュメント）
│   ├── development-guidelines.md # 開発ガイドライン
│   └── glossary.md              # 用語集
├── .steering/                    # 作業単位のドキュメント（Gitignore推奨）
│   └── [YYYYMMDD]-[task-name]/
│       ├── requirements.md      # 今回の作業の要求内容
│       ├── design.md            # 変更内容の設計
│       └── tasklist.md          # タスクリスト
├── .claude/                      # Claude Code設定
│   ├── commands/                # スラッシュコマンド
│   ├── skills/                  # タスクモード別スキル
│   └── agents/                  # サブエージェント定義
├── .task/                        # タスクデータ（ユーザー環境、Gitignore推奨）
│   ├── tasks.json               # タスクデータ
│   └── tasks.json.bak           # バックアップ
├── dist/                         # ビルド成果物（Gitignore）
├── node_modules/                 # 依存関係（Gitignore）
├── package.json                  # プロジェクト定義
├── package-lock.json             # 依存関係のロックファイル
├── tsconfig.json                 # TypeScript設定
├── vitest.config.ts              # Vitest設定
├── .gitignore                    # Git除外設定
├── .prettierrc                   # Prettier設定
├── .eslintrc.json                # ESLint設定
├── README.md                     # プロジェクト概要
└── LICENSE                       # ライセンス
```

## ディレクトリ詳細

### src/ (ソースコードディレクトリ)

#### src/cli/

**役割**: CLIインターフェースの実装（プレゼンテーション層）

**責務**:
- Commander.jsを使ったCLIコマンドの定義
- ユーザー入力の受付とバリデーション
- サービス層の呼び出し
- 実行結果の表示（UIFormatterを使用）

**配置ファイル**:
- `index.ts`: CLIアプリケーションのエントリーポイント、Commander.jsの初期化
- `TaskCommands.ts`: タスク関連のコマンド定義（add, list, start, done, delete）
- `GitCommands.ts`: Git関連のコマンド定義（将来的に追加予定）

**命名規則**:
- クラスファイル: `PascalCase` + `Commands`接尾辞
- 例: `TaskCommands.ts`, `GitCommands.ts`

**依存関係**:
- 依存可能: `services/`, `ui/`, `types/`
- 依存禁止: なし（最上位層）

**例**:
```
cli/
├── index.ts              # CLIエントリーポイント
└── TaskCommands.ts       # タスクコマンド定義
```

**実装例**:
```typescript
// cli/index.ts
import { Command } from 'commander';
import { TaskCommands } from './TaskCommands';

export class CLI {
  private program: Command;

  constructor(
    private taskCommands: TaskCommands
  ) {
    this.program = new Command();
  }

  initialize(): void {
    this.program
      .name('task')
      .description('Git統合型タスク管理CLIツール')
      .version('1.0.0');

    this.taskCommands.register(this.program);
  }

  async run(args: string[]): Promise<void> {
    await this.program.parseAsync(args);
  }
}
```

#### src/services/

**役割**: ビジネスロジックの実装（サービス層）

**責務**:
- タスクのCRUD操作
- ステータス管理
- Git操作（ブランチ作成、切り替え）
- データの永続化
- ビジネスルールの実装

**配置ファイル**:
- `TaskService.ts`: タスク管理のビジネスロジック
- `GitService.ts`: Git操作のラッパー
- `StorageService.ts`: データ永続化（データアクセス層）

**命名規則**:
- クラスファイル: `PascalCase` + `Service`接尾辞
- 例: `TaskService.ts`, `GitService.ts`

**依存関係**:
- 依存可能: `types/`, 他の`services/`（循環依存は禁止）
- 依存禁止: `cli/`, `ui/`

**例**:
```
services/
├── TaskService.ts        # タスク管理ビジネスロジック
├── GitService.ts         # Git操作
└── StorageService.ts     # データ永続化
```

**実装例**:
```typescript
// services/TaskService.ts
import { Task, TaskStatus, CreateTaskInput } from '../types';
import { StorageService } from './StorageService';
import { GitService } from './GitService';

export class TaskService {
  constructor(
    private storage: StorageService,
    private git: GitService
  ) {}

  createTask(data: CreateTaskInput): Task {
    const db = this.storage.load();

    const task: Task = {
      id: db.nextId,
      title: data.title,
      description: data.description,
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.tasks.push(task);
    db.nextId += 1;

    this.storage.save(db);

    return task;
  }

  startTask(id: number): Task {
    const db = this.storage.load();
    const task = db.tasks.find(t => t.id === id);

    if (!task) {
      throw new Error(`タスクが見つかりません (ID: ${id})`);
    }

    // Git連携
    if (this.git.isGitRepository()) {
      const branchName = this.git.generateBranchName(id, task.title);

      if (this.git.branchExists(branchName)) {
        this.git.checkoutBranch(branchName);
      } else {
        this.git.createAndCheckoutBranch(branchName);
      }

      task.branch = branchName;
    }

    task.status = 'in_progress';
    task.updatedAt = new Date().toISOString();

    this.storage.save(db);

    return task;
  }
}
```

#### src/ui/

**役割**: UI整形ロジック（プレゼンテーション層）

**責務**:
- タスク一覧のテーブル整形（cli-table3）
- ステータスや優先度の色付け（chalk）
- エラーメッセージの整形
- 成功メッセージの整形

**配置ファイル**:
- `UIFormatter.ts`: UI整形の実装

**命名規則**:
- クラスファイル: `PascalCase` + `Formatter`接尾辞

**依存関係**:
- 依存可能: `types/`
- 依存禁止: `cli/`, `services/`

**例**:
```
ui/
└── UIFormatter.ts        # UI整形ロジック
```

**実装例**:
```typescript
// ui/UIFormatter.ts
import Table from 'cli-table3';
import chalk from 'chalk';
import { Task, TaskStatus } from '../types';

export class UIFormatter {
  formatTaskList(tasks: Task[]): string {
    if (tasks.length === 0) {
      return 'タスクがありません';
    }

    const table = new Table({
      head: ['ID', 'Status', 'Title', 'Branch'],
      colWidths: [5, 15, 40, 40],
    });

    tasks.forEach(task => {
      table.push([
        task.id,
        this.formatStatus(task.status),
        task.title,
        task.branch || '-',
      ]);
    });

    return table.toString();
  }

  formatStatus(status: TaskStatus): string {
    switch (status) {
      case 'open':
        return chalk.white('open');
      case 'in_progress':
        return chalk.yellow('in_progress');
      case 'completed':
        return chalk.green('completed');
      case 'archived':
        return chalk.gray('archived');
    }
  }

  formatSuccess(message: string): string {
    return chalk.green(`✓ ${message}`);
  }

  formatError(message: string): string {
    return chalk.red(`✗ ${message}`);
  }
}
```

#### src/types/

**役割**: 型定義の集約

**責務**:
- 共通の型定義
- インターフェースの定義
- 型エイリアスの定義

**配置ファイル**:
- `index.ts`: すべての型定義をエクスポート
- `Task.ts`: タスク関連の型定義
- `Database.ts`: データベース関連の型定義
- `Commands.ts`: コマンド入力の型定義

**命名規則**:
- ファイル: `PascalCase`
- 例: `Task.ts`, `Database.ts`

**依存関係**:
- 依存可能: なし（他の型定義のみ）
- 依存禁止: すべて（型定義は依存を持たない）

**例**:
```
types/
├── index.ts              # 型定義のエクスポート
├── Task.ts               # タスク型定義
├── Database.ts           # データベース型定義
└── Commands.ts           # コマンド入力型定義
```

**実装例**:
```typescript
// types/Task.ts
export interface Task {
  id: number;
  title: string;
  description?: string;
  status: TaskStatus;
  branch?: string;
  createdAt: string;
  updatedAt: string;
}

export type TaskStatus = 'open' | 'in_progress' | 'completed' | 'archived';

export interface CreateTaskInput {
  title: string;
  description?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  branch?: string;
}

// types/Database.ts
import { Task } from './Task';

export interface TaskDatabase {
  tasks: Task[];
  nextId: number;
}

// types/index.ts
export * from './Task';
export * from './Database';
export * from './Commands';
```

#### src/index.ts

**役割**: アプリケーションのエントリーポイント

**責務**:
- 依存関係の注入（DI）
- CLIの初期化と実行

**実装例**:
```typescript
// src/index.ts
import { CLI } from './cli';
import { TaskCommands } from './cli/TaskCommands';
import { TaskService } from './services/TaskService';
import { GitService } from './services/GitService';
import { StorageService } from './services/StorageService';
import { UIFormatter } from './ui/UIFormatter';

// 依存関係の構築
const storageService = new StorageService('.task');
const gitService = new GitService();
const taskService = new TaskService(storageService, gitService);
const uiFormatter = new UIFormatter();
const taskCommands = new TaskCommands(taskService, uiFormatter);

// CLIの初期化と実行
const cli = new CLI(taskCommands);
cli.initialize();
cli.run(process.argv).catch(error => {
  console.error(uiFormatter.formatError(error.message));
  process.exit(1);
});
```

### tests/ (テストディレクトリ)

#### tests/unit/

**役割**: ユニットテストの配置

**構造**:
```
tests/unit/
└── services/                        # srcディレクトリと同じ構造
    ├── TaskService.test.ts
    ├── GitService.test.ts
    └── StorageService.test.ts
```

**命名規則**:
- パターン: `[テスト対象ファイル名].test.ts`
- 例: `TaskService.ts` → `TaskService.test.ts`

**実装例**:
```typescript
// tests/unit/services/TaskService.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskService } from '../../../src/services/TaskService';
import { StorageService } from '../../../src/services/StorageService';
import { GitService } from '../../../src/services/GitService';

describe('TaskService', () => {
  let taskService: TaskService;
  let storageService: StorageService;
  let gitService: GitService;

  beforeEach(() => {
    storageService = new StorageService('/tmp/test');
    gitService = new GitService();

    // モック化
    vi.spyOn(storageService, 'load').mockReturnValue({
      tasks: [],
      nextId: 1,
    });
    vi.spyOn(storageService, 'save').mockImplementation(() => {});

    taskService = new TaskService(storageService, gitService);
  });

  describe('createTask', () => {
    it('should create a task with auto-incremented ID', () => {
      const task = taskService.createTask({ title: 'Test Task' });

      expect(task.id).toBe(1);
      expect(task.title).toBe('Test Task');
      expect(task.status).toBe('open');
    });

    it('should throw error if title is empty', () => {
      expect(() => {
        taskService.createTask({ title: '' });
      }).toThrow('タイトルは必須です');
    });
  });
});
```

#### tests/integration/

**役割**: 統合テストの配置

**構造**:
```
tests/integration/
├── task-lifecycle.test.ts           # タスクのライフサイクル
└── git-integration.test.ts          # Git連携
```

**命名規則**:
- パターン: `[機能名].test.ts`
- kebab-case

**実装例**:
```typescript
// tests/integration/task-lifecycle.test.ts
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

  it('should create, start, and complete a task', () => {
    // タスク作成
    const task = taskService.createTask({ title: 'Test Task' });
    expect(task.id).toBe(1);

    // タスク開始
    const startedTask = taskService.startTask(task.id);
    expect(startedTask.status).toBe('in_progress');

    // タスク完了
    const completedTask = taskService.changeStatus(task.id, 'completed');
    expect(completedTask.status).toBe('completed');
  });
});
```

#### tests/e2e/

**役割**: E2Eテストの配置

**構造**:
```
tests/e2e/
├── basic-workflow.test.ts           # 基本的な使用フロー
└── git-workflow.test.ts             # Git連携フロー
```

**命名規則**:
- パターン: `[ワークフロー名].test.ts`
- kebab-case

**実装例**:
```typescript
// tests/e2e/basic-workflow.test.ts
import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';

describe('Basic Workflow E2E', () => {
  it('should complete basic task workflow', () => {
    // タスク作成
    const addResult = execSync('task add "Test Task"', { encoding: 'utf-8' });
    expect(addResult).toContain('タスクを作成しました');

    // タスク一覧
    const listResult = execSync('task list', { encoding: 'utf-8' });
    expect(listResult).toContain('Test Task');

    // タスク完了
    const doneResult = execSync('task done 1', { encoding: 'utf-8' });
    expect(doneResult).toContain('タスクを完了しました');
  });
});
```

### docs/ (ドキュメントディレクトリ)

#### docs/ideas/

**役割**: アイデア・ブレインストーミングの成果物

**配置ドキュメント**:
- `initial-requirements.md`: 初期要求仕様のメモ
- その他、壁打ち・ブレストの成果物

**特徴**:
- 自由形式（構造化は最小限）
- `/setup-project`実行時に自動的に読み込まれる

#### docs/ (正式版ドキュメント)

**配置ドキュメント**:
- `product-requirements.md`: プロダクト要求定義書（PRD）
- `functional-design.md`: 機能設計書
- `architecture.md`: アーキテクチャ設計書
- `repository-structure.md`: リポジトリ構造定義書（本ドキュメント）
- `development-guidelines.md`: 開発ガイドライン
- `glossary.md`: 用語集

### .steering/ (作業単位のドキュメント)

**役割**: 特定の開発作業における「今回何をするか」を定義

**構造**:
```
.steering/
└── [YYYYMMDD]-[task-name]/
    ├── requirements.md      # 今回の作業の要求内容
    ├── design.md            # 変更内容の設計
    └── tasklist.md          # タスクリスト
```

**命名規則**: `20250115-add-user-profile` 形式
- 日付: YYYYMMDD形式
- タスク名: kebab-case

**例**:
```
.steering/
├── 20250115-implement-task-add/
│   ├── requirements.md
│   ├── design.md
│   └── tasklist.md
└── 20250116-add-git-integration/
    ├── requirements.md
    ├── design.md
    └── tasklist.md
```

### .claude/ (Claude Code設定)

**役割**: Claude Code設定とカスタマイズ

**構造**:
```
.claude/
├── commands/                # スラッシュコマンド
│   ├── setup-project.md    # 初回セットアップ
│   ├── review-docs.md      # ドキュメントレビュー
│   └── add-feature.md      # 機能追加
├── skills/                  # タスクモード別スキル
│   ├── prd-writing/        # PRD作成
│   ├── functional-design/  # 機能設計
│   └── architecture-design/ # アーキテクチャ設計
└── agents/                  # サブエージェント定義
    ├── doc-reviewer/       # ドキュメントレビュー
    └── implementation-validator/ # 実装検証
```

### .task/ (タスクデータ - ユーザー環境)

**役割**: TaskCLIで管理するタスクデータの保存

**構造**:
```
.task/
├── tasks.json              # タスクデータ
└── tasks.json.bak          # バックアップ
```

**注意**:
- このディレクトリは開発者のプロジェクトごとに作成される
- `.gitignore`に追加を推奨（ただし強制はしない）
- TaskCLIのリポジトリ自体には含まれない

## ファイル配置規則

### ソースファイル

| ファイル種別 | 配置先 | 命名規則 | 例 |
|------------|--------|---------|-----|
| CLIコマンド | src/cli/ | PascalCase + Commands | TaskCommands.ts |
| サービスクラス | src/services/ | PascalCase + Service | TaskService.ts |
| UI整形クラス | src/ui/ | PascalCase + Formatter | UIFormatter.ts |
| 型定義 | src/types/ | PascalCase | Task.ts, Database.ts |
| エントリーポイント | src/ | index.ts | index.ts |

### テストファイル

| テスト種別 | 配置先 | 命名規則 | 例 |
|-----------|--------|---------|-----|
| ユニットテスト | tests/unit/ | [対象].test.ts | TaskService.test.ts |
| 統合テスト | tests/integration/ | [機能].test.ts | task-lifecycle.test.ts |
| E2Eテスト | tests/e2e/ | [シナリオ].test.ts | basic-workflow.test.ts |

### 設定ファイル

| ファイル種別 | 配置先 | ファイル名 |
|------------|--------|----------|
| TypeScript設定 | プロジェクトルート | tsconfig.json |
| Vitest設定 | プロジェクトルート | vitest.config.ts |
| ESLint設定 | プロジェクトルート | .eslintrc.json |
| Prettier設定 | プロジェクトルート | .prettierrc |
| Git除外設定 | プロジェクトルート | .gitignore |

## 命名規則

### ディレクトリ名

- **レイヤーディレクトリ**: 複数形、kebab-case
  - 例: `services/`, `types/`
- **機能ディレクトリ**: 単数形、kebab-case
  - 例: `task-management/`, `user-authentication/` (将来的な拡張時)

### ファイル名

- **クラスファイル**: PascalCase + 役割接尾辞
  - 例: `TaskService.ts`, `UIFormatter.ts`, `TaskCommands.ts`
- **型定義ファイル**: PascalCase
  - 例: `Task.ts`, `Database.ts`
- **テストファイル**: `[テスト対象].test.ts`
  - 例: `TaskService.test.ts`

## 依存関係のルール

### レイヤー間の依存

```
cli/ (プレゼンテーション層)
  ↓ OK
services/ (サービス層)
  ↓ OK
StorageService (データアクセス層)
```

**許可される依存**:
- `cli/` → `services/`, `ui/`, `types/`
- `services/` → 他の`services/`, `types/`
- `ui/` → `types/`
- `types/` → なし

**禁止される依存**:
- `services/` → `cli/`, `ui/` (❌)
- `ui/` → `cli/`, `services/` (❌)
- `types/` → すべて (❌)

### 循環依存の禁止

**例: 循環依存を避ける**
```typescript
// ❌ 悪い例: 循環依存
// services/TaskService.ts
import { GitService } from './GitService';

// services/GitService.ts
import { TaskService } from './TaskService';  // 循環依存！

// ✅ 良い例: 依存関係を見直す
// services/TaskService.ts
import { GitService } from './GitService';

// services/GitService.ts
// TaskServiceへの依存を削除、必要なデータを引数で受け取る
```

## スケーリング戦略

### 機能の追加

**小規模機能** (ファイル1-2個):
- 既存ディレクトリに配置

**中規模機能** (ファイル3-5個):
- サブディレクトリを作成

**例**:
```
src/
├── services/
│   ├── TaskService.ts           # 既存機能
│   └── priority/                # 中規模機能の分離
│       ├── PriorityEstimator.ts
│       └── PriorityCalculator.ts
```

**大規模機能** (ファイル6個以上):
- 独立したモジュールとして分離（機能ディレクトリベースに移行を検討）

### ファイルサイズの管理

**ファイル分割の目安**:
- 1ファイル: 300行以下を推奨
- 300-500行: リファクタリングを検討
- 500行以上: 分割を強く推奨

**分割方法**:
```typescript
// 悪い例: 1ファイルに全機能 (800行)
// TaskService.ts

// 良い例: 責務ごとに分割
// TaskService.ts (200行) - CRUD操作
// TaskValidationService.ts (150行) - バリデーション
```

## 除外設定

### .gitignore

```gitignore
# 依存関係
node_modules/

# ビルド成果物
dist/

# ログ
*.log
npm-debug.log*

# 環境変数
.env
.env.local

# OS固有
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/

# テストカバレッジ
coverage/

# 作業ドキュメント（オプション）
.steering/

# タスクデータ（開発時のテストデータ）
.task/
```

### .prettierignore / .eslintignore

```
# ビルド成果物
dist/

# 依存関係
node_modules/

# 作業ドキュメント
.steering/

# テストカバレッジ
coverage/
```

## ビルド成果物（dist/）

ビルド後のディレクトリ構造:

```
dist/
├── cli/
│   ├── index.js
│   └── TaskCommands.js
├── services/
│   ├── TaskService.js
│   ├── GitService.js
│   └── StorageService.js
├── ui/
│   └── UIFormatter.js
├── types/
│   ├── index.js
│   └── (型定義は.d.tsファイルとして出力)
└── index.js
```

**注意**:
- TypeScriptコンパイル後のJavaScriptファイル
- 型定義ファイル(.d.ts)も出力される
- package.jsonの`main`フィールドで`dist/index.js`を指定

## まとめ

このリポジトリ構造は、以下の原則に基づいています:

1. **レイヤー分離**: 3層アーキテクチャ（CLI/UI、サービス、データ）を明確に
2. **単一責任**: 各ディレクトリ・ファイルは単一の責務を持つ
3. **依存関係の明確化**: 上位層から下位層への一方向依存
4. **テストの分離**: ユニット、統合、E2Eテストを明確に区別
5. **スケーラビリティ**: 将来の機能追加に対応できる構造
