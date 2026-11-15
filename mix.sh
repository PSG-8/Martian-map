#!/bin/bash
set -e
FF=${FF:-node_modules/ffmpeg-static/ffmpeg}
$FF -y -loglevel error -i voice.wav -i music.wav -i sfx.wav -filter_complex "\
[0:a]aresample=44100,aformat=channel_layouts=mono,highpass=f=70,acompressor=threshold=-20dB:ratio=3:attack=5:release=80,loudnorm=I=-16:TP=-1.5:LRA=7,aresample=44100,apad,atrim=0:31[v];\
[v]asplit=2[v1][vsc];\
[1:a]volume=0.35[m];\
[m][vsc]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=350[md];\
[2:a]volume=0.8[s];\
[v1][md][s]amix=inputs=3:normalize=0:duration=longest,alimiter=limit=0.93[a]" -map "[a]" -ac 2 -ar 44100 mix.wav
$FF -y -loglevel error -i ${1:-silent.mp4} -i mix.wav -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart ${2:-radar_EN.mp4}
$FF -hide_banner -i mix.wav -af ebur128 -f null - 2>&1 | grep -E "I:|LRA:" | tail -2
