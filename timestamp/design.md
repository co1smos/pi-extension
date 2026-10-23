# Timestamp 设计与决定

实现位于 `index.ts` 与 `settings.ts`，使用 Pi 扩展 API 完成显示，不需要修改 Pi。默认格式与时区见下表，验证见 [validation.md](validation.md)。

## 已定行为

| 项目 | 实现 |
|---|---|
| 位置 | user/assistant 的 `message_start` 在原生正文之前创建 custom entry；原生 `Text` 显示，host 控制间距。 |
| 默认格式 | `YYYY-MM-DD HH:mm:ss UTC±HH:mm`。 |
| 默认时区 | Pi 主机本地；可配置 UTC 或 IANA 区域。 |
| 其他格式 | `time24`、`datetime12`；不引入任意 token 字符串解析。 |
| 时间来源 | 原始 `message.timestamp`；不改为渲染、首 token 或完成时间。 |
| 消息范围 | user/assistant；同一条消息的 thinking/多个文本块共用时间行；toolResult、系统通知、摘要不新增时间。 |
| 配置 | 扩展专用 `getAgentDir()/timestamp.json`，有效配置原子替换；命令调用 Pi reload 重绘保存的条目。 |
| 开关 | off 隐藏已有条目并停止新增，on 恢复已保存条目；不回填关闭期间或启用前消息。 |
| 模型上下文 | 时间条目不参与模型 context；正文和 epoch 保持原样。 |

assistant 时间可能在请求准备阶段已创建，因此对外叫“消息记录时间”。排队 user 保留 Pi 在入队时赋予的时间，真正进入 transcript 时才追加时间行；不按时间排序。既有无效/缺失时间显示 `Time unknown`，不猜测当前时间。

采用 Node 内建 Intl、Latin 数字、固定字段次序、h23 午夜，显示事件时点的 DST 偏移。取消菜单不改变配置，无效输入不覆盖原值。默认 enabled；入口有 TUI mode guard。主题使用 dim，左侧与正文对齐，不重复角色标签。

参考扩展的两个主要差异是提前到 message_start，以及不使用按角色/两秒窗口去重。参考实现的相对时间刷新、缓存 TTL/倒计时未加入。没有自建终端/Markdown renderer 或新增日期依赖。

## 已完成验证

真实 regular TUI 的合成流式、reload、磁盘恢复、时区与格式重绘、开关、无效时区保留、epoch 与模型上下文检查均通过。格式/配置单元测试 3 项通过。恢复工作时验证实现与已通过测试的快照哈希一致，没有重复执行同一终端测试。

## 明确边界

custom entry 是独立元数据行；Pi 控制空白、分支选择和会话压缩。fullscreen、其他宽度、tree/fork/compaction、纯工具/空/纯图片/error/abort、排队/撤回和复制/导出未实际验证。非 TUI 不新增条目，但未集成测试 RPC/print。静态 TypeScript 类型检查未运行。更改配置触发整个 Pi 扩展 reload 生命周期，不只是 timestamp。

这些是测试覆盖边界，不是已证实的失败。安装前旧历史回填没有被要求，不作为路线问题。早期“必须原生 header”结论已在 [反馈记录](feedback-receipt.md) 撤回。

## 评审记录

上方布局已被接受。保留 [review.html](review.html)、早期 proposed SVG 和源码研究供追溯。当前 README 两张新图来自实际 PTY 记录，明确标注为文字行重绘，不替换成像素截图声明。

安装方式见 [README.md](README.md)。早期设计材料保留为历史证据，不代表所有提案都经过完整终端验证。
