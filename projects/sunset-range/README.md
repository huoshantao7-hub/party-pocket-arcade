# 落日靶场 · Sunset Range

原创浏览器街机打靶小游戏：在落日色的移动靶场中瞄准、连击、换弹。Canvas 绘制画面，Web Audio 生成音效；无需账号或云服务。

## 启动

需要 Python 3.10 或更新版本，无需安装 Python 第三方包。使用现代桌面浏览器；Windows 双击 `启动游戏.cmd`，或在项目目录运行：

```shell
python -B launch.py
```

浏览器打开 `http://127.0.0.1:8786`。只启动后台服务、不打开网页：

```shell
python -B launch.py --no-browser
```

Windows PowerShell 也可运行 `./launch.ps1 -NoBrowser`。启动器优先采用 `TARGET_RANGE_PYTHON` 指定的解释器，其次使用项目或相邻项目已有虚拟环境，最后使用当前 Python；不会安装依赖或加载 AI 模型。调试时可用 `python -B server.py` 前台启动，按 Ctrl+C 停止。

## 模式

| 模式 | 规则 |
| --- | --- |
| 高分挑战 | 单人 60 秒，本机最佳成绩按武器分别保存；中途换枪的混合武器局不入榜 |
| 自由练习 | 不限时，自由熟悉瞄准与换弹 |
| 轮流对决 | 同一设备两人各 30 秒；锁定同一武器、使用同一随机种子，中场交接后开始第二轮 |

双人局是同机轮流玩。服务仅监听本机 `127.0.0.1`，不支持另一台手机通过局域网连接；触控操作用于打开游戏的触屏设备。

## 操作

| 输入 | 操作 |
| --- | --- |
| 鼠标移动 / 点击 | 瞄准 / 开火；手枪每次按下单发，步枪可按住连发 |
| 触屏轻点靶子 | 直接射击；拖动只移动准星 |
| 触屏“开火”按钮 | 向当前准星射击；步枪可长按 |
| 空格 | 开火 |
| R / “换弹”按钮 | 换弹 |
| 1 / 2 | 选择手枪 / 步枪；双人局比赛期间锁定武器 |
| P / Escape / “暂停”按钮 | 暂停或继续 |

页面提供音效开关和全屏按钮。切枪会清空新弹匣并完成一次换弹，不能通过来回换枪补弹。

| 武器 | 容量 | 射击间隔 | 换弹耗时 |
| --- | ---: | ---: | ---: |
| 星火手枪 | 8 发 | 0.25 秒 | 1.1 秒 |
| 流光连发器 | 18 发 | 0.10 秒 | 1.6 秒 |

## 得分

固定靶、横移靶与升降靶使用相同计分。靶心、中环、外环基础分分别是 100、60、30；金色靶翻倍。每 5 次连续命中增加 0.5 倍连击倍率，最高 3 倍。打空或放过到期靶会中断连击。空弹匣不会计入射击次数，换弹期间不能开火；正在出现或退出的靶不可命中。计时结束后展示本局得分、命中率与连击结果。

## 文件与检查

- `engine.js`：确定性靶子运动、命中判定、弹药、计分和计时。
- `app.js` / `renderer.js` / `sound.js`：输入与回合、画面、音效。
- `server.py`：Python 标准库本地静态服务，只公开 7 个客户端文件及健康检查。
- [制作提示词](制作提示词.md)：可用于重新制作同类小游戏的完整规格。

运行引擎测试需要 Node.js 20 或更新版本，无需 npm 安装：

```shell
node --test
python -B -m unittest discover -s tests -p test_server.py -v
```

测试覆盖逻辑与本地服务边界；不同浏览器、触控硬件的体验仍需在对应设备上检查。

## English quick start

Install Python 3.10+, then run `python -B launch.py` from this folder. Open `http://127.0.0.1:8786`. No pip or npm packages are needed to play. Node.js 20+ is only required for the JavaScript tests. The server is loopback-only; two-player mode is a same-device, turn-based match.