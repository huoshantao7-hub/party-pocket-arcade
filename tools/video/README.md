# 可选：生成游戏演示视频

这些工具直接运行仓库中的六款游戏引擎，用普通机器人输入驱动双方，录制连续游戏画面与真实结算。不是录制桌面，也没有预设赢家。固定种子 2026；真实对局结束后停留 2 秒。

**游戏本体仍为零依赖。** 只有视频生成需要 Node.js 20+、FFmpeg/ffprobe、Python 3 + NumPy，以及此目录的可选 Playwright 依赖。工具固定到已验证版本 Playwright 1.62.1；需要系统具有可显示中文的字体。

## 安装与运行

以下命令在 `tools/video/` 中执行。FFmpeg 安装后应能直接运行 `ffmpeg -version` 和 `ffprobe -version`。

```sh
npm install
npx playwright install chromium
python -m pip install numpy
node audit-games.mjs
python make_audio.py
node preview-server.mjs
```

保持预览服务运行，在第二个终端进入同一目录：

```sh
# 只验证捕捉一张真实游戏帧，不依赖 FFmpeg 或音频文件
node render.mjs --smoke --game=jelly

# 先生成低成本审片（960x648、8fps），完整观看后再录制成片
node render.mjs --draft
node render.mjs
python make-compilation.py
```

`--game=hockey` 等参数可只渲染某一款；`python make_audio.py --game hockey` 可只生成该款音乐和效果声。`python make-compilation.py --draft` 拼接六份低成本审片。合集从六个真实对局各取连续 15 秒，共 90 秒；赛车片段包含冲线结算。

## 路径与配置

- 所有生成物在 **`tools/video/output/`**，已被 `.gitignore` 排除；不会写入仓库根目录或视频工具源码旁边。
- `output/audit.json`：重复运行校验、实际步骤、结算、逐条声音事件。
- `output/audio/`：原创程序合成 WAV，48 kHz 双声道；没有外部歌曲、采样或配音。
- `output/renders/`：审片、六条成片、合集。成片默认 1600×1080 / 30fps / H.264 / AAC。
- `output/qa/`：捕捉图片、帧数、结果对应记录。
- **`VIDEO_PORT`**：预览端口，默认 `8781`；预览服务和渲染器需使用同一个值。仅监听本机 `127.0.0.1`。
- **`CHROME_PATH`**：可选现有 Chrome/Chromium 可执行文件路径；未设置时使用 Playwright 安装的 Chromium。使用已有浏览器时可跳过 `npx playwright install chromium`。

PowerShell 设置示例：`$env:VIDEO_PORT = '8781'`。macOS/Linux 设置示例：`export VIDEO_PORT=8781`。路径由脚本自身位置推导，项目可移动；环境变量中的个人路径不要提交到 Git。

## 验收边界

`audit-games.mjs` 会重复模拟每局、比对结束状态与声事件，并确认结算只发生一次、结束后冻结。渲染器会对照审计中的真实比分；音频工具会检查声道、峰值、响度与淡入淡出。

运行生成工具不会自动证明成片质量。正式分享前应完整观看低成本审片，检查开头、动作/得分、结束及合集切点；再用 `ffprobe` 核对分辨率/帧率/时长/音轨，用 `ffmpeg -v error -i <成片.mp4> -f null -` 完整解码。确认无意外黑帧、静止、截字或声音错位后再交付。

输出文件同名会被重新生成；需要保留的版本请先另存。没有自动上传、部署或发布操作。
