#!/bin/bash
pkill -f 'node server.js' || true
sleep 1
cd /opt/mercy/dashboard
nohup node server.js > /var/log/mercy-dashboard.log 2>&1 &
disown
sleep 1
echo started
