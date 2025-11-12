import { describe, it, expect } from 'vitest';
import { StringUtils } from './StringUtils.js';

describe('StringUtils', () => {
  describe('sanitizeForBranchName', () => {
    it('英字の文字列を正しくサニタイズする', () => {
      // Given: 準備
      const input = 'Implement User Authentication';

      // When: 実行
      const result = StringUtils.sanitizeForBranchName(input);

      // Then: 検証
      expect(result).toBe('implement-user-authentication');
    });

    it('スペースをハイフンに変換する', () => {
      // Given: 準備
      const input = 'Add  multiple   spaces';

      // When: 実行
      const result = StringUtils.sanitizeForBranchName(input);

      // Then: 検証
      expect(result).toBe('add-multiple-spaces');
    });

    it('特殊文字を削除する', () => {
      // Given: 準備
      const input = 'Fix bug #123!@#$%^&*()';

      // When: 実行
      const result = StringUtils.sanitizeForBranchName(input);

      // Then: 検証
      expect(result).toBe('fix-bug-123');
    });

    it('連続するハイフンを1つにまとめる', () => {
      // Given: 準備
      const input = 'test---multiple---hyphens';

      // When: 実行
      const result = StringUtils.sanitizeForBranchName(input);

      // Then: 検証
      expect(result).toBe('test-multiple-hyphens');
    });

    it('先頭と末尾のハイフンを削除する', () => {
      // Given: 準備
      const input = '-start-and-end-hyphens-';

      // When: 実行
      const result = StringUtils.sanitizeForBranchName(input);

      // Then: 検証
      expect(result).toBe('start-and-end-hyphens');
    });

    it('50文字を超える場合は切り詰める', () => {
      // Given: 準備
      const input =
        'this is a very long task title that exceeds fifty characters';

      // When: 実行
      const result = StringUtils.sanitizeForBranchName(input);

      // Then: 検証
      expect(result).toBe('this-is-a-very-long-task-title-that-exceeds-fifty');
      expect(result.length).toBeLessThanOrEqual(50);
    });

    it('日本語文字は削除され、空文字列の場合はuntitledを返す', () => {
      // Given: 準備
      const input = 'ユーザー認証機能の実装';

      // When: 実行
      const result = StringUtils.sanitizeForBranchName(input);

      // Then: 検証
      expect(result).toBe('untitled');
    });

    it('空文字列の場合はuntitledを返す', () => {
      // Given: 準備
      const input = '';

      // When: 実行
      const result = StringUtils.sanitizeForBranchName(input);

      // Then: 検証
      expect(result).toBe('untitled');
    });

    it('空白のみの場合はuntitledを返す', () => {
      // Given: 準備
      const input = '   ';

      // When: 実行
      const result = StringUtils.sanitizeForBranchName(input);

      // Then: 検証
      expect(result).toBe('untitled');
    });

    it('サニタイズ後に空文字列になる場合はuntitledを返す', () => {
      // Given: 準備
      const input = '!@#$%^&*()';

      // When: 実行
      const result = StringUtils.sanitizeForBranchName(input);

      // Then: 検証
      expect(result).toBe('untitled');
    });
  });
});
