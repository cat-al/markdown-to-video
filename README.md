# markdown-to-video2

一个面向 **`Markdown -> 视频`** 的 skill 项目。

目标是参考 **superpowers 的多子 skill 组织方式**，把视频生成流程拆成多个可组合的阶段，每个子 skill 只负责一件事，最终串起从内容输入到视频输出的完整链路。

## 当前进度

目前已经落地三个基础模块：

1. `markdown-scriptwriter`：负责生成结构化的视频文案 Markdown
2. `markdown-to-html`：负责将标准 Markdown 转成 HTML 页面
3. `html-layout-review`：负责对生成后的 HTML 页面做固定 `1920x1080` 画布视觉验收，输出错位、越界、裁切、截断等问题清单

## 最终目标

希望逐步完成这样一条链路：

`内容/想法 -> Markdown 文案 -> HTML 视觉稿 -> HTML 视觉验收 -> 配音/字幕/时间轴 -> 视频输出`

## 设计方向

- 参考 superpowers 的多个子 skill 设计
- 每个阶段独立演进、可替换、可组合
- 先补齐链路，再持续完善各个模块

> 目前仓库还在早期阶段，后续会继续补充更多子模块与完整工作流。
