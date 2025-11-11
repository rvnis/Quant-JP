# 技術仕様書 (Architecture Design Document)

## テクノロジースタック

### 言語・ランタイム

| 技術 | バージョン |
|------|-----------|
| Node.js | v24.11.0 |
| TypeScript | 5.x |
| npm | 11.x |

**選定理由**:

- **Node.js v24.11.0 (LTS)**
  - 2026年4月までの長期サポート保証により、本番環境での安定稼働が期待できる
  - 非同期I/O処理に優れ、ファイル操作やGit操作の並列処理が高速
  - npmエコシステムが充実しており、必要なライブラリ（CLI、Git連携など）の入手が容易
  - クロスプラットフォーム対応が容易（macOS、Linux、Windows）

- **TypeScript 5.x**
  - 静的型付けによりコンパイル時にバグを検出でき、保守性が向上
  - 特にCLIツールのような複雑な入力バリデーションで型安全性が重要
  - IDEの補完機能が強力で、開発効率が高い
  - チーム開発における型定義の共有により、コードの可読性と品質が担保される

- **npm 11.x**
  - Node.js v24.11.0に標準搭載されており、別途インストール不要
  - package-lock.jsonによる依存関係の厳密な管理が可能
  - `npm link`によるローカル開発がシンプル

### フレームワーク・ライブラリ

| 技術 | バージョン | 用途 | 選定理由 |
|------|-----------|------|----------|
| Commander.js | ^12.0.0 | CLIフレームワーク | シンプルで学習コストが低い、型定義が充実、サブコマンド対応 |
| simple-git | ^3.25.0 | Git操作 | Node.jsで広く使われている、Promiseベース、型定義あり |
| cli-table3 | ^0.6.5 | テーブル表示 | Unicode対応、カスタマイズ性が高い、CLIでの表形式表示に最適 |
| chalk | ^5.3.0 | カラー出力 | 広く使われている、シンプルなAPI、豊富な色指定オプション |

**選定理由詳細**:

- **Commander.js**
  - CLIツールのデファクトスタンダード
  - サブコマンド、オプション、ヘルプ生成が簡単
  - TypeScript型定義が充実
  - 代替案のoclif（Salesforce製）は多機能すぎて学習コストが高い
  - yargsも候補だが、Commanderの方がシンプルで直感的

- **simple-git**
  - Gitコマンドをラップし、Node.jsから安全に実行できる
  - Promiseベースで非同期処理が書きやすい
  - エラーハンドリングが充実
  - 代替案のnodegitはネイティブバインディングが必要で導入が複雑

- **cli-table3**
  - テーブル形式でのタスク一覧表示に最適
  - Unicode文字（日本語）に対応
  - カラム幅の自動調整機能
  - 代替案のasciitableはUnicode対応が不十分

- **chalk**
  - ターミナルでの色付け表示のデファクトスタンダード
  - ステータス（open、in_progress、completed）の視覚的区別に使用
  - ESM対応（v5以降）
  - 代替案のcolorsはメンテナンスが停滞

### 開発ツール

| 技術 | バージョン | 用途 | 選定理由 |
|------|-----------|------|----------|
| Vitest | ^2.0.0 | テストフレームワーク | 高速、TypeScript対応、Vitベース、ESM対応 |
| ESLint | ^9.0.0 | コード品質チェック | 業界標準、TypeScript対応、豊富なルールセット |
| Prettier | ^3.0.0 | コードフォーマット | 自動整形、チーム開発での統一性確保 |
| tsx | ^4.0.0 | TypeScript実行 | 高速、型チェック不要、開発時の実行に最適 |

**選定理由詳細**:

- **Vitest**
  - Jestよりも高速（Vitベースのトランスパイル）
  - TypeScriptのESMに対応
  - Jestと互換性のあるAPIで学習コストが低い
  - Watch modeが高速で開発体験が良い

- **ESLint**
  - TypeScript ESLintプラグインで型チェックと連携
  - 潜在的なバグを早期発見
  - コードレビューの負担軽減

- **Prettier**
  - コードスタイルの議論を排除
  - Git差分が見やすくなる
  - ESLintと組み合わせて使用

