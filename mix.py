# Builds the final Lab@Home film: silent picture + voice-over + music + sound effects.
import subprocess, sys
A = '/vercel/lah/aud/'; V = sys.argv[1]; OUT = sys.argv[2]
OFF = 1.8; DUR = 60.0
sfx = [('whoosh', 1.15, .40), ('pop', 13.2, .30), ('pop', 14.0, .30), ('pop', 15.25, .28), ('chime', 16.05, .22), ('pop', 17.35, .28), ('pop', 18.75, .2), ('pop', 19.5, .28),
       ('pop', 20.85, .22), ('pop', 21.65, .28), ('pop', 22.95, .28), ('pop', 23.8, .3), ('chime', 24.32, .38), ('pop', 25.5, .25), ('chime', 26.15, .38), ('whoosh', 26.45, .18),
       ('pop', 31.05, .25), ('chime', 31.6, .3), ('pop', 32.65, .28), ('whoosh', 34.35, .22), ('chime', 37.9, .32), ('whoosh', 41.3, .32), ('whoosh', 42.28, .32),
       ('pop', 43.4, .22), ('chime', 45.5, .32), ('pop', 45.8, .22), ('pop', 46.1, .22), ('pop', 48.4, .28), ('chime', 48.6, .22), ('whoosh', 49.7, .38), ('pop', 53.4, .15), ('pop', 54.3, .2)]
inputs = ['-i', V, '-i', A + 'vo.wav', '-i', A + 'music.wav']
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
