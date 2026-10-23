# Pi extensions

Pi 扩展集合。当前包含 [Timestamp](timestamp/README.md)：在每条 user 和 assistant 消息上方显示时间，支持主机本地或指定 IANA 时区及三种格式。

![Timestamp 的实际合成终端输出](timestamp/images/timestamp-terminal-local.svg)

图片来自实际 Pi regular TUI 的合成对话 PTY 文字记录，按终端颜色重绘为 SVG，并非像素截图。验证环境为 Pi 1.3.0 / Node 22.23.1。

## 安装

```sh
pi install git:github.com/co1smos/pi-extension
```

已打开的 Pi 输入 `/reload` 重新加载扩展；输入 `/timestamp` 配置时区、格式或开关。

也可从本地克隆目录安装 Timestamp：

```sh
pi install /absolute/path/to/pi-extension/timestamp
```

详见 [Timestamp 用法、图片与验证边界](timestamp/README.md)。不需要构建步骤或新增日期依赖。

## 许可

[MIT](LICENSE)，Copyright (c) 2026 co1smos。参考项目的原始版权与 MIT 条款保留于 [timestamp/NOTICE.md](timestamp/NOTICE.md)。
