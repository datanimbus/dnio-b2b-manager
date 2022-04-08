#!/bin/bash

pm2 stop 05-bm || true
pm2 start build/pm2_local.yaml
