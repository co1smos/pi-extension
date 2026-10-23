# Timestamp 设计决定

- 时间显示在每条 user 和 assistant 消息正文上方。
- 默认完整日期、秒和数字 UTC 偏移；默认 Pi 主机本地时区，允许指定 IANA 时区。
- 提供 `datetime24`、`time24`、`datetime12` 三种格式。
- 使用 Pi 支持的 custom entry，在 `message_start` 插入；不修改 Pi 核心，不替换原生消息组件，不把时间加入模型提示词。
- 使用已有 `message.timestamp`，不推断首 token 或回复完成时间。未要求回填安装前历史。
- 早期“必须嵌入原生 header”判断已通过参考源码和隔离验证纠正。
- 上方布局已被接受；实际终端验证和覆盖边界见 [validation.md](validation.md)。

原始私有设计讨论由维护者保留；此文件仅记录影响产品行为的决定。
