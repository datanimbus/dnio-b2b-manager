#!/bin/bash

set -e

TAG=`cat CURRENT_BM`

echo "****************************************************"
echo "datanimbus.io.bm :: Pushing Image to Docker Hub :: appveen/datanimbus.io.bm:$TAG"
echo "****************************************************"

docker tag datanimbus.io.bm:$TAG appveen/datanimbus.io.bm:$TAG
docker push appveen/datanimbus.io.bm:$TAG

echo "****************************************************"
echo "datanimbus.io.bm :: Image Pushed to Docker Hub AS appveen/datanimbus.io.bm:$TAG"
echo "****************************************************"

docker tag datanimbus.io.b2b.base:$TAG appveen/datanimbus.io.b2b.base:$TAG
docker push appveen/datanimbus.io.b2b.base:$TAG

echo "****************************************************"
echo "datanimbus.io.bm :: Image Pushed to Docker Hub AS appveen/datanimbus.io.b2b.base:$TAG"
echo "****************************************************"

docker tag datanimbus.io.faas.base:$TAG appveen/datanimbus.io.faas.base:$TAG
docker push appveen/datanimbus.io.faas.base:$TAG

echo "****************************************************"
echo "datanimbus.io.bm :: Image Pushed to Docker Hub AS appveen/datanimbus.io.faas.base:$TAG"
echo "****************************************************"