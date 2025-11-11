# 機能設計書 (Functional Design Document)

## システム構成図

```mermaid
graph TB
    User[ユーザー]
    CLI[CLIインターフェース]
    Commander[Commander.js]
    TaskService[TaskService]
    GitService[GitService]
    Storage[StorageService]
    JSON[(tasks.json)]
    Git[(Gitリポジトリ)]

    User --> CLI
    CLI --> Commander
    Commander --> TaskService
    Commander --> GitService
    TaskService --> Storage
    Storage --> JSON
    GitService --> Git
    TaskService --> GitService
```

**アーキテクチャパターン**: 3層アーキテクチャ
- **プレゼンテーション層**: CLIインターフェース、Commander.js
- **ビジネスロジック層**: TaskService、GitService
- **データアクセス層**: StorageService

## 技術スタック

| 分類 | 技術 | 選定理由 |
|------|------|----------|
| 言語 | TypeScript 5.x | 型安全性、開発効率、エコシステムの充実 |
| ランタイム | Node.js v24.11.0 (LTS, 最小要件: 18+) | クロスプラットフォーム対応、npmエコシステム |
| CLIフレームワーク | Commander.js | シンプル、学習コストが低い、十分な機能 |
| Git連携 | simple-git | Node.jsで使いやすい、安定している |
| テーブル表示 | cli-table3 | カスタマイズ性が高い、Unicode対応 |
| カラー出力 | chalk | 広く使われている、シンプルなAPI |
| データ形式 | JSON | 人間が読みやすい、Git管理可能、標準ライブラリで扱える |
| テストフレームワーク | Vitest | 高速、TypeScript対応、モダンなAPI |
| パッケージマネージャ | npm | 標準、広く使われている |

## データモデル定義

### エンティティ: Task

```typescript
interface Task {
  id: number;                   // タスクID（1から自動採番）
  title: string;                // タスクタイトル（1-200文字）
  description?: string;         // タスクの詳細説明（オプション、Markdown形式）
  status: TaskStatus;           // タスクのステータス
  branch?: string;              // 関連するGitブランチ名（task start実行後に設定）
  createdAt: string;            // 作成日時（ISO 8601形式）
  updatedAt: string;            // 更新日時（ISO 8601形式）
}

type TaskStatus = 'open' | 'in_progress' | 'completed' | 'archived';
```

**制約**:
- `id`: 1から開始、自動採番、重複不可
- `title`: 必須、1-200文字
- `description`: オプション、制限なし
- `status`: 必須、4つの値のいずれか
- `branch`: `task start`実行時に自動設定、形式は`feature/task-{id}-{sanitized-title}`
- `createdAt`, `updatedAt`: ISO 8601形式（例: `2025-01-15T10:30:00.000Z`）

### エンティティ: TaskDatabase

```typescript
interface TaskDatabase {
  tasks: Task[];                // タスクの配列
  nextId: number;               // 次に採番されるタスクID
}
```

**制約**:
- `tasks`: 空配列も許可
- `nextId`: 1から開始、タスク作成ごとにインクリメント

### ER図

```mermaid
erDiagram
    TASK {
        number id PK
        string title
        string description
        string status
        string branch
        string createdAt
        string updatedAt
    }
```

**備考**: MVPでは単一エンティティのみ。将来的にタグやサブタスクを追加する場合はER図を拡張。

## コンポーネント設計

### 1. CLIインターフェース (src/cli/index.ts)

**責務**:
- ユーザーからのコマンド入力を受け付ける
- Commander.jsを初期化し、コマンドを登録する
- 実行結果をフォーマットして表示する
- エラーメッセージを表示する

**インターフェース**:
```typescript
class CLI {
  // CLIアプリケーションを初期化
  initialize(): void;

  // コマンドを実行
  run(args: string[]): Promise<void>;
}
```

**依存関係**:
- Commander.js
- TaskService
- GitService
- UIFormatter

### 2. TaskService (src/services/TaskService.ts)

**責務**:
- タスクのCRUD操作
- タスクのステータス管理
- タスクのバリデーション