- **tsx**
  - TypeScriptファイルを直接実行（ts-nodeより高速）
  - 開発時のデバッグに使用
  - 本番ビルドはtscでコンパイル

## アーキテクチャパターン

### レイヤードアーキテクチャ（3層）

```
┌─────────────────────────────────────┐
│   プレゼンテーション層                 │
│   - CLI (Commander.js)              │
│   - UIFormatter (表示整形)           │
├─────────────────────────────────────┤
│   ビジネスロジック層                   │
│   - TaskService (タスク管理)          │
│   - GitService (Git操作)             │
├─────────────────────────────────────┤
│   データアクセス層                     │
│   - StorageService (ファイルI/O)     │
└─────────────────────────────────────┘
```

#### プレゼンテーション層

**責務**:
- ユーザーからのコマンド入力を受け付ける
- 入力のバリデーション（タイトル長、IDの形式など）
- 実行結果を整形して表示する
- エラーメッセージを表示する

**許可される操作**:
- ビジネスロジック層のサービスを呼び出す
- 表示のためのフォーマット処理

**禁止される操作**:
- データアクセス層への直接アクセス
- ビジネスロジックの実装（優先度計算など）
- ファイルI/Oの直接実行

**実装例**:
```typescript
// OK: サービス層を呼び出す
class CLI {
  async addTask(title: string) {
    const task = await this.taskService.createTask({ title });
    this.uiFormatter.displaySuccess(`タスクを作成しました (ID: ${task.id})`);
  }
}

// NG: データ層を直接呼び出す
class CLI {
  async addTask(title: string) {
    const task = await this.storageService.save({ title }); // ❌
  }
}
```

#### ビジネスロジック層

**責務**:
- タスクのCRUD操作
- ステータス管理（open → in_progress → completed）
- Git操作（ブランチ作成、切り替え）
- ビジネスルールの実装（ブランチ名生成、バリデーション）

**許可される操作**:
- データアクセス層のサービスを呼び出す
- 他のサービス層のサービスを呼び出す（TaskService → GitService）
- ビジネスロジックの実装

**禁止される操作**:
- プレゼンテーション層への依存（console.logなど）
- ファイルI/Oの直接実行

**実装例**:
```typescript
// OK: ビジネスロジックを実装
class TaskService {
  async startTask(id: number): Promise<Task> {
    const task = this.getTask(id);

    // Gitブランチを作成
    if (this.gitService.isGitRepository()) {
      const branchName = this.gitService.generateBranchName(id, task.title);
      this.gitService.createAndCheckoutBranch(branchName);
      task.branch = branchName;
    }

    // ステータスを更新
    task.status = 'in_progress';
    task.updatedAt = new Date().toISOString();

    return this.updateTask(id, task);
  }
}
```

#### データアクセス層

**責務**:
- JSONファイルへのデータ保存
- JSONファイルからのデータ読み込み
- ファイルの存在確認
- バックアップの作成

**許可される操作**:
- ファイルシステムへのアクセス（fs module）
- JSON.parseとJSON.stringify

**禁止される操作**:
- ビジネスロジックの実装
- データの変換（タスクオブジェクトの構築など）

**実装例**:
```typescript
// OK: データの永続化のみ
class StorageService {
  save(db: TaskDatabase): void {
    this.backup();  // バックアップ作成
    fs.writeFileSync(this.filePath, JSON.stringify(db, null, 2));
  }
}

// NG: ビジネスロジックの実装
class StorageService {
  save(db: TaskDatabase): void {
    // タスクのステータスを変更する処理 ❌
    db.tasks.forEach(t => {
      if (t.status === 'in_progress') {
        t.updatedAt = new Date().toISOString();
      }
    });

    fs.writeFileSync(this.filePath, JSON.stringify(db, null, 2));
  }
}
```

### 依存関係の方向

```
CLI → TaskService → StorageService
CLI → GitService → simple-git
CLI → UIFormatter
```

**重要な原則**:
- 依存関係は常に上から下（UI → Service → Data）
- 下位層は上位層に依存しない
- 同じ層のコンポーネント間の依存は最小限に

