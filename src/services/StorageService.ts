import * as fs from 'node:fs';
import * as path from 'node:path';
import { TaskDatabase, StorageError } from '../types/index.js';

/**
 * データ永続化サービス
 * JSONファイルへのタスクデータの読み書きを担当
 */
export class StorageService {
  private readonly dataDir: string;
  private readonly filePath: string;
  private readonly backupPath: string;

  constructor(baseDir: string = process.cwd()) {
    this.dataDir = path.join(baseDir, '.task');
    this.filePath = path.join(this.dataDir, 'tasks.json');
    this.backupPath = path.join(this.dataDir, 'tasks.json.bak');
  }

  /**
   * データディレクトリを初期化
   */
  initialize(): void {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { mode: 0o700 });
      }
    } catch (error) {
      throw new StorageError(
        `データディレクトリの作成に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * タスクデータベースを読み込む
   * @returns TaskDatabase
   */
  load(): TaskDatabase {
    try {
      if (!this.exists()) {
        // ファイルが存在しない場合は初期データを返す
        return {
          tasks: [],
          nextId: 1,
        };
      }

      const data = fs.readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(data) as TaskDatabase;

      // データの整合性をチェック
      if (!Array.isArray(parsed.tasks) || typeof parsed.nextId !== 'number') {
        throw new StorageError('データファイルの形式が不正です');
      }

      return parsed;
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      if (error instanceof SyntaxError) {
        throw new StorageError(
          'データファイルが破損しています。バックアップから復元してください (.task/tasks.json.bak)'
        );
      }
      throw new StorageError(
        `データの読み込みに失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * タスクデータベースを保存
   * @param db 保存するデータベース
   */
  save(db: TaskDatabase): void {
    try {
      this.initialize();

      // 既存ファイルをバックアップ
      if (this.exists()) {
        this.backup();
      }

      // 新しいデータを保存
      const data = JSON.stringify(db, null, 2);
      fs.writeFileSync(this.filePath, data, { mode: 0o600 });
    } catch (error) {
      throw new StorageError(
        `データの保存に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * データファイルが存在するかチェック
   * @returns boolean
   */
  exists(): boolean {
    return fs.existsSync(this.filePath);
  }

  /**
   * 現在のデータファイルをバックアップ
   */
  backup(): void {
    try {
      if (this.exists()) {
        fs.copyFileSync(this.filePath, this.backupPath);
      }
    } catch (error) {
      throw new StorageError(
        `バックアップの作成に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