**インターフェース**:
```typescript
class TaskService {
  // タスクを作成
  createTask(data: CreateTaskInput): Task;

  // タスク一覧を取得
  listTasks(options?: ListOptions): Task[];

  // タスクを取得
  getTask(id: number): Task | null;

  // タスクを更新
  updateTask(id: number, data: UpdateTaskInput): Task;

  // タスクのステータスを変更
  changeStatus(id: number, status: TaskStatus): Task;

  // タスクを削除
  deleteTask(id: number): void;

  // タスクをアーカイブ
  archiveTask(id: number): Task;
}

interface CreateTaskInput {
  title: string;
  description?: string;
}

interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  branch?: string;
}

interface ListOptions {
  status?: TaskStatus;
  includeArchived?: boolean;
}
```

**依存関係**:
- StorageService

### 3. GitService (src/services/GitService.ts)

**責務**:
- Gitリポジトリの存在確認
- ブランチの作成と切り替え
- タスクIDとタイトルからブランチ名を生成

**インターフェース**:
```typescript
class GitService {
  // Gitリポジトリが存在するか確認
  isGitRepository(): boolean;

  // ブランチを作成して切り替え
  createAndCheckoutBranch(branchName: string): void;

  // ブランチが存在するか確認
  branchExists(branchName: string): boolean;

  // ブランチに切り替え
  checkoutBranch(branchName: string): void;

  // タスクIDとタイトルからブランチ名を生成
  generateBranchName(taskId: number, taskTitle: string): string;
}
```

**実装の注意点**:
- `generateBranchName()`内で`StringUtils.sanitizeForBranchName()`を使用してタイトルをサニタイズする
- サニタイズ後のタイトルと`feature/task-{id}-{sanitized-title}`の形式でブランチ名を生成

**依存関係**:
- simple-git
- StringUtils (src/utils/StringUtils.ts)

### 4. StorageService (src/services/StorageService.ts)

**責務**:
- JSONファイルへのデータ保存
- JSONファイルからのデータ読み込み
- ファイルの存在確認
- バックアップの作成

**インターフェース**:
```typescript
class StorageService {
  // データベースを読み込む
  load(): TaskDatabase;

  // データベースを保存
  save(db: TaskDatabase): void;

  // ファイルが存在するか確認
  exists(): boolean;

  // データディレクトリを初期化
  initialize(): void;

  // バックアップを作成
  backup(): void;
}
```

**依存関係**:
- Node.js fs module

**バックアップ戦略の詳細**:

StorageService.backup()は、データファイルを破損から保護するために自動的に実行されます。

**バックアップのタイミング**:
- `save()`メソッドが呼ばれる前に必ず自動でバックアップを作成
- 具体的には以下の操作時に実行される:
  - タスク作成時 (TaskService.createTask)
  - タスク更新時 (TaskService.updateTask)
  - タスク削除時 (TaskService.deleteTask)
  - ステータス変更時 (TaskService.changeStatus)

**バックアップファイル**:
- ファイル名: `.task/tasks.json.bak`
- 形式: 既存の`tasks.json`の完全なコピー
- 保持数: 最新の1世代のみ（上書き）

**復元方法**:

ユーザーが手動で復元する場合:
```bash
# macOS/Linux
cp .task/tasks.json.bak .task/tasks.json

# Windows (Git Bash)
cp .task/tasks.json.bak .task/tasks.json

# 復元後、確認
task list
```

将来的な実装予定(P1):
- `task restore` コマンドによる自動復元機能
- 複数世代のバックアップ保持（タイムスタンプ付き）

### 5. StringUtils (src/utils/StringUtils.ts)

**責務**:
- ブランチ名用の文字列サニタイズ
- 将来的な文字列処理ユーティリティの拡張ポイント

**インターフェース**:
```typescript
class StringUtils {
  // ブランチ名に適した形式にサニタイズ
  static sanitizeForBranchName(text: string): string;
}
```

