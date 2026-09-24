# 本地 Laya API

服务仅绑定 `127.0.0.1:8785`。游戏运行仅需要 Python 标准库；真实 Laya 模式额外需要已安装的 CPU AI 依赖、上游源码和本地完整模型。不会下载模型、读取凭据或调用云 API。

- `LAYA_SOURCE_PATH`：上游仓库根目录，内含 `laya/__init__.py`。
- `LAYA_MODEL_PATH`：完整本地模型目录，含 `model.safetensors`、`rl_agent_config.json`、`tokenizer/`、`encoder/`。
- `LAYA_PYTHON`：可选已安装 AI 依赖的 Python 可执行程序。

`launch.py` 可复用同级 `laya_asteroid_benchmark` 或本项目 `.local/laya` 的既有安装；没有找到时仍可启动手动/规则玩法，模型按钮明确报不可用。使用 `python -B launch.py --no-browser` 只启动服务。直接运行 `python -B server.py` 时需自己设置上述环境变量。

## 接口

`GET /api/ai/status` 返回 `state`（unloaded/loading/ready/error）、`available`（本地文件完整性）、`busy`、`model`、`device`、`error`、`loadMs`、`completedDecisions`。`available` 不代表已经加载或证明推理成功。

`POST /api/ai/load {}` 异步加载，返回202，随后轮询状态；已经ready时返回200。加载失败返回明确error，不切换规则机器人。

`POST /api/ai/decision {"observation":"English facts...","requestId":"run-1","timeoutMs":8000}`。也接受可序列化的对象作为观测。每次固定询问一个 typed choice；成功返回：

```json
{"action":"right","latencyMs":0,"confidence":0,"probabilities":{},"requestId":"run-1","model":"...","device":"cpu","provider":"laya_local","measured":true,"simulated":false}
```

上面的0仅用于说明字段结构，不是实测数字。动作枚举：`left`、`right`、`jump_left`、`jump_right`、`wait`。模型动作不经规则纠正。动作在下一条响应前持续；前端将跳跃意图编码为0.18秒按住/0.10秒松开的固定按键脉冲，**这个执行节奏不是模型预测的时序**。

`latencyMs` 是该次 `agent.predict` 的真实CPU调用时间；不包含HTTP往返或模型加载。confidence和probabilities直接来自模型，不等于必定安全或能通关。

只允许一个活动推理；并发请求返回429，完全不排队。未就绪503、超时504、取消409、推理异常500，错误响应不包含动作。timeoutMs限制100–15000ms。

`POST /api/ai/cancel {"requestId":"run-1"}` 标记动作过期并唤醒等待请求。CPU前向无法安全中断；运行中的那一次完成前仍busy，新请求继续429，迟到动作永远不返回。前端还应核对自己的回合/请求标识，防止重置或切换模式后应用旧动作。

静态服务只公开固定客户端源码与assets中的图像/字体；不公开Python、模型、环境、测试、QA、目录列表或任意路径。

## 验证

`python -B -m unittest discover -s tests -p test_server.py -v` 检查取消/超时/拒绝排队、静态文件边界与同源限制。里面的ControlledAgent仅为单元测试替身，从不用于游戏服务。

`python -B smoke_ai.py` 对运行中的本机服务发送三组事实观测，调用真实模型并写 `qa/real-laya-smoke.json`。这只能验证本地推理与真实耗时，不是通关证明，也不能据此声称通用游戏能力或毫秒级速度。

## 上游来源与本次验证

适配 API 来自 [NandhaKishorM/laya](https://github.com/NandhaKishorM/laya)，上游采用 Apache-2.0；本项目通过路径配置加载已有上游源码，不将其或模型权重重新打包。依赖各自保留原许可。

本次真实 CPU 验证记录见 `qa/real-laya-smoke.json` 和 `qa/actual-engine-laya.json`：冷加载约140.4秒，三组事实观测约2.10–2.36秒，真实引擎观测约3.50秒。四次均选择wait，这是实际结果；仅证明模型接入与真实推理，不证明其能通关。不要沿用其他设备的9ms等参考数字。

补充：一次有界提示词适配探针使用与旧benchmark相同的typed-choice结构，尝试2套短提示×3个事实状态，6次实际调用约62.8秒（含加载）。两套都持续选jump_left，低置信度，没有形成更合理策略，故未替换当前提示。详见 `qa/prompt-probe.json`。此模式适合观察真实模型决策，当前不应宣称能够自动玩好或通关。
