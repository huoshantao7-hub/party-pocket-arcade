# Sources and scope

The Laya adapter uses the public API of [NandhaKishorM/laya](https://github.com/NandhaKishorM/laya), an Apache-2.0 project by Convai Innovations. Laya source and model weights are separate dependencies; they are not bundled here. Follow their respective license terms when obtaining or redistributing them.

The platform game engine, three level layouts, interface, Canvas-drawn characters and synthesized effects were created for this project. This is a Super Mario-style platforming exercise with original levels and artwork, not an official Nintendo product. No original Nintendo game files, sprites, sound recordings or level data are included.

Human controls, the deterministic rule-bot demonstration and real local Laya inference are separate modes. Only the Laya mode sends observations to the loaded local model. Its latency field is measured during each actual prediction. There is no Jev connection, synthetic cloud latency, or imported claim of model-vs-model performance.