## データ永続化戦略

### ストレージ方式

| データ種別 | ストレージ | フォーマット | 理由 |
|-----------|----------|-------------|------|
| タスクデータ | ローカルファイル | JSON | 人間が読みやすい、Gitで管理可能、標準ライブラリで扱える |
| バックアップ | ローカルファイル | JSON | 復元が容易、差分確認が可能 |

**選定理由**:

**なぜJSONか**:
- 人間が読める形式で、デバッグやトラブルシューティングが容易
- 標準ライブラリ（JSON.parse/stringify）で扱えるため、外部ライブラリ不要
- Gitで管理できる（チームでタスクを共有する場合）
- 移行が容易（将来的にSQLiteに移行する際もJSONから変換しやすい）

**なぜSQLiteではないか（MVPでは）**:
- MVPではデータ量が少ない（1000件程度）ため、JSONで十分
- SQLiteはネイティブバインディングが必要で、クロスプラットフォーム対応が複雑
- 学習コストが高い（SQL、マイグレーション管理など）
- 将来的にデータ量が増えた場合は移行を検討

### ファイル構造

```
.task/
├── tasks.json          # タスクデータ（メイン）
└── tasks.json.bak      # バックアップ（直前の1世代）
```

**パス**: カレントディレクトリ直下の `.task/`
- プロジェクトごとにタスクを管理
- `.gitignore`に追加を推奨（ただし強制はしない）

### バックアップ戦略

- **頻度**: タスクの追加・更新・削除のたびに自動バックアップ
- **保存先**: `.task/tasks.json.bak`
- **世代管理**: 最新1世代のみ保持（ディスク容量の節約）
- **復元方法**:
  1. `.task/tasks.json`が破損した場合、`.task/tasks.json.bak`をコピー
  2. 手動での復元: `cp .task/tasks.json.bak .task/tasks.json`

**バックアップのタイミング**:
```typescript
class StorageService {
  save(db: TaskDatabase): void {
    // 1. 既存ファイルをバックアップ
    if (this.exists()) {
      fs.copyFileSync(this.filePath, this.backupPath);
    }

    // 2. 新しいデータを書き込み
    fs.writeFileSync(this.filePath, JSON.stringify(db, null, 2));
  }
}
```

**データ損失リスクの最小化**:
- 書き込み前に必ずバックアップ
- 書き込み失敗時は既存ファイルが保持される
- JSONパースエラー時はバックアップからの復元を提案

## パフォーマンス要件

### レスポンスタイム

| 操作 | 目標時間 | 測定環境 | 測定方法 |
|------|---------|---------|---------|
| コマンド起動〜実行完了 | 100ms以内 | CPU Core i5相当、メモリ8GB、SSD | `time task list`で計測 |
| タスク一覧表示（100件） | 100ms以内 | 同上 | `console.time`でload〜表示まで計測 |
| タスク一覧表示（1000件） | 1秒以内 | 同上 | 同上 |
| タスク作成 | 50ms以内 | 同上 | 同上 |
| タスク開始（Git連携） | 200ms以内 | 同上 | Git操作を含むため許容 |

### パフォーマンス最適化戦略

**1. 遅延読み込み**:
- データファイルはコマンド実行時にのみ読み込む
- 使用しないデータは読み込まない

**2. メモリ効率**:
- タスクデータは処理時のみメモリに保持
- 処理後はすぐにガベージコレクション可能にする

**3. ファイルI/O最適化**:
- 同期的なファイル読み書き（fs.readFileSync/writeFileSync）を使用
  - CLIツールは短時間で完了するため、非同期のオーバーヘッドを避ける
  - コードがシンプルになり、エラーハンドリングが容易

**4. Git操作の最適化**:
- simple-gitのキャッシュ機能を活用
- 不要なGit操作を避ける（ブランチ存在確認など）

### リソース使用量

| リソース | 上限 | 理由 |
|---------|------|------|
| メモリ | 50MB | CLIツールは軽量であるべき、JSONデータは小さい |
| CPU | 10% | コマンド実行は瞬間的、常駐しない |
| ディスク | 10MB | タスクデータ（1000件で約1MB）+ 依存関係 |