**実装の詳細**:
`sanitizeForBranchName()`は以下の処理を行います:
1. 小文字に変換
2. 連続する空白を1つのハイフンに変換
3. 英数字とハイフン以外の文字を削除
4. 複数の連続するハイフンを1つにまとめる
5. 先頭と末尾のハイフンを削除
6. 最大長を50文字に制限
7. 空文字列の場合は`"untitled"`を返す

詳細な実装は「ブランチ名サニタイズの詳細」セクションを参照してください。

**依存関係**:
- なし（標準ライブラリのみ使用）

**設計の意図**:
- Git操作に依存しない純粋な文字列処理として実装
- 単一責任原則: 文字列のサニタイズのみに特化
- 再利用性: 将来的に他の用途（ファイル名など）でも利用可能
- テスト容易性: 副作用のないstaticメソッドで実装

### 6. UIFormatter (src/ui/UIFormatter.ts)

**責務**:
- タスク一覧をテーブル形式で整形
- ステータスや優先度を色付けして表示
- エラーメッセージを整形

**インターフェース**:
```typescript
class UIFormatter {
  // タスク一覧をテーブル形式で整形
  formatTaskList(tasks: Task[]): string;

  // 単一タスクの詳細を整形
  formatTaskDetail(task: Task): string;

  // 成功メッセージを整形
  formatSuccess(message: string): string;

  // エラーメッセージを整形
  formatError(message: string): string;

  // ステータスを色付きで整形
  formatStatus(status: TaskStatus): string;
}
```

**依存関係**:
- cli-table3
- chalk
- ColorScheme (src/ui/ColorScheme.ts)

**設計の改善ポイント**:

UIFormatterは現在、整形と色付けの両方を担当していますが、将来的に色のカスタマイズやテーマ機能を追加する際には、ColorSchemeクラスに色の管理を分離することを推奨します。

**推奨される設計 (P1以降)**:
```typescript
// src/ui/ColorScheme.ts
class ColorScheme {
  // ステータスに対応する色を取得
  getStatusColor(status: TaskStatus): ChalkFunction;

  // 成功メッセージの色を取得
  getSuccessColor(): ChalkFunction;

  // エラーメッセージの色を取得
  getErrorColor(): ChalkFunction;
}

// src/ui/UIFormatter.ts
class UIFormatter {
  constructor(private colorScheme: ColorScheme = new ColorScheme()) {}

  formatStatus(status: TaskStatus): string {
    const color = this.colorScheme.getStatusColor(status);
    return color(status);
  }

  formatSuccess(message: string): string {
    const color = this.colorScheme.getSuccessColor();
    return color(message);
  }

  formatError(message: string): string {
    const color = this.colorScheme.getErrorColor();
    return color(message);
  }
}
```

**メリット**:
- 単一責任原則: UIFormatterは整形、ColorSchemeは色の管理に特化
- テスト容易性: ColorSchemeをモック化してUIFormatterをテスト可能
- 拡張性: 将来的にユーザー設定ファイル(`.task/config.json`)からテーマを読み込み可能
- 再利用性: 他のUIコンポーネントでもColorSchemeを利用可能

**MVPでの実装**:
- MVPではUIFormatter内に直接色を定義して実装
- P1以降でColorSchemeクラスへのリファクタリングを検討

## ユースケース図

### ユースケース1: タスクを作成する

```mermaid
sequenceDiagram
    participant User
    participant CLI
    participant TaskService
    participant Storage

    User->>CLI: task add "ユーザー認証機能の実装"
    CLI->>CLI: 入力バリデーション
    CLI->>TaskService: createTask({title: "..."})
    TaskService->>Storage: load()
    Storage-->>TaskService: TaskDatabase
    TaskService->>TaskService: 新しいタスクを作成
    TaskService->>TaskService: nextIdをインクリメント
    TaskService->>Storage: save(updatedDb)
    Storage->>Storage: backup() - 既存ファイルをバックアップ
    Storage->>Storage: JSONファイルに書き込み
    Storage-->>TaskService: 成功
    TaskService-->>CLI: Task
    CLI-->>User: "タスクを作成しました (ID: 1)"
```

