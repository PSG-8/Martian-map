set -e
cd "$(dirname "$0")"; mkdir -p out
node render.mjs 0 16.85 s0 8901 > out/s0.log 2>&1 &
node render.mjs 16.85 32.61 s1 8902 > out/s1.log 2>&1 &
node render.mjs 32.61 47.38 s2 8903 > out/s2.log 2>&1 &
node render.mjs 47.38 65.9 s3 8904 > out/s3.log 2>&1 &
wait
printf "file 's0.mp4'\nfile 's1.mp4'\nfile 's2.mp4'\nfile 's3.mp4'\n" > out/list.txt
ffmpeg -y -loglevel error -f concat -safe 0 -i out/list.txt -c copy out/silent.mp4
curl -sL -o out/a.wav "https://resource2.heygen.ai/text_to_speech/ec9fd7d978f44532af3a0de45c03c25e/c41a1272a0fc42c2900e03f05556ecd4/id=42846d74dda54b72b7eeaa598b2d724a.wav"
ffmpeg -y -loglevel error -i out/a.wav -af "aresample=48000,apad=pad_dur=3,loudnorm=I=-16:TP=-1.5:LRA=11" -ac 2 -ar 48000 out/vo.wav
ffmpeg -y -loglevel error -i out/silent.mp4 -i out/vo.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 160k -shortest -movflags +faststart out/LabAtHome_Explainer.mp4
ls -la out/*.mp4
