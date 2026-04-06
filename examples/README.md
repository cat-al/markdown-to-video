## `examples` 目录说明

这里的示例文稿已经按用途拆成两类：

- `examples/demo/`：演示稿、实验稿、功能验证样例
- `examples/published/`：已经发布或接近发布状态的成型文稿

### `demo/`

适合放：

- 默认演示案例
- TTS / 布局 / 流程验证稿
- 还在试结构或试风格的草稿

当前文件：

- `demo.md`
- `qwen-local.md`
- `ai-brain-fry-demo.md`

### `published/`

适合放：

- 已经发布的视频文案
- 已经成型、可直接复用的精读稿
- 后续只做小修而不是大改结构的成稿

命名规则：

- 使用三位编号前缀：`001-xxx.md`
- 新稿按发布时间或入库顺序递增编号
- 已经对外发布后，尽量不要频繁改编号

当前文件：

- `001-llm-wiki-karpathy-zh.md`
- `002-sam-altman-technical-only-zh.md`

### 放置规则

新增文稿时，优先按下面规则放：

- 还在试格式、试节奏、试配音：放 `demo/`
- 已经发布或准备发布：放 `published/`

如果一个稿子从试验稿变成正式成稿，再从 `demo/` 移到 `published/`。