**フロー説明**:
1. ユーザーが `task add "タイトル"` コマンドを実行
2. CLIがタイトルのバリデーション（1-200文字）を実行
3. TaskServiceがStorageからデータベースを読み込み
4. 新しいタスクオブジェクトを作成（ステータスは`open`）
5. nextIdをインクリメント
6. Storageがバックアップを作成し、データを保存
7. 成功メッセージを表示

### ユースケース2: タスクを開始する（Git連携）

```mermaid
sequenceDiagram
    participant User
    participant CLI
    participant TaskService
    participant GitService
    participant Storage

    User->>CLI: task start 1
    CLI->>TaskService: getTask(1)
    TaskService->>Storage: load()
    Storage-->>TaskService: TaskDatabase
    TaskService-->>CLI: Task
    CLI->>GitService: isGitRepository()
    GitService-->>CLI: true
    CLI->>GitService: generateBranchName(1, "ユーザー認証機能の実装")
    GitService->>GitService: sanitizeBranchName("ユーザー認証機能の実装")
    GitService-->>CLI: "feature/task-1-user-authentication"
    CLI->>GitService: branchExists("feature/task-1-user-authentication")
    GitService-->>CLI: false
    CLI->>GitService: createAndCheckoutBranch("feature/task-1-user-authentication")
    GitService-->>CLI: 成功
    CLI->>TaskService: updateTask(1, {status: "in_progress", branch: "..."})
    TaskService->>Storage: save(updatedDb)
    Storage-->>TaskService: 成功
    TaskService-->>CLI: Task
    CLI-->>User: "タスクを開始しました\nブランチ: feature/task-1-user-authentication"
```

**フロー説明**:
1. ユーザーが `task start <id>` コマンドを実行
2. タスクが存在するか確認
3. Gitリポジトリが存在するか確認
4. ブランチ名を生成（`feature/task-{id}-{sanitized-title}`）
5. ブランチが既に存在する場合は切り替えのみ、存在しない場合は作成して切り替え
6. タスクのステータスを`in_progress`に更新、ブランチ名を保存
7. 成功メッセージを表示

### ユースケース3: タスク一覧を表示する

```mermaid
sequenceDiagram
    participant User
    participant CLI
    participant TaskService
    participant UIFormatter
    participant Storage

    User->>CLI: task list
    CLI->>TaskService: listTasks({includeArchived: false})
    TaskService->>Storage: load()
    Storage-->>TaskService: TaskDatabase
    TaskService->>TaskService: archived以外のタスクをフィルタ
    TaskService-->>CLI: Task[]
    CLI->>UIFormatter: formatTaskList(tasks)
    UIFormatter->>UIFormatter: テーブルを作成
    UIFormatter->>UIFormatter: ステータスを色付け
    UIFormatter-->>CLI: 整形されたテーブル文字列
    CLI-->>User: テーブル表示
```

**フロー説明**:
1. ユーザーが `task list` コマンドを実行
2. TaskServiceがタスク一覧を取得（デフォルトでは`archived`を除外）
3. UIFormatterがテーブル形式に整形
4. ステータスごとに色付けして表示

### ユースケース4: タスクを完了する

```mermaid
sequenceDiagram
    participant User
    participant CLI
    participant TaskService
    participant Storage

    User->>CLI: task done 1
    CLI->>TaskService: changeStatus(1, "completed")
    TaskService->>Storage: load()
    Storage-->>TaskService: TaskDatabase
    TaskService->>TaskService: タスクを検索
    TaskService->>TaskService: ステータスを"completed"に変更
    TaskService->>TaskService: updatedAtを更新
    TaskService->>Storage: save(updatedDb)
    Storage->>Storage: backup()
    Storage-->>TaskService: 成功
    TaskService-->>CLI: Task
    CLI-->>User: "タスクを完了しました (ID: 1)"
```

**フロー説明**:
1. ユーザーが `task done <id>` コマンドを実行
2. タスクが存在するか確認
3. ステータスを`completed`に変更
4. `updatedAt`を現在時刻に更新
5. データを保存
6. 成功メッセージを表示

