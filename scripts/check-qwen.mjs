#!/usr/bin/env node

import {checkQwenLocalEnvironment} from './lib/markdown-video-pipeline.mjs';

const result = checkQwenLocalEnvironment();

if (result.ok) {
  console.log('Qwen3-TTS 本地环境检查通过');
  console.log(JSON.stringify(result.details, null, 2));
  process.exit(0);
}

console.error('Qwen3-TTS 本地环境尚未就绪');
if (result.details) {
  console.error(JSON.stringify(result.details, null, 2));
} else {
  console.error(result.stderr || result.stdout || '未知错误');
}
if (process.platform === 'win32') {
  console.error('\n建议先执行:');
  console.error('1. 双击 install-win.bat 一键安装');
  console.error('或手动执行:');
  console.error('1. python -m venv .venv-qwen');
  console.error('2. .venv-qwen\\Scripts\\activate');
  console.error('3. pip install -r requirements-qwen.txt');
  console.error('4. set QWEN_PYTHON=%cd%\\.venv-qwen\\Scripts\\python.exe && npm run qwen:doctor');
} else {
  console.error('\n建议先执行:');
  console.error('1. python3 -m venv .venv-qwen');
  console.error('2. source .venv-qwen/bin/activate');
  console.error('3. pip install -r requirements-qwen.txt');
  console.error('4. QWEN_PYTHON=$(pwd)/.venv-qwen/bin/python npm run qwen:doctor');
}
process.exit(1);
