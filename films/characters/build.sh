#!/bin/bash
# Rebuild the iLab@home character film (needs: node + playwright, ffmpeg, Google Chrome)
# 1) extract clip frames  2) render 3 parts in parallel  3) mix voice + music  4) web copy
set -e; cd "$(dirname "$0")"
V="scale=1920:-2:flags=lanczos,crop=1920:1080,fps=30"; mkdir -p f/intro f/office f/village out
ffmpeg -loglevel error -y -i clips/clip_intro.mp4 -vf "$V" -q:v 3 f/intro/%04d.jpg
ffmpeg -loglevel error -y -ss 1.0 -i clips/clip_office.mp4 -vf "$V" -q:v 3 f/office/%04d.jpg
ffmpeg -loglevel error -y -i clips/clip_village.mp4 -vf "setpts=PTS*1.01,$V" -q:v 3 f/village/%04d.jpg
node render.mjs 0 17 r0 8911 & node render.mjs 17 33.6 r1 8912 & node render.mjs 33.6 55.5 r2 8913 & wait
printf "file 'r0.mp4'\nfile 'r1.mp4'\nfile 'r2.mp4'\n" > out/l.txt
ffmpeg -loglevel error -y -f concat -safe 0 -i out/l.txt -c copy out/silent.mp4
D=55.5
ffmpeg -loglevel error -y -i audio/vo_male.wav -stream_loop 2 -i audio/music.wav -filter_complex "[0:a]aresample=48000,adelay=1000|1000,loudnorm=I=-16:TP=-1.5:LRA=11,apad[v];[1:a]aresample=48000,atrim=0:$D,volume=0.17,afade=t=in:d=1.0,afade=t=out:st=52.5:d=3[m];[v][m]amix=inputs=2:duration=longest:normalize=0,atrim=0:$D,alimiter=limit=0.95[o]" -map "[o]" -ac 2 -ar 48000 out/mix.wav
ffmpeg -loglevel error -y -i out/silent.mp4 -i out/mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 160k -t $D -movflags +faststart out/iLabAtHome_Characters.mp4
ffmpeg -loglevel error -y -i out/iLabAtHome_Characters.mp4 -c:v libx264 -preset slow -crf 24 -maxrate 3.5M -bufsize 7M -c:a aac -b:a 128k -movflags +faststart out/web.mp4
echo "done: out/iLabAtHome_Characters.mp4 (full) and out/web.mp4 (for site/media)"