## UI設計

### テーブル表示

**表示項目**:
| 項目 | 説明 | フォーマット |
|------|------|-------------|
| ID | タスクID | 数値 |
| Status | ステータス | 色付きテキスト（後述） |
| Title | タスクタイトル | 文字列（長い場合は切り詰め） |
| Branch | Gitブランチ名 | 文字列、未設定の場合は"-" |

**表示例**:
```
ID  Status       Title                          Branch
1   in_progress  ユーザー認証機能の実装          feature/task-1-user-authentication
2   open         データエクスポート機能          -
3   completed    初期セットアップ               feature/task-3-initial-setup
```

### カラーコーディング

**ステータスの色分け**:
- `open`: 白（デフォルト色）
- `in_progress`: 黄色（chalk.yellow）
- `completed`: 緑色（chalk.green）
- `archived`: グレー（chalk.gray）

**実装例**:
```typescript
function formatStatus(status: TaskStatus): string {
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
```

### タスク詳細表示

**表示項目**:
```
Task #1
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Title:       ユーザー認証機能の実装
Status:      in_progress
Branch:      feature/task-1-user-authentication
Created:     2025-01-15 10:30:00
Updated:     2025-01-15 14:20:00

Description:
JWT認証を実装する
- ログインエンドポイント
- トークン検証ミドルウェア
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## ファイル構造

### プロジェクト構造

```
taskcli/
├── src/
│   ├── cli/
│   │   └── index.ts           # CLIエントリーポイント
│   ├── services/
│   │   ├── TaskService.ts     # タスク管理ビジネスロジック
│   │   ├── GitService.ts      # Git連携ロジック
│   │   └── StorageService.ts  # データ永続化ロジック
│   ├── ui/
│   │   └── UIFormatter.ts     # UI整形ロジック
│   ├── types/
│   │   └── index.ts           # 型定義
│   └── index.ts               # メインエントリーポイント
├── tests/
│   ├── services/
│   │   ├── TaskService.test.ts
│   │   ├── GitService.test.ts
│   │   └── StorageService.test.ts
│   └── ui/
│       └── UIFormatter.test.ts
├── .task/                     # データディレクトリ（Gitignore）
│   ├── tasks.json             # タスクデータ
│   └── tasks.json.bak         # バックアップ
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

### データ保存形式

**ディレクトリ**: `.task/`
- ユーザーのカレントディレクトリ直下に作成
- `.gitignore`に追加を推奨（ただし強制はしない）

**ファイル**: `.task/tasks.json`

**ファイル内容例**:
```json
{
  "tasks": [
    {
      "id": 1,
      "title": "ユーザー認証機能の実装",
      "description": "JWT認証を実装する\n- ログインエンドポイント\n- トークン検証ミドルウェア",
      "status": "in_progress",
      "branch": "feature/task-1-user-authentication",
      "createdAt": "2025-01-15T10:30:00.000Z",
      "updatedAt": "2025-01-15T14:20:00.000Z"
    },
    {
      "id": 2,
      "title": "データエクスポート機能",
      "status": "open",
      "createdAt": "2025-01-15T11:00:00.000Z",
      "updatedAt": "2025-01-15T11:00:00.000Z"
    }
  ],
  "nextId": 3
}
```

**初期状態**（ファイルが存在しない場合）:
```json
{
  "tasks": [],
  "nextId": 1
}
```

## パフォーマンス最適化

- **遅延読み込み**: データファイルはコマンド実行時にのみ読み込む
- **メモリ効率**: タスクデータは必要な時だけメモリに保持、処理後はすぐに解放
- **ファイルI/O最適化**: バックアップとデータ保存を同期的に実行し、データ損失を防ぐ
- **Git操作の最適化**: simple-gitのキャッシュ機能を活用し、リポジトリ情報の取得を高速化

**パフォーマンス目標**（PRDから）:
- コマンド実行時間: 100ms以内
- タスク一覧表示: 1000件でも1秒以内

### パフォーマンステスト

