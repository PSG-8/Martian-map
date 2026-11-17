#!/usr/bin/env bash
# Download speaker videos from Google Drive into work/. Usage: bash fetch.sh KEY DRIVE_ID
cd "$(dirname "$0")"
key=$1; id=$2
curl -sL "https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t" -o "work/src_${key}.mov"
ls -la "work/src_${key}.mov"; ffprobe -v error -show_entries format=duration:stream=codec_name,width,height -of compact "work/src_${key}.mov" | head -3
