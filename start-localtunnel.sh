#!/usr/bin/env bash
cd /Users/ivanskuda/my-server/public
# Use exec so pm2 tracks the localtunnel process directly
exec npx localtunnel --port 3000