**測定環境**:
- CPU: Intel Core i5 相当以上 (4コア以上推奨)
- メモリ: 8GB以上
- ストレージ: SSD
- OS: Ubuntu 22.04 / macOS 13+ / Windows 11

**測定方法**:

```typescript
// tests/performance/command-execution.test.ts
import { describe, it, expect } from 'vitest';
import { TaskCLI } from '../../src/cli/TaskCLI';

describe('Performance Tests', () => {
  it('should complete task add command within 100ms', async () => {
    const cli = new TaskCLI();
    const start = performance.now();
    await cli.run(['add', 'Test Task']);
    const end = performance.now();

    const duration = end - start;
    console.log(`task add: ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(100);
  });

  it('should display 1000 tasks within 1 second', async () => {
    // 1000件のテストデータを事前に準備
    const cli = new TaskCLI();

    const start = performance.now();
    await cli.run(['list']);
    const end = performance.now();

    const duration = end - start;
    console.log(`task list (1000 items): ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(1000);
  });

  it('should complete task start command within 100ms', async () => {
    const cli = new TaskCLI();

    const start = performance.now();
    await cli.run(['start', '1']);
    const end = performance.now();

    const duration = end - start;
    console.log(`task start: ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(100);
  });
});
```

**実行方法**:
```bash
# パフォーマンステストの実行
npm run test:performance

# CI/CDでの実行
# 3回実行して平均値を測定し、目標値を20%上回る場合は警告
```

**測定タイミング**:
- プルリクエスト作成時: CI/CDで自動実行
- リリース前: 手動で詳細な測定を実施
- パフォーマンス劣化が検出された場合: 原因調査と最適化

**注意事項**:
- 初回実行はNode.jsのJITコンパイルの影響で遅くなる場合があるため、ウォームアップ実行を含める
- ファイルI/Oはストレージ速度に依存するため、SSD環境での測定を推奨
- 測定結果は環境によって変動するため、複数回測定して平均値を使用

## セキュリティ考慮事項

- **入力バリデーション**: すべてのユーザー入力をバリデーションし、不正な値を拒否
  - タスクタイトル: 1-200文字
  - タスクID: 正の整数のみ許可
- **パストラバーサル対策**: データディレクトリは固定（`.task/`）、ユーザー指定のパスは許可しない
- **JSONパース**: JSON.parseのエラーハンドリングを適切に実装し、破損したファイルでも安全に処理
- **コマンドインジェクション対策**: simple-gitを使用し、直接シェルコマンドを実行しない

## エラーハンドリング

### エラーの分類

| エラー種別 | 処理 | ユーザーへの表示 | 終了コード |
|-----------|------|-----------------|-----------|
| タスクが見つからない | 処理を中断 | "タスクが見つかりません (ID: {id})" | 1 |
| 入力検証エラー | 処理を中断 | "タイトルは1-200文字で入力してください" | 1 |
| Gitリポジトリが存在しない | 処理を中断 | "Gitリポジトリが見つかりません。`git init`を実行してください" | 1 |
| ファイル読み込みエラー | 空のデータで初期化 | "データファイルが見つかりません。新規作成します" | 0 |
| ファイル書き込みエラー | 処理を中断 | "データの保存に失敗しました: {エラー内容}" | 1 |
| JSONパースエラー | 処理を中断 | "データファイルが破損しています。バックアップから復元してください" | 1 |
| Git操作エラー | 処理を中断 | "ブランチの作成に失敗しました: {エラー内容}" | 1 |
| 不明なエラー | 処理を中断 | "予期しないエラーが発生しました: {エラー内容}" | 1 |

### エラーハンドリング実装例

```typescript
// TaskServiceのエラーハンドリング
class TaskService {
  getTask(id: number): Task {
    const db = this.storage.load();
    const task = db.tasks.find(t => t.id === id);

    if (!task) {
      throw new TaskNotFoundError(`タスクが見つかりません (ID: ${id})`);
    }

    return task;
  }

  createTask(data: CreateTaskInput): Task {
    // タイトルのバリデーション
    if (!data.title || data.title.length < 1 || data.title.length > 200) {
      throw new ValidationError('タイトルは1-200文字で入力してください');
    }

    // ... タスク作成処理
  }
}