**測定方法**:
- メモリ: `process.memoryUsage()`
- CPU: プロファイラー（Node.js Inspector）
- ディスク: `du -sh .task/`

## セキュリティアーキテクチャ

### データ保護

**1. ファイルパーミッション**:
- `.task/tasks.json`: 所有者のみ読み書き可能（`chmod 600`）
- `.task/`ディレクトリ: 所有者のみアクセス可能（`chmod 700`）

**実装**:
```typescript
class StorageService {
  initialize(): void {
    if (!fs.existsSync(this.taskDir)) {
      fs.mkdirSync(this.taskDir, { mode: 0o700 });
    }
  }

  save(db: TaskDatabase): void {
    fs.writeFileSync(this.filePath, JSON.stringify(db, null, 2), { mode: 0o600 });
  }
}
```

**2. 暗号化**:
- MVPでは暗号化なし（ローカルファイルのみ）
- P1以降でGitHub連携時にPersonal Access Tokenを暗号化

**3. 機密情報管理**:
- GitHub Personal Access Token: OSのキーチェーンに保存
  - macOS: Keychain Access
  - Windows: Credential Manager
  - Linux: Secret Service API (libsecret)
- フォールバック: 環境変数（`TASKCLI_GITHUB_TOKEN`）

### 入力検証

**1. バリデーション**:
```typescript
function validateTaskInput(data: CreateTaskInput): void {
  // タイトルの検証
  if (!data.title || data.title.trim().length === 0) {
    throw new ValidationError('タイトルは必須です');
  }

  if (data.title.length > 200) {
    throw new ValidationError('タイトルは200文字以内で入力してください');
  }

  // IDの検証（数値のみ）
  if (typeof data.id !== 'number' || data.id <= 0) {
    throw new ValidationError('タスクIDは正の整数である必要があります');
  }
}
```

**2. サニタイゼーション**:
- ブランチ名の生成時にタイトルをサニタイズ
- 特殊文字を削除、スペースをハイフンに変換

```typescript
sanitizeBranchName(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')          // スペース → ハイフン
    .replace(/[^a-z0-9-]/g, '')    // 英数字とハイフン以外を削除
    .replace(/-+/g, '-')           // 連続ハイフン → 1つ
    .replace(/^-+|-+$/g, '')       // 先頭と末尾のハイフンを削除
    .substring(0, 50);             // 最大50文字
}
```

**3. エラーハンドリング**:
- エラーメッセージにセンシティブな情報を含めない
- ファイルパスは相対パスで表示（`.task/tasks.json`）

### セキュリティ脅威への対策

| 脅威 | 対策 |
|------|------|
| パストラバーサル | データディレクトリを固定（`.task/`）、ユーザー指定のパスは許可しない |
| コマンドインジェクション | simple-gitを使用し、直接シェルコマンドを実行しない |
| JSONインジェクション | JSON.parseを使用、手動でパースしない |
| 不正なファイルアクセス | ファイルパーミッションを適切に設定 |

## スケーラビリティ設計

### データ増加への対応

**想定データ量**: 10,000件のタスク

**パフォーマンス劣化対策**:

1. **ページネーション（P1で実装）**:
```typescript
interface ListOptions {
  limit?: number;    // デフォルト: 100
  offset?: number;   // デフォルト: 0
}

listTasks(options: ListOptions): Task[] {
  const { limit = 100, offset = 0 } = options;
  return this.tasks.slice(offset, offset + limit);
}
```

2. **インデックス最適化（将来的にSQLite移行時）**:
- タスクIDにインデックスを作成
- ステータスにインデックスを作成

3. **アーカイブ機能**:
```typescript
// P1で実装: 完了タスクを自動アーカイブ
archiveCompletedTasks(olderThan: Date): void {
  const oldTasks = this.tasks.filter(t =>
    t.status === 'completed' &&
    new Date(t.updatedAt) < olderThan
  );

  // アーカイブファイルに移動
  this.archiveStorage.save(oldTasks);
  this.tasks = this.tasks.filter(t => !oldTasks.includes(t));
}
```

