import {
  Task,
  TaskStatus,
  CreateTaskInput,
  UpdateTaskInput,
  ListOptions,
  TaskNotFoundError,
  ValidationError,
} from '../types/index.js';
import { StorageService } from './StorageService.js';

/**
 * タスク管理サービス
 * タスクのCRUD操作とビジネスロジックを担当
 */
export class TaskService {
  constructor(private storageService: StorageService) {}

  /**
   * 新しいタスクを作成
   * @param input タスク作成データ
   * @returns 作成されたタスク
   */
  createTask(input: CreateTaskInput): Task {
    // バリデーション
    if (!input.title || input.title.trim().length === 0) {
      throw new ValidationError('タスクタイトルは必須です');
    }

    if (input.title.length > 200) {
      throw new ValidationError(
        'タスクタイトルは200文字以内で入力してください'
      );
    }

    const db = this.storageService.load();
    const now = new Date().toISOString();

    const task: Task = {
      id: db.nextId,
      title: input.title.trim(),
      description: input.description?.trim() || undefined,
      status: 'open',
      createdAt: now,
      updatedAt: now,
    };

    db.tasks.push(task);
    db.nextId++;

    this.storageService.save(db);

    return task;
  }

  /**
   * タスク一覧を取得
   * @param options フィルタオプション
   * @returns タスク一覧
   */
  listTasks(options: ListOptions = {}): Task[] {
    const db = this.storageService.load();
    let tasks = db.tasks;

    // ステータスフィルタ
    if (options.status) {
      tasks = tasks.filter((task) => task.status === options.status);
    }

    // アーカイブされたタスクを除外（デフォルト）
    if (!options.includeArchived) {
      tasks = tasks.filter((task) => task.status !== 'archived');
    }

    // ID順でソート
    return tasks.sort((a, b) => a.id - b.id);
  }

  /**
   * 特定のタスクを取得
   * @param id タスクID
   * @returns タスク
   */
  getTask(id: number): Task {
    const db = this.storageService.load();
    const task = db.tasks.find((t) => t.id === id);

    if (!task) {
      throw new TaskNotFoundError(`タスクが見つかりません (ID: ${id})`);
    }

    return task;
  }

  /**
   * タスクを更新
   * @param id タスクID
   * @param input 更新データ
   * @returns 更新されたタスク
   */
  updateTask(id: number, input: UpdateTaskInput): Task {
    const db = this.storageService.load();
    const taskIndex = db.tasks.findIndex((t) => t.id === id);

    if (taskIndex === -1) {
      throw new TaskNotFoundError(`タスクが見つかりません (ID: ${id})`);
    }

    const task = db.tasks[taskIndex];

    // バリデーション
    if (input.title !== undefined) {
      if (!input.title || input.title.trim().length === 0) {
        throw new ValidationError('タスクタイトルは必須です');
      }
      if (input.title.length > 200) {
        throw new ValidationError(
          'タスクタイトルは200文字以内で入力してください'
        );
      }
    }

    // 更新
    if (input.title !== undefined) {
      task.title = input.title.trim();
    }
    if (input.description !== undefined) {
      task.description = input.description?.trim() || undefined;
    }
    if (input.status !== undefined) {
      task.status = input.status;
    }
    if (input.branch !== undefined) {
      task.branch = input.branch;
    }

    task.updatedAt = new Date().toISOString();

    this.storageService.save(db);

    return task;
  }

  /**
   * タスクのステータスを変更
   * @param id タスクID
   * @param status 新しいステータス
   * @returns 更新されたタスク
   */
  changeStatus(id: number, status: TaskStatus): Task {
    return this.updateTask(id, { status });
  }

  /**
   * タスクを削除
   * @param id タスクID
   */
  deleteTask(id: number): void {
    const db = this.storageService.load();
    const taskIndex = db.tasks.findIndex((t) => t.id === id);

    if (taskIndex === -1) {
      throw new TaskNotFoundError(`タスクが見つかりません (ID: ${id})`);
    }

    db.tasks.splice(taskIndex, 1);
    this.storageService.save(db);
  }

  /**
   * タスクをアーカイブ
   * @param id タスクID
   * @returns アーカイブされたタスク
   */
  archiveTask(id: number): Task {
    return this.changeStatus(id, 'archived');
  }
}