// カスタムエラークラス
class TaskNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TaskNotFoundError';
  }
}

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// CLIでのエラーハンドリング
try {
  // コマンド実行
} catch (error) {
  if (error instanceof TaskNotFoundError) {
    console.error(chalk.red(error.message));
    process.exit(1);
  } else if (error instanceof ValidationError) {
    console.error(chalk.red(error.message));
    process.exit(1);
  } else {
    console.error(chalk.red(`予期しないエラーが発生しました: ${error.message}`));
    process.exit(1);
  }
}
```

## テスト戦略

### ユニットテスト

**対象**:
- **TaskService**: 各メソッドの動作を検証
  - `createTask`: タスク作成、バリデーション、ID採番
  - `listTasks`: フィルタリング、ソート
  - `getTask`: 存在するタスクの取得、存在しないタスクのエラー
  - `updateTask`: 更新処理、バリデーション
  - `changeStatus`: ステータス変更、updatedAt更新
  - `deleteTask`: 削除処理、エラーハンドリング

- **GitService**: Git操作のモック化
  - `isGitRepository`: Gitリポジトリの存在確認
  - `generateBranchName`: ブランチ名生成、サニタイズ
  - `createAndCheckoutBranch`: ブランチ作成、切り替え

- **StorageService**: ファイルI/Oのモック化
  - `load`: ファイル読み込み、JSONパース
  - `save`: ファイル書き込み、バックアップ
  - `initialize`: ディレクトリ作成

- **UIFormatter**: 表示フォーマットの検証
  - `formatTaskList`: テーブル整形
  - `formatStatus`: 色付け

**ツール**: Vitest

### 統合テスト

**シナリオ**:
1. **タスク作成から完了までのフロー**
   - タスク作成 → 一覧表示 → タスク開始 → 完了
   - データの永続化を確認
   - Git操作（ブランチ作成）を確認

2. **エラーハンドリング**
   - 存在しないタスクIDを指定
   - 不正な入力値を与える
   - Gitリポジトリがない状態で`task start`を実行

3. **データの整合性**
   - 複数のタスクを作成してID採番を確認
   - タスク削除後のID採番を確認

**ツール**: Vitest

### E2Eテスト

**シナリオ**:
1. **基本的な使用フロー**
   - CLIをインストール
   - `task add`でタスクを作成
   - `task list`で一覧表示
   - `task start`でタスクを開始（ブランチ作成確認）
   - `task done`でタスクを完了
   - `task list`で完了状態を確認

2. **Git連携**
   - Gitリポジトリを初期化
   - タスクを開始してブランチが作成されることを確認
   - 既存ブランチでタスクを開始した場合の動作確認

3. **クロスプラットフォーム**
   - macOS、Linux、Windows(Git Bash)で基本操作を実行
   - 各環境でファイルパスが正しく扱われることを確認

**ツール**: Vitest + 実際のCLI実行

### テストカバレッジ目標

- **ユニットテスト**: 90%以上
- **統合テスト**: 主要なユースケースをカバー
- **E2Eテスト**: 基本フローとエラーケースをカバー

## ブランチ名サニタイズの詳細

### サニタイズルール

**実装クラス**: `StringUtils.sanitizeForBranchName()` (src/utils/StringUtils.ts)

**目的**: タスクタイトルをGitブランチ名として使える形式に変換する

**変換ルール**:
1. 小文字に変換
2. スペースをハイフン(-)に変換
3. 英数字とハイフン以外の文字を削除
4. 連続するハイフンを1つにまとめる
5. 先頭と末尾のハイフンを削除
6. 最大長を50文字に制限

**実装**:
```typescript
// src/utils/StringUtils.ts
static sanitizeForBranchName(text: string): string {
  const sanitized = text
    .toLowerCase()                       // 小文字化
    .replace(/\s+/g, '-')                // スペース → ハイフン
    .replace(/[^a-z0-9-]/g, '')          // 英数字とハイフン以外を削除
    .replace(/-+/g, '-')                 // 連続ハイフン → 1つ
    .replace(/^-+|-+$/g, '')             // 先頭と末尾のハイフンを削除
    .substring(0, 50);                   // 最大50文字

  return sanitized || 'untitled';        // 空文字列の場合はデフォルト値
}
```

**変換例**:
- `"ユーザー認証機能の実装"` → `"untitled"` (日本語は削除され、デフォルト値)
- `"Implement User Authentication"` → `"implement-user-authentication"`
- `"Fix bug #123"` → `"fix-bug-123"`
- `"Add  multiple   spaces"` → `"add-multiple-spaces"`

**日本語タイトルの対応**:
日本語タイトルの場合、サニタイズ後に空文字列になる可能性がある。
`StringUtils.sanitizeForBranchName()`は空文字列の場合に`"untitled"`を返すため、
`GitService.generateBranchName()`では以下のように実装:
```typescript
// src/services/GitService.ts
generateBranchName(taskId: number, taskTitle: string): string {
  const sanitized = StringUtils.sanitizeForBranchName(taskTitle);
  return `feature/task-${taskId}-${sanitized}`;
}
```

**変換例（日本語タイトル）**:
- タスクID: 1, タイトル: `"ユーザー認証機能の実装"` → `"feature/task-1-untitled"`

### 日本語ブランチ名の対応改善（P1以降の検討事項）

**現状の問題点**:
- 日本語タイトルは完全に削除され、`untitled`になる
- ブランチ名からタスク内容が判別できず、ユーザー体験が低下
- GitおよびGitHubはUnicode文字（日本語）をサポートしているため、技術的な制約ではない

**改善オプション**:

**オプション1: ローマ字変換**
```typescript
// 外部ライブラリ（例: kuroshiro, hepburn）を使用
import { romanize } from 'hepburn';

