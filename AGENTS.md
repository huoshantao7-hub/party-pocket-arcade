# Game development in this repository

For a new game or a material gameplay change, use the installed `game-design-theory` Skill to define the playable decision loop and `game-feel` to tune feedback after the rules work. If either Skill is unavailable, follow [docs/game-development-workflow.md](docs/game-development-workflow.md). A cosmetic-only edit does not require redesigning the rules. For Canvas games, adapt the engine-neutral feedback ideas to JavaScript and Web Audio rather than pasting Godot or Unity example code.

Keep existing games' documented controls, modes, score logic, and honest AI/online claims intact. New games may be standalone projects or lobby entries according to the user's request. After a coherent change, run affected rule and server tests plus existing tests for shared behavior; confirm the changed interaction through actual play before delivery. Do not use pre-scripted visual results as proof of gameplay.