### 機能拡張性

**1. プラグインシステム（P2で検討）**:
```typescript
// 将来的なプラグインインターフェース
interface TaskCLIPlugin {
  name: string;
  version: string;

  // タスク作成時のフック
  onTaskCreated?(task: Task): void;

  // タスク完了時のフック
  onTaskCompleted?(task: Task): void;
}
```

**2. 設定のカスタマイズ**:
```json
// .task/config.json
{
  "defaultStatus": "open",
  "branchPrefix": "feature/",
  "autoArchiveDays": 30,
  "colorScheme": "default"
}
```

**3. API拡張性**:
- TypeScriptの型定義を公開し、外部ツールから利用可能に
- 将来的にRESTful APIを提供（P2）

## テスト戦略

### ユニットテスト

- **フレームワーク**: Vitest
- **対象**: すべてのサービス層とデータ層
  - TaskService: CRUD操作、ステータス管理
  - GitService: ブランチ名生成、サニタイズ
  - StorageService: ファイルI/O、バックアップ
  - UIFormatter: 表示整形
- **カバレッジ目標**: 90%以上

**モック戦略**:
- ファイルI/OはモックしてテストをOSに依存させない
- Git操作はモックして実際のGitリポジトリを不要にする

**例**:
```typescript
describe('TaskService', () => {
  let taskService: TaskService;
  let storageService: StorageService;

  beforeEach(() => {
    storageService = new MockStorageService();
    taskService = new TaskService(storageService);
  });

  it('should create a task with auto-incremented ID', () => {
    const task = taskService.createTask({ title: 'Test Task' });
    expect(task.id).toBe(1);
    expect(task.status).toBe('open');
  });
});
```

### 統合テスト

- **方法**: 実際のファイルシステムを使用したテスト
- **対象**: CLI → Service → Storageの連携
  - タスク作成から一覧表示まで
  - タスク開始（Git連携）から完了まで
  - エラーハンドリング

**テスト環境**:
- 一時ディレクトリを作成（`/tmp/taskcli-test-{uuid}`）
- テスト後にクリーンアップ

**例**:
```typescript
describe('Integration: Task lifecycle', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync('/tmp/taskcli-test-');
    process.chdir(tempDir);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true });
  });

  it('should create, start, and complete a task', async () => {
    // タスク作成
    await cli.run(['add', 'Test Task']);

    // タスク一覧確認
    const tasks = await taskService.listTasks();
    expect(tasks).toHaveLength(1);

    // タスク開始
    await cli.run(['start', '1']);

    // タスク完了
    await cli.run(['done', '1']);

    // ステータス確認
    const task = await taskService.getTask(1);
    expect(task.status).toBe('completed');
  });
});
```

### E2Eテスト

- **ツール**: Vitest + 実際のCLI実行
- **シナリオ**:
  1. 基本的な使用フロー（add → list → start → done）
  2. Git連携（ブランチ作成確認）
  3. エラーケース（存在しないタスクID、不正な入力）
  4. クロスプラットフォーム（macOS、Linux、Windows）

**テスト実行方法**:
```typescript
// 実際のCLIを実行
const result = execSync('task add "Test Task"', { encoding: 'utf-8' });
expect(result).toContain('タスクを作成しました');
```

### パフォーマンステスト

- **ツール**: Vitest + `console.time`
- **シナリオ**:
  - 100件のタスク作成 → 一覧表示: 100ms以内
  - 1000件のタスク作成 → 一覧表示: 1秒以内
  - タスク作成: 50ms以内

**例**:
```typescript
describe('Performance', () => {
  it('should display 1000 tasks within 1 second', () => {
    // 1000件のダミータスクを作成
    const tasks = Array.from({ length: 1000 }, (_, i) => ({
      id: i + 1,
      title: `Task ${i + 1}`,
      status: 'open' as TaskStatus,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    storageService.save({ tasks, nextId: 1001 });

    // 一覧表示の時間を計測
    const start = performance.now();
    taskService.listTasks();
    const end = performance.now();

    expect(end - start).toBeLessThan(1000);
  });
});
```

## 技術的制約

### 環境要件

