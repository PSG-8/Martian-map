# Builds the final Lab@Home film: silent picture + voice-over + music + sound effects.
import subprocess, sys
A = '/vercel/lah/aud/'; V = sys.argv[1]; OUT = sys.argv[2]
OFF = 1.8; DUR = 62.2
sfx = [('whoosh', 1.15, 0.4), ('pop', 12.88, 0.3), ('pop', 13.65, 0.3), ('pop', 14.86, 0.28), ('chime', 15.64, 0.22), ('pop', 16.9, 0.28), ('pop', 18.25, 0.2), ('pop', 18.98, 0.28), ('pop', 20.29, 0.22), ('pop', 21.06, 0.28), ('pop', 22.32, 0.28), ('pop', 23.15, 0.3), ('chime', 23.65, 0.38), ('pop', 24.85, 0.25), ('chime', 25.55, 0.38), ('whoosh', 25.8, 0.18), ('whoosh', 26.4, 0.2), ('chime', 28.75, 0.25), ('pop', 29.05, 0.2), ('pop', 31.15, 0.22), ('pop', 33.0, 0.25), ('chime', 33.6, 0.3), ('pop', 34.65, 0.28), ('whoosh', 36.75, 0.22), ('chime', 40.15, 0.32), ('pop', 43.5, 0.2), ('whoosh', 44.25, 0.32), ('whoosh', 45.32, 0.32), ('pop', 46.0, 0.22), ('chime', 48.17, 0.32), ('pop', 48.5, 0.22), ('pop', 48.83, 0.22), ('pop', 51.37, 0.28), ('chime', 51.59, 0.22), ('whoosh', 52.8, 0.38), ('pop', 56.11, 0.15), ('pop', 56.92, 0.2)]
inputs = ['-i', V, '-i', A + 'vo2.wav', '-i', A + 'music.wav']
fc = []
fc.append(f"[1:a]aresample=48000,highpass=f=70,acompressor=threshold=-20dB:ratio=3:attack=8:release=120:makeup=2,volume=1.0,adelay={int(OFF*1000)}|{int(OFF*1000)},apad,atrim=0:{DUR},asplit=2[vo][vosc]")
fc.append(f"[2:a]aresample=48000,atrim=0:{DUR},afade=t=in:st=0:d=0.8,afade=t=out:st={DUR-3.2}:d=3.2,volume=0.55[mus]")
fc.append("[mus][vosc]sidechaincompress=threshold=0.025:ratio=7:attack=25:release=450:makeup=1[musd]")
labels = []
for i, (name, t, vol) in enumerate(sfx):
    inputs += ['-i', A + name + '.mp3']; k = 3 + i
    fc.append(f"[{k}:a]aresample=48000,volume={vol},adelay={int(t*1000)}|{int(t*1000)},apad,atrim=0:{DUR}[s{i}]"); labels.append(f"[s{i}]")
fc.append(f"[vo][musd]{''.join(labels)}amix=inputs={2+len(labels)}:normalize=0:duration=first[mx]")
fc.append("[mx]loudnorm=I=-15:TP=-1.2:LRA=9,aresample=48000[aout]")
cmd = ['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error'] + inputs + ['-filter_complex', ';'.join(fc), '-map', '0:v', '-map', '[aout]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', '-t', str(DUR), OUT]
print(' '.join(cmd[:8]), '...'); subprocess.run(cmd, check=True); print('ok', OUT)
