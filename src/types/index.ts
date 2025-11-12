/**
 * TaskCLI型定義
 */

// タスクのステータス
export type TaskStatus = 'open' | 'in_progress' | 'completed' | 'archived';

// タスクエンティティ
export interface Task {
  id: number; // タスクID（1から自動採番）
  title: string; // タスクタイトル（1-200文字）
  description?: string; // タスクの詳細説明（オプション、Markdown形式）
  status: TaskStatus; // タスクのステータス
  branch?: string; // 関連するGitブランチ名（task start実行後に設定）
  createdAt: string; // 作成日時（ISO 8601形式）
  updatedAt: string; // 更新日時（ISO 8601形式）
}

// タスクデータベース
export interface TaskDatabase {
  tasks: Task[]; // タスクの配列
  nextId: number; // 次に採番されるタスクID
}

// タスク作成時の入力データ
export interface CreateTaskInput {
  title: string;
  description?: string;
}

// タスク更新時の入力データ
export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  branch?: string;
}

// タスク一覧取得時のオプション
export interface ListOptions {
  status?: TaskStatus;
  includeArchived?: boolean;
}

// カスタムエラークラス
export class TaskNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TaskNotFoundError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class GitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitError';
  }
}

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageError';
  }
}