- **OS**: macOS 11+、Ubuntu 20.04+、Windows 10+ (Git Bash)
- **最小メモリ**: 512MB（Node.jsランタイム含む）
- **必要ディスク容量**: 50MB（依存関係含む）
- **必要な外部依存**:
  - Node.js 18以上（推奨: v24.11.0 LTS）
  - Git 2.0以上（Git連携機能を使用する場合）

### パフォーマンス制約

- コマンド実行時間: 100ms以内（タスク数1000件以下）
- メモリ使用量: 50MB以内
- ディスク使用量: 10MB以内（タスクデータのみ）

### セキュリティ制約

- ローカルファイルシステムへのアクセスのみ許可
- ネットワーク通信は行わない（MVPでは）
- ユーザー指定のパスへのアクセスは禁止

## 依存関係管理

| ライブラリ | 用途 | バージョン管理方針 | 理由 |
|-----------|------|-------------------|------|
| commander | CLIフレームワーク | `^12.0.0` (マイナーバージョンまで許可) | 安定しているため、マイナーバージョンアップは安全 |
| simple-git | Git操作 | `^3.25.0` (マイナーバージョンまで許可) | 安定しているため、マイナーバージョンアップは安全 |
| cli-table3 | テーブル表示 | `^0.6.5` (マイナーバージョンまで許可) | UIライブラリ、破壊的変更が少ない |
| chalk | カラー出力 | `5.3.0` (固定) | v5以降はESMのみ、メジャーバージョンアップは慎重に |
| typescript | TypeScript | `~5.6.3` (パッチバージョンのみ) | コンパイラのため、パッチバージョンのみ許可 |
| vitest | テストフレームワーク | `^2.0.0` (マイナーバージョンまで許可) | 開発依存のため、柔軟に |
| eslint | Linter | `^9.0.0` (マイナーバージョンまで許可) | 開発依存のため、柔軟に |

**バージョン管理の原則**:
- 安定版ライブラリ: `^`（マイナーバージョンまで自動更新）
- 破壊的変更のリスクがあるライブラリ: 固定（`5.3.0`）
- 開発依存: `^`（マイナーバージョンまで自動更新）
- TypeScript: `~`（パッチバージョンのみ）

**定期的な更新**:
- 四半期に1回、依存関係の更新を実施
- セキュリティアップデートは即座に適用
- `npm audit`でセキュリティ脆弱性をチェック

## ビルドとデプロイ

### ビルドプロセス

```bash
# 開発時
npm run dev      # tsx で TypeScript を直接実行

# 本番ビルド
npm run build    # tsc でコンパイル (dist/ に出力)

# テスト
npm test         # Vitest でユニットテスト
npm run test:e2e # E2Eテスト
```

### パッケージング

```bash
# npmパッケージとして公開
npm publish

# グローバルインストール
npm install -g taskcli
```

### ディレクトリ構造（ビルド後）

```
dist/
├── cli/
│   └── index.js
├── services/
│   ├── TaskService.js
│   ├── GitService.js
│   └── StorageService.js
├── ui/
│   └── UIFormatter.js
├── types/
│   └── index.js
└── index.js
```

## 将来的な拡張（ロードマップ）

### P1: 初期リリース後すぐに実装

1. **GitHub Issues連携**
   - GitHub APIを使用してIssuesと同期
   - Personal Access Tokenの暗号化保存
   - 双方向同期（ローカル ↔ GitHub）

2. **タスク完了時の自動処理**
   - 自動マージ機能
   - PR自動作成機能
   - コンフリクトチェック

3. **検索・絞り込み機能**
   - キーワード検索
   - ステータスフィルタ
   - 優先度ソート

### P2: 将来的に検討

1. **チーム機能**
   - チームメンバーのタスク一覧表示
   - タスクのアサイン機能
   - GitHub Organization連携

2. **SQLiteへの移行**
   - データ量が増えた場合のパフォーマンス改善
   - マイグレーションツールの提供

3. **プラグインシステム**
   - サードパーティプラグインのサポート
   - カスタムコマンドの追加
   - 外部サービス連携（Slack、Discordなど）
