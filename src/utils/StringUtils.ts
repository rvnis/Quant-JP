/**
 * 文字列操作ユーティリティ
 */
export class StringUtils {
  /**
   * タスクタイトルをGitブランチ名に適した形式にサニタイズする
   * @param text サニタイズ対象の文字列
   * @returns サニタイズ済み文字列（最大50文字）
   */
  static sanitizeForBranchName(text: string): string {
    if (!text || text.trim().length === 0) {
      return 'untitled';
    }

    const sanitized = text
      .toLowerCase() // 小文字化
      .replace(/\s+/g, '-') // 連続する空白 → ハイフン
      .replace(/[^a-z0-9-]/g, '') // 英数字とハイフン以外を削除
      .replace(/-+/g, '-') // 連続ハイフン → 1つ
      .replace(/^-+|-+$/g, '') // 先頭と末尾のハイフンを削除
      .substring(0, 50) // 最大50文字
      .replace(/^-+|-+$/g, ''); // 切り詰め後に再度末尾ハイフンを削除

    return sanitized || 'untitled'; // 空文字列の場合はデフォルト値
  }
}
