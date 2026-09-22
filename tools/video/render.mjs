import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const output = path.join(root, 'output');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const draft = process.argv.includes('--draft');
const smoke = process.argv.includes('--smoke');
const selected = process.argv.filter(value => value.startsWith('--game=')).map(value => value.slice(7));
const fps = draft ? 8 : 30;
const audit = JSON.parse(fs.readFileSync(path.join(output, 'audit.json'), 'utf8'));
for (const id of selected) if (!audit.games.some(game => game.id === id)) throw Error(`Unknown game: ${id}`);
for (const folder of ['renders', 'qa']) fs.mkdirSync(path.join(output, folder), { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const page = await browser.newPage({ viewport: { width: 1600, height: 1080 } });
const errors = [], reports = [];
page.on('pageerror', error => errors.push(error.message));
let activeEncoder = null;
try {
  await page.goto(`http://127.0.0.1:${Number(process.env.VIDEO_PORT || 8781)}/`);
  await page.waitForFunction(() => window.film?.ready);
  await page.evaluate(() => document.fonts.ready);
  for (const game of audit.games) {
    if (selected.length && !selected.includes(game.id)) continue;
    if (smoke) {
      const base64 = await page.evaluate(id => window.film.capture(id, 6, 1, .94), game.id);
      const frame = path.join(output, 'qa', `${game.id}-smoke.jpg`);
      fs.writeFileSync(frame, Buffer.from(base64, 'base64'));
      const state = await page.evaluate(() => window.film.state);
      if (state.players.length !== 2 || !state.players.every(player => Number.isFinite(player.score))) throw Error(`Invalid smoke state: ${game.id}`);
      reports.push({ id: game.id, frame: `qa/${game.id}-smoke.jpg`, time: 6, scores: state.players.map(player => player.score) });
      console.log(`SMOKE ${game.id}: 1600x1080 frame captured`);
      continue;
    }
    const name = `${game.id}-${draft ? 'draft' : 'final'}`;
    const destination = path.join(output, 'renders', `${name}.mp4`);
    const count = Math.round(game.videoDuration * fps);
    const audio = path.join(output, 'audio', `${game.id}.wav`);
    if (!fs.existsSync(audio)) throw Error(`Missing audio: run python make_audio.py --game ${game.id}`);
    const args = ['-y', '-hide_banner', '-v', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-vcodec', 'mjpeg', '-i', 'pipe:0', '-i', audio, '-t', String(count / fps), '-c:v', 'libx264', '-threads', '3', '-preset', draft ? 'veryfast' : 'medium', '-crf', draft ? '24' : '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', destination];
    const encoder = activeEncoder = spawn('ffmpeg', args, { stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true });
    let stderr = '';
    encoder.stderr.on('data', chunk => { stderr += chunk; });
    encoder.stdin.on('error', () => {});
    const finished = new Promise((resolve, reject) => { encoder.once('error', reject); encoder.once('exit', code => code === 0 ? resolve() : reject(Error(stderr || `FFmpeg exited ${code}`))); });
    // Attach immediately so a missing executable is reported without an unhandled rejection.
    finished.catch(() => {});
    const started = Date.now();
    for (let i = 0; i < count; i++) {
      if (encoder.exitCode !== null || encoder.stdin.destroyed) { await finished; throw Error('Encoder stopped before capture finished'); }
      const base64 = await page.evaluate(({ id, t, scale, quality }) => window.film.capture(id, t, scale, quality), { id: game.id, t: i / fps, scale: draft ? .6 : 1, quality: draft ? .86 : .94 });
      if (!encoder.stdin.write(Buffer.from(base64, 'base64'))) await Promise.race([once(encoder.stdin, 'drain'), finished.then(() => { throw Error('Encoder closed while capturing'); })]);
      if (i % (fps * 15) === 0) console.log(`${name}: ${i}/${count}`);
    }
    encoder.stdin.end(); await finished; activeEncoder = null;
    const state = await page.evaluate(() => window.film.state);
    if (!state.ended || JSON.stringify(state.players.map(player => player.score)) !== JSON.stringify(game.finalState.players.map(player => player.score))) throw Error(`Outcome differs from audit: ${game.id}`);
    reports.push({ id: game.id, path: `renders/${name}.mp4`, fps, frames: count, duration: count / fps, actualResult: state.result, scores: state.players.map(player => player.score), elapsedSeconds: (Date.now() - started) / 1000 });
    console.log(`DONE ${name}`);
  }
  if (errors.length) throw Error(errors.join('\n'));
  fs.writeFileSync(path.join(output, 'qa', smoke ? 'smoke.json' : draft ? 'draft-render.json' : 'final-render.json'), JSON.stringify({ errors, games: reports }, null, 2));
} finally {
  if (activeEncoder && activeEncoder.exitCode === null) activeEncoder.kill();
  await browser.close();
}
