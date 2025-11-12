import Table from 'cli-table3';
import chalk from 'chalk';
import { Task, TaskStatus } from '../types/index.js';

/**
 * UI表示整形サービス
 * タスクデータの表示フォーマットを担当
 */
export class UIFormatter {
  /**
   * タスク一覧をテーブル形式で整形
   * @param tasks タスク一覧
   * @returns 整形されたテーブル文字列
   */
  formatTaskList(tasks: Task[]): string {
    if (tasks.length === 0) {
      return this.formatError('タスクがありません');
    }

    const table = new Table({
      head: ['ID', 'Status', 'Title', 'Branch'],
      colWidths: [6, 15, 40, 35],
      wordWrap: true,
    });

    for (const task of tasks) {
      table.push([
        task.id.toString(),
        this.formatStatus(task.status),
        this.truncateString(task.title, 37),
        task.branch || '-',
      ]);
    }

    return table.toString();
  }

  /**
   * 単一タスクの詳細を整形
   * @param task タスク
   * @returns 整形された詳細文字列
   */
  formatTaskDetail(task: Task): string {
    const lines = [
      chalk.bold(`Task #${task.id}`),
      '━'.repeat(40),
      `Title:       ${task.title}`,
      `Status:      ${this.formatStatus(task.status)}`,
      `Branch:      ${task.branch || '-'}`,
      `Created:     ${this.formatDate(task.createdAt)}`,
      `Updated:     ${this.formatDate(task.updatedAt)}`,
    ];

    if (task.description) {
      lines.push('');
      lines.push('Description:');
      lines.push(task.description);
    }

    lines.push('━'.repeat(40));

    return lines.join('\n');
  }

  /**
   * 成功メッセージを整形
   * @param message メッセージ
   * @returns 整形されたメッセージ
   */
  formatSuccess(message: string): string {
    return chalk.green('✓ ' + message);
  }

  /**
   * エラーメッセージを整形
   * @param message メッセージ
   * @returns 整形されたメッセージ
   */
  formatError(message: string): string {
    return chalk.red('✗ ' + message);
  }

  /**
   * ステータスを色付きで整形
   * @param status ステータス
   * @returns 色付きステータス文字列
   */
  formatStatus(status: TaskStatus): string {
    switch (status) {
      case 'open':
        return chalk.white(status);
      case 'in_progress':
        return chalk.yellow(status);
      case 'completed':
        return chalk.green(status);
      case 'archived':
        return chalk.gray(status);
      default:
        return status;
    }
  }

  /**
   * 日時をフォーマット
   * @param isoString ISO 8601形式の日時文字列
   * @returns フォーマットされた日時
   */
  private formatDate(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  /**
   * 文字列を指定した長さで切り詰める
   * @param text 対象文字列
   * @param maxLength 最大長
   * @returns 切り詰められた文字列
   */
  private truncateString(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - 3) + '...';
  }
}
