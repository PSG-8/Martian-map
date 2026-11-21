set -e
cd "$(dirname "$0")"; mkdir -p out
L=$(cat LEN); q() { awk "BEGIN{printf \"%.2f\", $L*$1}"; }
A=$(q 0.26); B=$(q 0.5); C=$(q 0.74)
node render.mjs 0 $A s0 8901 > out/s0.log 2>&1 &
node render.mjs $A $B s1 8902 > out/s1.log 2>&1 &
node render.mjs $B $C s2 8903 > out/s2.log 2>&1 &
node render.mjs $C $L s3 8904 > out/s3.log 2>&1 &
wait; for f in out/*.log; do tail -n 1 "$f"; done
printf "file 's0.mp4'\nfile 's1.mp4'\nfile 's2.mp4'\nfile 's3.mp4'\n" > out/list.txt
ffmpeg -y -loglevel error -f concat -safe 0 -i out/list.txt -c copy out/silent.mp4
cd out
curl -sfL -o music.wav "https://heygen-product.s3-accelerate.amazonaws.com/astral_generated_music/d0e756d581b44a83a025a52ff58b549b.wav?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIA3FLD4S3AU34WOEMJ%2F20261121%2Fus-east-2%2Fs3%2Faws4_request&X-Amz-Date=20261121T152448Z&X-Amz-Expires=604800&X-Amz-SignedHeaders=host&X-Amz-Signature=5eda0a2378d9b5fb129e93a94f11465dc4f47335234b12bcb67822c7aa51fc10"
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 silent.mp4)
ffmpeg -y -loglevel error -i ../vo_raw.wav -stream_loop 2 -i music.wav -filter_complex "[0:a]aresample=48000,loudnorm=I=-16:TP=-1.5:LRA=11,apad[v];[1:a]aresample=48000,atrim=0:${D},volume=0.16,afade=t=in:d=1.2,afade=t=out:st=$(awk "BEGIN{print $D-3}"):d=3[m];[v][m]amix=inputs=2:duration=longest:normalize=0,atrim=0:${D},alimiter=limit=0.95[o]" -map "[o]" -ac 2 -ar 48000 mix.wav
ffmpeg -y -loglevel error -i silent.mp4 -i mix.wav -map 0:v -map 1:a -c:v libx264 -preset slow -crf 23 -maxrate 3.5M -bufsize 7M -c:a aac -b:a 128k -t "$D" -movflags +faststart iLabAtHome_HowItWorks.mp4
ffmpeg -y -loglevel error -ss 3 -i iLabAtHome_HowItWorks.mp4 -frames:v 1 -vf scale=1280:-2 -q:v 4 how_poster.jpg
ls -la iLabAtHome_HowItWorks.mp4; ffprobe -v error -show_entries format=duration -of csv=p=0 iLabAtHome_HowItWorks.mp4
