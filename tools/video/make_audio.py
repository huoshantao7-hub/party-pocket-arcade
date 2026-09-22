"""Original instrumental beds and event-accurate game effects. No sampled media.

Usage: python make_audio.py [--game kitchen]
The only content input is audit.json. Audio is PCM16 / 48 kHz / stereo.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import wave

import numpy as np

ROOT = Path(__file__).resolve().parent / 'output'
SR = 48_000
TARGET_RMS_DBFS = -21.0
CONFIG = {
    "jelly":   dict(bpm=116, root=48, scale=[0, 2, 4, 7, 9], tone="wood", energy=.86),
    "kitchen": dict(bpm=100, root=53, scale=[0, 2, 4, 7, 9], tone="warm", energy=.68),
    "bubble":  dict(bpm=126, root=50, scale=[0, 3, 5, 7, 10], tone="bubble", energy=.85),
    "magnet":  dict(bpm=96,  root=56, scale=[0, 2, 4, 7, 9], tone="glass", energy=.66),
    "hockey":  dict(bpm=122, root=53, scale=[0, 3, 5, 7, 10], tone="neon", energy=.91),
    "racer":   dict(bpm=132, root=48, scale=[0, 3, 5, 7, 10], tone="drive", energy=.98),
}


def frequency(midi: float) -> float:
    return 440.0 * 2 ** ((midi - 69) / 12)


def time_axis(duration: float) -> np.ndarray:
    return np.arange(max(1, round(duration * SR)), dtype=np.float32) / SR


def envelope(t: np.ndarray, decay: float, attack: float = .006) -> np.ndarray:
    return (1 - np.exp(-t / attack)) * np.exp(-t / decay)


def pluck(midi: float, duration: float, tone: str = "warm") -> np.ndarray:
    t = time_axis(duration)
    f = frequency(midi)
    detune = .35 * np.sin(2 * np.pi * .7 * t)
    base = np.sin(2 * np.pi * f * t + detune * .015)
    if tone in ("glass", "bubble"):
        a = base + .24 * np.sin(2 * np.pi * f * 2.002 * t) * np.exp(-t * 7)
        a += .11 * np.sin(2 * np.pi * f * 3.99 * t) * np.exp(-t * 14)
    elif tone in ("neon", "drive"):
        a = base + .22 * np.sin(2 * np.pi * f * 2 * t) + .12 * np.sin(2 * np.pi * f * 3 * t) * np.exp(-t * 7)
    elif tone == "wood":
        a = base + .28 * np.sin(2 * np.pi * f * 2.75 * t) * np.exp(-t * 22)
    else:
        a = base + .18 * np.sin(2 * np.pi * f * 2 * t) * np.exp(-t * 5)
    a *= envelope(t, max(.12, duration * .34))
    a *= np.minimum(1, (duration - t) * 140)
    return a.astype(np.float32)


def add(buffer: np.ndarray, signal: np.ndarray, at: float, gain: float, pan: float = 0) -> None:
    first = max(0, round(at * SR))
    length = min(len(signal), len(buffer) - first)
    if length <= 0:
        return
    angle = (max(-1, min(1, pan)) + 1) * math.pi / 4
    buffer[first:first + length, 0] += signal[:length] * (gain * math.cos(angle))
    buffer[first:first + length, 1] += signal[:length] * (gain * math.sin(angle))


def kick() -> np.ndarray:
    t = time_axis(.23)
    phase = 2 * np.pi * (49 * t + 12 * (1 - np.exp(-t * 34)))
    return (np.sin(phase) * np.exp(-t * 23) * (1 - np.exp(-t * 800))).astype(np.float32)


def noise_click(rng: np.random.Generator, duration: float, decay: float) -> np.ndarray:
    t = time_axis(duration)
    noise = rng.normal(0, .35, len(t)).astype(np.float32)
    # A simple high-pass difference gives a soft closed-hat/click texture.
    filtered = noise - np.roll(noise, 1) * .72
    return filtered * envelope(t, decay, .0008)


def chirp(start: float, end: float, duration: float, decay: float = .065) -> np.ndarray:
    t = time_axis(duration)
    sweep = np.log(end / start) / duration if end != start else 0
    phase = 2 * np.pi * start * (np.expm1(sweep * t) / sweep if sweep else t)
    return (np.sin(phase) * envelope(t, decay, .002)).astype(np.float32)


def render_bed(n: int, duration: float, actual_end: float, cfg: dict, rng: np.random.Generator) -> np.ndarray:
    bed = np.zeros((n, 2), dtype=np.float32)
    beat = 60 / cfg["bpm"]
    bars = math.ceil(duration / (beat * 4))
    # Newly composed four-bar harmonic route with an eight-bar melodic answer.
    harmonic_steps = [0, 7, 9 if cfg["scale"][1] == 2 else 8, 5]
    motif = [0, 2, 1, 4, 3, 2, 0, 1, 2, 4, 3, 1, 0, 2, 4, 1]
    drum = kick()
    for bar in range(bars):
        at = bar * beat * 4
        if at > actual_end:
            break
        harmony = harmonic_steps[bar % 4]
        chord_root = cfg["root"] + harmony
        for offset, velocity in [(0, .10), (1.5, .068), (2.5, .072)]:
            add(bed, pluck(chord_root - 12, beat * 1.3, "warm"), at + offset * beat, velocity, -.12)
        # Low-volume soft chord spread; no wall of sustained high frequencies.
        third = 4 if cfg["scale"][1] == 2 else 3
        for note, pan in [(0, -.5), (third, .08), (7, .5)]:
            add(bed, pluck(chord_root + note, beat * 3.8, "warm"), at + .016 * note, .024, pan)
        for step in range(8):
            if step in (3, 7) and bar % 2 == 0:
                continue
            motif_index = (bar * 3 + step) % len(motif)
            degree = motif[motif_index]
            octave = 12 + (12 if bar % 8 >= 6 and step in (0, 5) else 0)
            note = cfg["root"] + cfg["scale"][degree] + octave
            velocity = (.039 if step % 2 else .047) * (1 + .05 * math.sin(bar + step))
            add(bed, pluck(note, beat * .95, cfg["tone"]), at + step * beat / 2, velocity, math.sin(step * .8) * .46)
        for quarter in range(4):
            add(bed, drum, at + quarter * beat, .076 * cfg["energy"] if quarter % 2 == 0 else .042 * cfg["energy"], 0)
            if quarter in (1, 3):
                add(bed, noise_click(rng, .15, .024), at + quarter * beat, .066 * cfg["energy"], .12)
        for eighth in range(8):
            add(bed, noise_click(rng, .055, .008), at + eighth * beat / 2, .029 * cfg["energy"], -.24 if eighth % 2 else .24)
    # The hold gets a gentle original resolution, not another fake game score.
    for interval, pan in [(0, -.35), (4 if cfg["scale"][1] == 2 else 3, 0), (7, .35), (12, .15)]:
        add(bed, pluck(cfg["root"] + 12 + interval, 1.7, cfg["tone"]), actual_end + interval * .008, .054, pan)
    tail = np.arange(n, dtype=np.float32) / SR
    bed *= np.where(tail < actual_end, 1.0, .68).astype(np.float32)[:, None]
    return bed


def event_signal(kind: str, cfg: dict, rng: np.random.Generator) -> tuple[np.ndarray, float]:
    key = cfg["root"]
    if kind in ("score", "goal", "win", "lap", "ready"):
        duration = .55 if kind != "win" else .8
        cue = np.zeros(round(duration * SR), dtype=np.float32)
        intervals = [0, 7, 12] if kind != "lap" else [7, 12]
        if kind == "ready":
            intervals = [7, 12]
        for i, note in enumerate(intervals):
            fragment = pluck(key + 24 + note, .30, "glass")
            offset = round(i * .065 * SR)
            count = min(len(fragment), len(cue) - offset)
            cue[offset:offset + count] += fragment[:count] * (.75 - i * .07)
        return cue, .15 if kind in ("score", "goal", "win") else .11
    if kind in ("hit", "pop", "bounce"):
        length = .16 if kind != "pop" else .23
        cue = chirp(210 if kind != "bounce" else 520, 90 if kind != "bounce" else 320, length, .035)
        noise = noise_click(rng, length, .018)
        return cue * .80 + noise * .25, .10 if kind != "bounce" else .065
    if kind in ("dash", "boost", "shield"):
        cue = chirp(220, 650 if kind != "shield" else 900, .20, .075)
        cue += noise_click(rng, .20, .065) * .13
        return cue, .072 if kind != "shield" else .085
    if kind in ("pickup", "drop", "tap", "tick"):
        note = key + (31 if kind == "pickup" else 19 if kind == "drop" else 24)
        return pluck(note, .14, "wood"), .083 if kind == "pickup" else .051
    return pluck(key + 24, .13, "warm"), .055


def dbfs(value: float) -> float:
    return 20 * math.log10(max(value, 1e-12))


def render(game: dict) -> dict:
    cfg = CONFIG[game["id"]]
    duration = game["videoDuration"]
    n = round(duration * SR)
    rng = np.random.default_rng(2026 + sum(map(ord, game["id"])))
    bed = render_bed(n, duration, game["actualEndSeconds"], cfg, rng)
    effects = np.zeros_like(bed)
    used = []
    last_time = -100.0
    for event in game["soundEvents"]:
        at, kind = event["time"], event["type"]
        # Match the host's 45 ms protection from dense repeated collision beeps.
        # Important scoring cues always survive; all original events stay in audit.json.
        if at - last_time < .045 and kind not in ("score", "goal", "win", "lap"):
            continue
        last_time = at
        signal, level = event_signal(kind, cfg, rng)
        pan = math.sin(event["index"] * 1.43) * .26
        add(effects, signal, at, level, pan)
        used.append({"index": event["index"], "time": at, "type": kind})
    mixed = bed + effects
    del bed, effects
    # Remove DC, normalize one complete track without altering cue timing.
    mixed -= mixed.mean(axis=0, dtype=np.float64).astype(np.float32)
    fade = min(round(.3 * SR), n // 2)
    curve = np.sin(np.linspace(0, math.pi / 2, fade, dtype=np.float32)) ** 2
    mixed[:fade] *= curve[:, None]
    mixed[-fade:] *= curve[::-1, None]
    rms = float(np.sqrt(np.mean(mixed.astype(np.float64) ** 2)))
    gain = 10 ** (TARGET_RMS_DBFS / 20) / rms
    # Monotonic soft limiting catches accidental coincident plucks without hard clipping.
    mixed = (.84 * np.tanh(mixed * gain / .84)).astype(np.float32)
    peak = float(np.max(np.abs(mixed)))
    rms = float(np.sqrt(np.mean(mixed.astype(np.float64) ** 2)))
    # Validate the actual PCM round trip, not only the float intermediate.
    pcm = np.rint(np.clip(mixed, -1, 1) * 32767).astype('<i2')
    out = ROOT / 'audio' / (game["id"] + '.wav')
    out.parent.mkdir(parents=True, exist_ok=True)
    payload = pcm.tobytes()
    unchanged = False
    if out.exists():
        with wave.open(str(out), 'rb') as existing:
            unchanged = existing.getnchannels() == 2 and existing.getframerate() == SR and existing.getsampwidth() == 2 and existing.getnframes() == n and existing.readframes(n) == payload
    if not unchanged:
        with wave.open(str(out), 'wb') as stream:
            stream.setnchannels(2)
            stream.setsampwidth(2)
            stream.setframerate(SR)
            stream.writeframes(payload)
    with wave.open(str(out), 'rb') as stream:
        assert stream.getnchannels() == 2 and stream.getframerate() == SR
        assert stream.getnframes() == n
        decoded = np.frombuffer(stream.readframes(n), dtype='<i2').reshape(-1, 2).astype(np.float32) / 32768
    decoded_peak = float(np.max(np.abs(decoded)))
    decoded_rms = float(np.sqrt(np.mean(decoded.astype(np.float64) ** 2)))
    assert decoded_peak < .85, (game["id"], decoded_peak)
    assert -23 <= dbfs(decoded_rms) <= -18, (game["id"], dbfs(decoded_rms))
    assert np.max(np.abs(decoded[0])) < .0001 and np.max(np.abs(decoded[-1])) < .0001
    assert np.isfinite(decoded).all()
    chunk_rms = [float(np.sqrt(np.mean(decoded[i:min(n, i + SR)].astype(np.float64) ** 2))) for i in range(0, n, SR)]
    # Only full gameplay seconds must carry a bed. The final result chord is
    # intentionally allowed to decay softly through the two-second hold.
    assert min(chunk_rms[:math.floor(game['actualEndSeconds'])]) > .015, (game["id"], "unintended silent gameplay second")
    assert np.max(np.abs(decoded[:, 0] - decoded[:, 1])) > .005, "stereo channels are identical"
    report = {
        "id": game["id"], "path": f"audio/{game['id']}.wav", "source": "Original synthesis by make_audio.py; no external samples or speech",
        "sampleRate": SR, "channels": 2, "bitsPerSample": 16, "samplesPerChannel": n,
        "duration": n / SR, "expectedVideoDuration": duration, "durationErrorSamples": abs(n - duration * SR),
        "bpm": cfg["bpm"], "instrument": cfg["tone"], "fadeInSeconds": .3, "fadeOutSeconds": .3,
        "rmsDbfs": round(dbfs(decoded_rms), 3), "peakLinear": round(decoded_peak, 6), "peakDbfs": round(dbfs(decoded_peak), 3),
        "silentOrClipped": False, "rmsOneSecondDbfs": [round(dbfs(v), 2) for v in chunk_rms],
        "rawEngineEvents": len(game["soundEvents"]), "audibleEngineEvents": len(used),
        "suppressionRule": "45ms dense-cue limiter, matching real host; score/goal/win/lap cues preserved",
        "usedEngineEvents": used, "sha256": hashlib.sha256(out.read_bytes()).hexdigest(),
        "checks": {"duration": True, "rmsRange": True, "peakBelow085": True, "stereo": True, "noUnintendedSilence": True, "zeroFadeEndpoints": True, "pcmRoundTrip": True}
    }
    print(f"{game['id']}: {n/SR:.6f}s, RMS {report['rmsDbfs']:.2f} dBFS, peak {decoded_peak:.3f}, {len(used)}/{len(game['soundEvents'])} event cues")
    return report


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--game', choices=CONFIG)
    args = parser.parse_args()
    audit = json.loads((ROOT / 'audit.json').read_text(encoding='utf-8'))
    reports = []
    for game in audit['games']:
        if not args.game or game['id'] == args.game:
            reports.append(render(game))
    report_path = ROOT / 'audio-report.json'
    if args.game and report_path.exists():
        previous = json.loads(report_path.read_text(encoding='utf-8'))
        reports = [r for r in previous['tracks'] if r['id'] != args.game] + reports
    result = {"schema": "party-pocket-original-audio/1", "source": "Procedural original music and effects, generated locally; no external audio assets", "speech": False, "targetRmsDbfs": TARGET_RMS_DBFS, "tracks": reports, "allPassed": all(all(r['checks'].values()) for r in reports)}
    report_path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
