set -e
cd out
while [ ! -f LabAtHome_Explainer.mp4 ]; do sleep 10; done
curl -sL -o music.wav "https://heygen-product.s3-accelerate.amazonaws.com/astral_generated_music/d0e756d581b44a83a025a52ff58b549b.wav?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIA3FLD4S3AU34WOEMJ%2F20261121%2Fus-east-2%2Fs3%2Faws4_request&X-Amz-Date=20261121T152448Z&X-Amz-Expires=604800&X-Amz-SignedHeaders=host&X-Amz-Signature=5eda0a2378d9b5fb129e93a94f11465dc4f47335234b12bcb67822c7aa51fc10"
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 silent.mp4)
ffmpeg -y -loglevel error -i vo.wav -stream_loop 1 -i music.wav -filter_complex "[1:a]aresample=48000,atrim=0:${D},volume=0.16,afade=t=in:d=1.2,afade=t=out:st=$(awk "BEGIN{print $D-3}"):d=3[m];[0:a][m]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95[o]" -map "[o]" -ac 2 -ar 48000 mix.wav
ffmpeg -y -loglevel error -i silent.mp4 -i mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 160k -t "$D" -movflags +faststart final.mp4
ffmpeg -y -loglevel error -ss 2.8 -i final.mp4 -frames:v 1 -q:v 3 poster.jpg
K=sb_publishable_rVQ1jmPovakb-FMIgB1pUQ_BAoJlXMv; U=https://ufykiqxsegyuyablrjsq.supabase.co/storage/v1/object/media
curl -s -X POST "$U/LabAtHome_Explainer_v2.mp4" -H "apikey: $K" -H "Authorization: Bearer $K" -H "Content-Type: video/mp4" --data-binary @final.mp4; echo
curl -s -X POST "$U/explainer_poster_v2.jpg" -H "apikey: $K" -H "Authorization: Bearer $K" -H "Content-Type: image/jpeg" --data-binary @poster.jpg; echo
ls -la final.mp4 poster.jpg; ffprobe -v error -show_entries format=duration:stream=codec_name,width,height -of compact final.mp4
echo POSTDONE
