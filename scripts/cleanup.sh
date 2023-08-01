#!/bin/bash

set -e

TAG=`cat CURRENT_BM`

echo "****************************************************"
echo "datanimbus.io.bm :: Cleaning Up Local Images :: $TAG"
echo "****************************************************"

docker rmi datanimbus.io.bm:$TAG -f
docker rmi datanimbus.io.b2b.base:$TAG -f
docker rmi datanimbus.io.faas.base:$TAG -f