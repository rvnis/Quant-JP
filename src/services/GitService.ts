import { simpleGit, SimpleGit } from 'simple-git';
import { GitError } from '../types/index.js';
import { StringUtils } from '../utils/StringUtils.js';

/**
 * Git操作サービス
 * Gitブランチの作成・切り替えとブランチ名生成を担当
 */
export class GitService {
  private git: SimpleGit;

  constructor(baseDir: string = process.cwd()) {
    this.git = simpleGit(baseDir);
  }

  /**
   * Gitリポジトリが存在するかチェック
   * @returns boolean
   */
  async isGitRepository(): Promise<boolean> {
    try {
      await this.git.status();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * タスクIDとタイトルからブランチ名を生成
   * @param taskId タスクID
   * @param taskTitle タスクタイトル
   * @returns ブランチ名
   */
  generateBranchName(taskId: number, taskTitle: string): string {
    const sanitizedTitle = StringUtils.sanitizeForBranchName(taskTitle);
    return `feature/task-${taskId}-${sanitizedTitle}`;
  }

  /**
   * ブランチが存在するかチェック
   * @param branchName ブランチ名
   * @returns boolean
   */
  async branchExists(branchName: string): Promise<boolean> {
    try {
      const branches = await this.git.branchLocal();
      return branches.all.includes(branchName);
    } catch (error) {
      throw new GitError(
        `ブランチの確認に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * ブランチを作成して切り替え
   * @param branchName ブランチ名
   */
  async createAndCheckoutBranch(branchName: string): Promise<void> {
    try {
      await this.git.checkoutBranch(branchName, 'HEAD');
    } catch (error) {
      throw new GitError(
        `ブランチの作成に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * 既存のブランチに切り替え
   * @param branchName ブランチ名
   */
  async checkoutBranch(branchName: string): Promise<void> {
    try {
      await this.git.checkout(branchName);
    } catch (error) {
      throw new GitError(
        `ブランチの切り替えに失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
