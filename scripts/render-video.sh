#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

usage() {
  cat <<'EOF'
用法:
  ./scripts/render-video.sh <input.md> [output.mp4]

示例:
  ./scripts/render-video.sh examples/llm-wiki-karpathy-zh.md
  ./scripts/render-video.sh examples/llm-wiki-karpathy-zh.md dist/llm-wiki-karpathy-zh.mp4
  npm run video:render -- examples/llm-wiki-karpathy-zh.md dist/llm-wiki-karpathy-zh.mp4

默认行为:
  - 默认使用 qwen-local 生成配音视频
  - 若未指定 output，则输出到 dist/<markdown文件名>.mp4
  - 若存在 .venv-qwen/bin/python，会优先使用它作为 Qwen Python 环境
  - 在 macOS 上默认使用 CPU + float32，优先保证 Qwen3-TTS 稳定出片

可通过环境变量覆盖默认值:
  TTS_PROVIDER=system|qwen-local
  QWEN_PYTHON=/path/to/python
  QWEN_TTS_DEVICE=cpu|mps
  QWEN_TTS_DTYPE=float32|float16|bfloat16
EOF
}

INPUT_PATH="${1:-}"
OUTPUT_PATH="${2:-}"

if [[ -z "$INPUT_PATH" ]]; then
  usage
  exit 1
fi

if [[ ! -f "$INPUT_PATH" ]]; then
  echo "找不到 Markdown 文件: $INPUT_PATH" >&2
  exit 1
fi

if [[ -z "$OUTPUT_PATH" ]]; then
  INPUT_NAME="$(basename "$INPUT_PATH")"
  OUTPUT_PATH="dist/${INPUT_NAME%.*}.mp4"
fi

if [[ -z "${QWEN_PYTHON:-}" && -x "$ROOT_DIR/.venv-qwen/bin/python" ]]; then
  export QWEN_PYTHON="$ROOT_DIR/.venv-qwen/bin/python"
fi

export TTS_PROVIDER="${TTS_PROVIDER:-qwen-local}"

if [[ "$OSTYPE" == darwin* ]]; then
  export QWEN_TTS_DEVICE="${QWEN_TTS_DEVICE:-cpu}"
  export QWEN_TTS_DTYPE="${QWEN_TTS_DTYPE:-float32}"
fi

if [[ "$TTS_PROVIDER" == "qwen-local" ]]; then
  echo "[render-video] 检查 Qwen3-TTS 环境..."
  npm run qwen:doctor
fi

echo "[render-video] 开始渲染"
echo "  input : $INPUT_PATH"
echo "  output: $OUTPUT_PATH"
echo "  tts   : $TTS_PROVIDER"
if [[ "$TTS_PROVIDER" == "qwen-local" ]]; then
  echo "  device: ${QWEN_TTS_DEVICE:-auto}"
  echo "  dtype : ${QWEN_TTS_DTYPE:-auto}"
fi

npm run render:md -- "$INPUT_PATH" "$OUTPUT_PATH"

echo "[render-video] 完成: $OUTPUT_PATH"
