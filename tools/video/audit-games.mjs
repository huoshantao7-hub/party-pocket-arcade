import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const project = path.join(scriptRoot, 'output');
const sourceRoot = path.resolve(scriptRoot, '../..');
const ids = ['jelly', 'kitchen', 'bubble', 'magnet', 'hockey', 'racer'];
const seed = 2026, simulationFps = 60, videoFps = 30, resultHoldSeconds = 2;
const blank = () => ({ x: 0, y: 0, action: false, alt: false, pressed: false, altPressed: false });
const cleanNumber = n => Math.round(n * 1e9) / 1e9;

function simulate(createGame, id, keepSamples) {
  let step = 0, endCallCount = 0, endPayload = null;
  const soundEvents = [], samples = [], previous = [blank(), blank()];
  const game = createGame({
    width: 960, height: 600, seed,
    sound: type => soundEvents.push({ index: soundEvents.length, step, time: cleanNumber(step / simulationFps), type: String(type) }),
    end: value => { endCallCount++; endPayload = structuredClone(value); }
  });
  const snapshot = reason => samples.push({ step, time: cleanNumber(step / simulationFps), reason, state: structuredClone(game.getState()) });
  if (keepSamples) snapshot('start');
  let checkedSounds = 0;
  while (!game.getState().ended && step < simulationFps * 118) {
    const inputs = [0, 1].map(index => {
      const input = { ...blank(), ...game.bot(index) };
      // Identical edge normalization to the real arcade host (play.js).
      input.pressed = !!input.action && !previous[index].action;
      input.altPressed = !!input.alt && !previous[index].alt;
      previous[index] = { ...input };
      return input;
    });
    step++;
    game.update(1 / simulationFps, inputs);
    const newEvents = soundEvents.slice(checkedSounds);
    const important = newEvents.some(event => /^(score|goal|win|lap)$/.test(event.type));
    checkedSounds = soundEvents.length;
    if (keepSamples && (step % simulationFps === 0 || important || game.getState().ended)) snapshot(game.getState().ended ? 'end' : important ? 'score-event' : 'second');
  }
  const finalState = structuredClone(game.getState());
  assert.ok(finalState.ended, `${id}: must finish before video limit`);
  assert.equal(endCallCount, 1, `${id}: engine must call end exactly once`);
  for (let i = 0; i < 120; i++) game.update(1 / simulationFps, [blank(), blank()]);
  assert.deepEqual(game.getState(), finalState, `${id}: ended state must remain frozen`);
  assert.equal(endCallCount, 1, `${id}: frozen updates must not call end again`);
  return { simulationSteps: step, actualEndSeconds: step / simulationFps, endCallCount, endPayload, finalState, soundEvents, samples };
}

await fs.mkdir(path.join(project, 'audio'), { recursive: true });
const games = [];
for (const id of ids) {
  const sourcePath = path.join(sourceRoot, 'games', `${id}.js`);
  const sourceHash = createHash('sha256').update(await fs.readFile(sourcePath)).digest('hex');
  const { createGame, meta } = await import(pathToFileURL(sourcePath).href);
  const first = simulate(createGame, id, true);
  const second = simulate(createGame, id, false);
  assert.deepEqual(first.finalState, second.finalState, `${id}: final state must repeat exactly`);
  assert.deepEqual(first.soundEvents, second.soundEvents, `${id}: sound event timing must repeat exactly`);
  assert.equal(first.simulationSteps, second.simulationSteps);
  const videoFrames = Math.ceil(first.simulationSteps / (simulationFps / videoFps)) + resultHoldSeconds * videoFps;
  const videoDuration = videoFrames / videoFps;
  assert.ok(videoDuration >= 30 && videoDuration <= 120, `${id}: invalid video duration ${videoDuration}`);
  const game = { id, title: meta.title, seed, nativeSize: [960, 600], source: { file: `../../../games/${id}.js`, sha256: sourceHash }, ...first, videoFrames, videoDuration };
  games.push(game);
  console.log(`${id}: ${first.actualEndSeconds.toFixed(6)}s game + rounded-frame/2s hold = ${videoDuration.toFixed(6)}s video; score ${first.finalState.players.map(p => p.score).join(' / ')}; ${first.soundEvents.length} sounds`);
}

const audit = {
  schema: 'party-pocket-video-audit/1',
  seed, simulationFps, videoFps, resultHoldSeconds,
  inputMode: 'Both players are explicitly labelled rule-based bot showcase; real game input, game logic and scoring.',
  soundTiming: 'soundEvents.time is the end of the actual 1/60-second update that invoked the engine sound callback; no fabricated scoring cues.',
  frameTiming: 'At 30 fps, frame index f captures time f/30 after floor(f*2) fixed updates. Updates after the actual end keep the result frozen. Event timing is accurate within one video frame.',
  soundtrackSource: 'Original locally synthesized instrumental music and effects; no external recordings, samples, songs or voices.',
  verified: { seededReplay: true, endExactlyOnce: true, stateFrozenAfterEnd: true, durationBetween30And120: true },
  games
};
await fs.writeFile(path.join(project, 'audit.json'), JSON.stringify(audit, null, 2) + '\n', 'utf8');
