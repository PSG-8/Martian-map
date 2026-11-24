#!/bin/bash
# bump asset version, copy the site into the push repo, commit and push the lab-at-home branch; prints the commit sha
set -e
V=$1; MSG=$2
cd /tmp/lab/site
sed -i -E "s/\?v=[0-9]+/?v=$V/g" index.html sw.js
sed -i -E "s/const V = 'lah-v[0-9]+'/const V = 'lah-v$V'/" sw.js
sed -i -E "s/const APP_V = [0-9]+;/const APP_V = $V;/" js/app.js
cd /tmp/lab/push && find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} + && cp -r /tmp/lab/site/. .
git add -A && git -c user.name="psg-8" -c user.email="noreply@github.com" commit -qm "$MSG" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YANjQd28WCrpCVMSTKCzyr" && git push -q origin lab-at-home 2>&1 | grep -v '^remote: *$' || true
git rev-parse HEAD
