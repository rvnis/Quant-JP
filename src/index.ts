#!/usr/bin/env node

/**
 * TaskCLI メインエントリーポイント
 */
import { TaskCLI } from './cli/index.js';

// CLIアプリケーションを実行
const cli = new TaskCLI();
cli.run().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
