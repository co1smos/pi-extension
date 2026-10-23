# Timestamp 实现验证

2026-10-22 完成验证；2026-10-23 从暂停点恢复交付整理。Pi 1.3.0、Node 22.23.1、ICU 78.2、tzdata 2026a。以下结果来自隔离测试目录；没有 Pi 核心修改、外部 provider 请求或真实会话读取。

## 已执行

| 检查 | 结果 |
|---|---|
| `node --test timestamp/test/settings.test.ts` | 3 项通过：日期跨日、local/UTC/IANA、DST 重叠、午夜、三个格式、未知时间、无效配置、0600 保存与损坏配置保留。 |
| `timeout 160s python3 timestamp/test/terminal-smoke.py <fresh-proof-dir>` | 真实 `pi --tui-mode regular` 在 100×40 PTY 中运行；进程内合成 provider，独立 agent 目录与磁盘会话。PASS。 |
| 流式 | user/assistant 时间均在正文上方；第一段 token 出现而回复未结束时已存在两个头。 |
| `/reload` | 已有时间/消息保持对应，仍只有两个 metadata entries。 |
| 磁盘恢复 | 关闭第一进程后，新 Pi 进程读取相同 JSONL；消息及原始 epoch 不变。 |
| 时区/格式/开关 | Asia/Shanghai 日期转换和重绘、time24 重绘、off 隐藏、on 恢复通过。 |
| 无效时区 | Mars/Olympus 被拒绝，保留已保存的 Asia/Shanghai。 |
| 模型上下文 | 实际传给合成 provider 的内容不含 timestamp custom entries；消息正文保持原样。 |
| 恢复后检查 | 18 个工作文件与暂停快照哈希一致；实现、测试和配置未变，无需重跑已通过的终端验证。`node --check` 和 Python 无执行语法检查通过。 |

维护者保留通过轮次的完整 `results.json`、原始 ANSI 记录、逐阶段屏幕文字及合成会话。原始运行记录不作为公开运行时资源加入扩展；可用仓库内测试重新生成。

首轮测试驱动错误使用 `/exit` 而非 Pi 的 `/quit`，生成了额外合成消息，因此该轮失败。修正退出命令并增强持久化消息对比后，第二轮通过；两轮证据均保留。

## 图片来源

`images/timestamp-terminal-local.svg` 来自通过轮次的 `live-complete.txt` 第 4–12 行，`images/timestamp-terminal-shanghai.svg` 来自 `resume-complete.txt` 同一行范围。保持原文字、时间与空行，颜色按 Pi dark 重新绘制。图片标为实际 PTY 文字渲染；不声称像素截图或浏览器验证。合成 provider 的 assistant 时间固定为 `2026-10-22T18:32:09Z`，用于验证恢复时保留原 epoch。

图片生成脚本及源/图哈希清单由维护者保留，名为 `ship/render-terminal-images.py`、`ship/terminal-image-provenance.json`。早期 `images/timestamp-*.svg` 提案保留原 proposed 标签，不用于声称成品验证。

## 最终代码检查

完整阅读入口、格式/配置函数、测试及其与 Pi loader/renderer/reload 的调用关系。实现继续使用已验证源码；没有需要修改的实现问题。`off` 的记录语义和完整 reload 对其他已加载扩展的影响已在 README 明确。取消菜单的分支已读，未做交互菜单按键自动化；已验证直接命令路径。

未运行静态 TypeScript 类型检查（环境没有可用 TypeScript 编译器）；已验证实际 Pi loader 加载该 TypeScript 入口，Node 语法检查通过。fullscreen、不同宽度、tree/fork/compaction、queued/withdrawn、纯工具/空/图片/error/abort 和复制/导出尚未实际验证，不作兼容性承诺。非 TUI 有显式 mode guard，但没有 RPC/print 集成验证。

安装说明见 [README.md](README.md)。此验证记录描述隔离测试，不代表任意既有 Pi 进程已经加载扩展。
