---
description: 新機能を既存パターンに従って実装する
---

# 新機能の追加

引数: 機能名(例: `/add-feature ユーザープロフィール編集`)

## ステップ1: ステアリングディレクトリの作成

1. 現在の日付を取得(YYYYMMDDフォーマット)
2. `.steering/[日付]-[機能名]/`ディレクトリを作成
3. 以下の3つのファイルを作成:
   - `requirements.md`
   - `design.md`
   - `tasklist.md`

## ステップ2: プロジェクト理解

1. CLAUDE.mdを読む
2. `docs/`内の永続ドキュメントを確認

## ステップ3: 既存パターンの調査

Grepツールで類似機能を検索し、既存パターンを理解:

```bash
Grep('[機能に関連するキーワード]', 'src/')
```

## ステップ4: ステアリングファイルの作成

`requirements.md`、`design.md`、`tasklist.md`を作成後、ユーザーに確認を求める。

**ユーザーの承認を得てから次に進む**

## ステップ5: 実装

**development-guidelinesスキル**を使用してください

1. `tasklist.md`に従って実装
2. スキルのコーディング規約に従う
3. 既存パターンを遵守

## ステップ6: 実装検証(サブエージェント起動)

implementation-validatorサブエージェントを起動して品質検証。

Task toolを使用してimplementation-validatorサブエージェントを起動してください:
- subagent_type: "implementation-validator"
- description: "Implementation quality validation"
- prompt: "[実装したファイルのパス]の品質を検証してください。コーディング規約、エラーハンドリング、テスト可能性、既存パターンとの整合性を確認してください。"

## ステップ7: テスト

```bash
Bash('npm test')
Bash('npm run lint')
Bash('npm run typecheck')
```

## ステップ8: ドキュメント更新(必要に応じて)

基本設計に影響する場合、永続ドキュメントを更新。

## 完了条件

- 全タスク完了
- サブエージェント検証パス
- テスト全てパス
- リント・型エラーなし
