#!/usr/bin/env node

import { Command } from 'commander';
import { TaskService } from '../services/TaskService.js';
import { GitService } from '../services/GitService.js';
import { StorageService } from '../services/StorageService.js';
import { UIFormatter } from '../ui/UIFormatter.js';
import {
  TaskNotFoundError,
  ValidationError,
  GitError,
  StorageError,
  TaskStatus,
} from '../types/index.js';

/**
 * TaskCLI メインクラス
 */
export class TaskCLI {
  private program: Command;
  private taskService: TaskService;
  private gitService: GitService;
  private uiFormatter: UIFormatter;

  constructor() {
    this.program = new Command();
    const storageService = new StorageService();
    this.taskService = new TaskService(storageService);
    this.gitService = new GitService();
    this.uiFormatter = new UIFormatter();

    this.setupCommands();
  }

  /**
   * コマンドを設定
   */
  private setupCommands(): void {
    this.program
      .name('task')
      .description('Git統合型タスク管理CLIツール')
      .version('1.0.0');

    // add コマンド
    this.program
      .command('add <title>')
      .description('新しいタスクを作成')
      .action(async (title: string) => {
        await this.handleCommand(async () => {
          const task = this.taskService.createTask({ title });
          console.log(
            this.uiFormatter.formatSuccess(
              `タスクを作成しました (ID: ${task.id})`
            )
          );
        });
      });

    // list コマンド
    this.program
      .command('list')
      .description('タスク一覧を表示')
      .option('--all', 'アーカイブされたタスクも含めて表示')
      .option('--status <status>', 'ステータスでフィルタ', (value) => {
        const validStatuses: TaskStatus[] = [
          'open',
          'in_progress',
          'completed',
          'archived',
        ];
        if (!validStatuses.includes(value as TaskStatus)) {
          throw new ValidationError(
            `無効なステータス: ${value}。有効な値: ${validStatuses.join(', ')}`
          );
        }
        return value as TaskStatus;
      })
      .action(async (options) => {
        await this.handleCommand(async () => {
          const tasks = this.taskService.listTasks({
            includeArchived: options.all,
            status: options.status,
          });
          console.log(this.uiFormatter.formatTaskList(tasks));
        });
      });

    // show コマンド
    this.program
      .command('show <id>')
      .description('特定のタスクの詳細を表示')
      .action(async (id: string) => {
        await this.handleCommand(async () => {
          const taskId = this.parseTaskId(id);
          const task = this.taskService.getTask(taskId);
          console.log(this.uiFormatter.formatTaskDetail(task));
        });
      });

    // start コマンド
    this.program
      .command('start <id>')
      .description('タスクを開始（Gitブランチを作成/切り替え）')
      .action(async (id: string) => {
        await this.handleCommand(async () => {
          const taskId = this.parseTaskId(id);
          const task = this.taskService.getTask(taskId);

          // Gitリポジトリの確認
          if (!(await this.gitService.isGitRepository())) {
            throw new GitError(
              'Gitリポジトリが見つかりません。`git init`を実行してください'
            );
          }

          // ブランチ名を生成
          const branchName = this.gitService.generateBranchName(
            task.id,
            task.title
          );

          // ブランチが既に存在するかチェック
          if (await this.gitService.branchExists(branchName)) {
            await this.gitService.checkoutBranch(branchName);
          } else {
            await this.gitService.createAndCheckoutBranch(branchName);
          }

          // タスクのステータスを更新
          const updatedTask = this.taskService.updateTask(taskId, {
            status: 'in_progress',
            branch: branchName,
          });

          console.log(this.uiFormatter.formatSuccess(`タスクを開始しました`));
          console.log(`ブランチ: ${updatedTask.branch}`);
        });
      });

    // done コマンド
    this.program
      .command('done <id>')
      .description('タスクを完了状態にする')
      .action(async (id: string) => {
        await this.handleCommand(async () => {
          const taskId = this.parseTaskId(id);
          this.taskService.changeStatus(taskId, 'completed');
          console.log(
            this.uiFormatter.formatSuccess(
              `タスクを完了しました (ID: ${taskId})`
            )
          );
        });
      });

    // delete コマンド
    this.program
      .command('delete <id>')
      .description('タスクを削除')
      .action(async (id: string) => {
        await this.handleCommand(async () => {
          const taskId = this.parseTaskId(id);
          const task = this.taskService.getTask(taskId);

          // 確認プロンプト
          const confirmed = await this.confirmDeletion(task.title);
          if (!confirmed) {
            console.log('削除がキャンセルされました');
            return;
          }

          this.taskService.deleteTask(taskId);
          console.log(
            this.uiFormatter.formatSuccess(
              `タスクを削除しました (ID: ${taskId})`
            )
          );
        });
      });

    // archive コマンド
    this.program
      .command('archive <id>')
      .description('タスクをアーカイブ')
      .action(async (id: string) => {
        await this.handleCommand(async () => {
          const taskId = this.parseTaskId(id);
          this.taskService.changeStatus(taskId, 'archived');
          console.log(
            this.uiFormatter.formatSuccess(
              `タスクをアーカイブしました (ID: ${taskId})`
            )
          );
        });
      });
  }

  /**
   * CLI実行
   */
  async run(argv: string[] = process.argv): Promise<void> {
    await this.program.parseAsync(argv);
  }

  /**
   * コマンド実行のエラーハンドリング
   */
  private async handleCommand(command: () => Promise<void>): Promise<void> {
    try {
      await command();
    } catch (error) {
      if (
        error instanceof TaskNotFoundError ||
        error instanceof ValidationError ||
        error instanceof GitError ||
        error instanceof StorageError
      ) {
        console.error(this.uiFormatter.formatError(error.message));
        process.exit(1);
      } else {
        console.error(
          this.uiFormatter.formatError(
            `予期しないエラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        );
        process.exit(1);
      }
    }
  }

  /**
   * タスクIDをパース
   */
  private parseTaskId(idString: string): number {
    const id = parseInt(idString, 10);
    if (isNaN(id) || id <= 0) {
      throw new ValidationError('タスクIDは正の整数である必要があります');
    }
    return id;
  }

  /**
   * 削除確認プロンプト（簡易版）
   */
  private async confirmDeletion(title: string): Promise<boolean> {
    // 簡易実装：環境変数で制御可能
    if (process.env.TASKCLI_SKIP_CONFIRM === 'true') {
      return true;
    }

    console.log(`タスク "${title}" を削除しますか？ (y/N)`);

    // 標準入力から読み込み（同期的に）
    process.stdin.setEncoding('utf8');
    const input = await new Promise<string>((resolve) => {
      process.stdin.once('readable', () => {
        const chunk = process.stdin.read();
        resolve(chunk ? chunk.toString().trim() : '');
      });
    });

    return input.toLowerCase() === 'y' || input.toLowerCase() === 'yes';
  }
}

// CLIエントリーポイント
if (import.meta.url === `file://${process.argv[1]}`) {
  const cli = new TaskCLI();
  cli.run().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
