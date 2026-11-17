#!/usr/bin/env bash
# One-shot setup inside the cloud sandbox. Usage: bash setup.sh
set -e
cd "$(dirname "$0")"
if ! command -v ffmpeg >/dev/null; then
  curl -sL https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz -o /tmp/ff.tar.xz
  tar xf /tmp/ff.tar.xz -C /tmp && sudo cp /tmp/ffmpeg-*-static/ffmpeg /tmp/ffmpeg-*-static/ffprobe /usr/local/bin/
fi
python3 -m pip --version >/dev/null 2>&1 || python3 -m ensurepip --user >/dev/null 2>&1 || sudo dnf install -y python3-pip >/dev/null 2>&1
python3 -m pip install --user -q faster-whisper opencv-python-headless numpy 2>&1 | tail -2
mkdir -p models work out
[ -f models/bd.rnnn ] || curl -sL https://raw.githubusercontent.com/GregorR/rnnoise-models/master/beguiling-drafter-2018-08-30/bd.rnnn -o models/bd.rnnn
python3 - <<'EOF'
from faster_whisper import WhisperModel
WhisperModel('small.en', device='cpu', compute_type='int8'); print('whisper ready')
EOF
ffmpeg -version | head -1; ls -la models