static sanitizeForBranchName(text: string): string {
  const romanized = romanize(text);  // "ユーザー認証" → "yuza ninsho"
  const sanitized = romanized
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);

  return sanitized || 'untitled';
}

// 変換例: "ユーザー認証機能の実装" → "feature/task-1-yuza-ninsho-kino-no-jisso"
```

**メリット**: ASCII文字のみで構成され、互換性が高い
**デメリット**: 外部ライブラリの依存関係が増える、ローマ字表記が不自然な場合がある

**オプション2: 日本語をそのまま許可**
```typescript
static sanitizeForBranchName(text: string): string {
  const sanitized = text
    .replace(/\s+/g, '-')
    .replace(/[<>:"|?*\\\/]/g, '')  // ファイルシステムで禁止された文字のみ削除
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);

  return sanitized || 'untitled';
}

// 変換例: "ユーザー認証機能の実装" → "feature/task-1-ユーザー認証機能の実装"
```

**メリット**: タスク内容が明確、実装がシンプル
**デメリット**: 一部の古いツールで文字化けの可能性（GitHubは問題なし）

**オプション3: 設定ファイルでカスタマイズ可能に（推奨）**
```typescript
// .task/config.json
{
  "branchNaming": {
    "strategy": "romanize" | "unicode" | "ascii-only",
    "maxLength": 50
  }
}

// src/utils/StringUtils.ts
class StringUtils {
  static sanitizeForBranchName(text: string, config: BranchNamingConfig): string {
    switch (config.strategy) {
      case 'romanize':
        return this.romanizeBranchName(text, config.maxLength);
      case 'unicode':
        return this.unicodeBranchName(text, config.maxLength);
      case 'ascii-only':
      default:
        return this.asciiBranchName(text, config.maxLength);
    }
  }
}
```

**メリット**: ユーザーが好みに応じて選択可能、将来的な拡張性が高い
**デメリット**: 実装が複雑、設定管理が必要

**推奨実装計画**:
1. **MVP**: 現在の実装（ASCII only、日本語は削除）
2. **P1**: オプション3の設定ファイル方式を実装、デフォルトは`ascii-only`
3. **P2**: ローマ字変換（オプション1）をサポート追加
