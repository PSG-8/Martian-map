set -e
cd "$(dirname "$0")"; mkdir -p out
# split on shot boundaries so each worker starts cleanly
node render.mjs 0 18.2 s0 8901 > out/s0.log 2>&1 &
node render.mjs 18.2 33 s1 8902 > out/s1.log 2>&1 &
node render.mjs 33 46 s2 8903 > out/s2.log 2>&1 &
node render.mjs 46 61 s3 8904 > out/s3.log 2>&1 &
wait; tail -2 out/*.log
printf "file 's0.mp4'\nfile 's1.mp4'\nfile 's2.mp4'\nfile 's3.mp4'\n" > out/list.txt
ffmpeg -y -loglevel error -f concat -safe 0 -i out/list.txt -c copy out/silent.mp4
cd out
curl -sL -o a.wav "https://resource2.heygen.ai/text_to_speech/ec9fd7d978f44532af3a0de45c03c25e/c41a1272a0fc42c2900e03f05556ecd4/id=b61a7bacd8d547589ff712b81a34ee90.wav"
curl -sL -o music.wav "https://heygen-product.s3-accelerate.amazonaws.com/astral_generated_music/d0e756d581b44a83a025a52ff58b549b.wav?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIA3FLD4S3AU34WOEMJ%2F20261121%2Fus-east-2%2Fs3%2Faws4_request&X-Amz-Date=20261121T152448Z&X-Amz-Expires=604800&X-Amz-SignedHeaders=host&X-Amz-Signature=5eda0a2378d9b5fb129e93a94f11465dc4f47335234b12bcb67822c7aa51fc10"
ls -la a.wav music.wav
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 silent.mp4)
ffmpeg -y -loglevel error -i a.wav -stream_loop 2 -i music.wav -filter_complex "[0:a]aresample=48000,adelay=1200|1200,loudnorm=I=-16:TP=-1.5:LRA=11,apad[v];[1:a]aresample=48000,atrim=0:${D},volume=0.17,afade=t=in:d=1.0,afade=t=out:st=$(awk "BEGIN{print $D-3}"):d=3[m];[v][m]amix=inputs=2:duration=longest:normalize=0,atrim=0:${D},alimiter=limit=0.95[o]" -map "[o]" -ac 2 -ar 48000 mix.wav
ffmpeg -y -loglevel error -i silent.mp4 -i mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 160k -t "$D" -movflags +faststart iLabAtHome_Characters.mp4
ffmpeg -y -loglevel error -ss 51.5 -i iLabAtHome_Characters.mp4 -frames:v 1 -q:v 3 cast_poster.jpg
ls -la iLabAtHome_Characters.mp4; ffprobe -v error -show_entries format=duration:stream=codec_name,width,height -of compact iLabAtHome_Characters.mp4
