# Engine contract

Each game is a pure ES module at games/<id>.js, without DOM or external dependencies. This document describes the shared engine API. Export `meta` and `createGame(options)`.

meta = { id, title, subtitle, genre, accent, duration, rules: [3 short Chinese strings], actionLabel, altLabel }. Native canvas size 960 × 600; playable region all of canvas, scoreboard is outside. Artwork original, distinct personalities, dynamic animations, polished shadows, readable lanes and hazards. No external assets/fonts/network.

createGame({width=960,height=600,seed=2026,sound=(type)=>{},end=(result)=>{}}) returns:
- update(dt, inputs): dt seconds, clamped <= 1/30. inputs array of 2 objects `{x,y,action,alt,pressed,altPressed}`. x/y in [-1,1]; `pressed`/`altPressed` one-frame rising edges. Movement with x/y, action and alt optional. Each player equally capable. Mechanics must work with phone digital d-pad, not mouse-only.
- draw(ctx): self-contained Canvas2D draw, save/restore as appropriate.
- bot(playerIndex): returns a complete input object for single player or attract-mode. Host converts action rising edge. Bots should play competently and show mechanics.
- getState(): serializable object `{timeLeft,players:[{name,score,detail},{name,score,detail}],status,ended,result,...debugPublic}`. Name P1/P2 with Chinese roles allowed. result readable Chinese at round end. All scores are actual game logic, no pre-scripted winners.

Each engine owns elapsed clock, duration, game end; after end update is frozen and calls end exactly once. Can end early on victory. Reset by createGame again, same seed deterministic. A match ideally 45–90 seconds. Bots cannot cheat; use inputs. No fake multiplayer: both input objects must control independent players with collision/interaction.

Add meaningful unit tests to `tests/<id>.test.mjs` using node:test/assert. Focus deterministic seed, start/movement and actual game rules (collision/scoring/end/reset); add narrowly scoped debug tools if necessary, mark test-only clearly. Tests may also verify bot runs terminate and scores are finite, but cannot be only smoke tests.

The shared host provides keyboard P1 WASD + F/G, P2 arrows + K/L, touch controls, single player / same-screen 2P / automatic showcase, pause/reset/sound/fullscreen, local-network controller joining. Keep game rules inside the engine and shared UI behavior inside the host. Document each game in `docs/<id>.md` with game controls/mechanics and an accurate short Chinese tweet. No claims of online public service or actual player popularity; use inspiration from familiar genre.
