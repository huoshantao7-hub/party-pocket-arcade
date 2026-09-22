"""Join six 15-second gameplay excerpts. Run after rendering all six videos."""
from pathlib import Path
import json
import subprocess
import sys

OUTPUT = Path(__file__).resolve().parent / 'output'
audit = json.loads((OUTPUT / 'audit.json').read_text(encoding='utf-8'))
draft = '--draft' in sys.argv
starts = {'jelly': 12, 'kitchen': 0, 'bubble': 0, 'magnet': 0, 'hockey': 6}
segments = []
for game in audit['games']:
    tag = 'draft' if draft else 'final'
    source = OUTPUT / 'renders' / f'{game["id"]}-{tag}.mp4'
    if not source.is_file():
        raise FileNotFoundError(f'Render this game first: {source.name}')
    fps = 8 if draft else 30
    duration = int(game['videoDuration'] * fps + .5) / fps
    start = max(0, min(starts.get(game['id'], duration - 15), duration - 15))
    destination = OUTPUT / 'renders' / f'segment-{game["id"]}-{tag}.mp4'
    subprocess.run(['ffmpeg', '-y', '-hide_banner', '-v', 'error', '-ss', str(start), '-i', str(source), '-t', '15', '-af', 'afade=t=in:d=0.08,afade=t=out:st=14.92:d=0.08', '-c:v', 'libx264', '-threads', '2', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', str(destination)], check=True)
    segments.append(destination)
concat = OUTPUT / 'renders' / f'concat-{tag}.txt'
# Relative filenames keep paths portable and avoid platform-specific concat escaping.
concat.write_text(''.join(f"file '{file.name}'\n" for file in segments), encoding='utf-8')
destination = OUTPUT / 'renders' / ('compilation-draft.mp4' if draft else 'party-pocket-compilation.mp4')
subprocess.run(['ffmpeg', '-y', '-hide_banner', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', str(concat), '-c', 'copy', '-movflags', '+faststart', str(destination)], check=True)
print('Compiled six real gameplay ranges: 90 seconds.')
