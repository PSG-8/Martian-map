set -e
cd "$(dirname "$0")"; mkdir -p out
node render.mjs 0 15.45 s0 8901 > out/s0.log 2>&1 &
node render.mjs 15.45 30.6 s1 8902 > out/s1.log 2>&1 &
node render.mjs 30.6 44.0 s2 8903 > out/s2.log 2>&1 &
node render.mjs 44.0 61.5 s3 8904 > out/s3.log 2>&1 &
wait
printf "file 's0.mp4'\nfile 's1.mp4'\nfile 's2.mp4'\nfile 's3.mp4'\n" > out/list.txt
ffmpeg -y -loglevel error -f concat -safe 0 -i out/list.txt -c copy out/silent.mp4
curl -sL -o out/a.wav "https://resource2.heygen.ai/text_to_speech/ec9fd7d978f44532af3a0de45c03c25e/4270665fc47f44aa989c093bb3dc2b99/id=166fece8405a4652a1af31f01a45e0bc.wav"
curl -sL -o out/b.wav "https://resource2.heygen.ai/text_to_speech/ec9fd7d978f44532af3a0de45c03c25e/4270665fc47f44aa989c093bb3dc2b99/id=1db07f3ad7694d7291d72d54017fb450.wav"
ffmpeg -y -loglevel error -i out/a.wav -i out/b.wav -filter_complex "[0:a]aresample=48000,atrim=0:15.36,asetpts=N/SR/TB[x];[1:a]aresample=48000,asetpts=N/SR/TB[y];[0:a]aresample=48000,atrim=start=21.25,asetpts=N/SR/TB[z];[x][y][z]concat=n=3:v=0:a=1,apad=pad_dur=3,loudnorm=I=-16:TP=-1.5:LRA=11[o]" -map "[o]" -ac 2 -ar 48000 out/vo.wav
ffmpeg -y -loglevel error -i out/silent.mp4 -i out/vo.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 160k -shortest -movflags +faststart out/LabAtHome_Explainer.mp4
ls -la out/*.mp4
