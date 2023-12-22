#!/bin/bash

set -e

TAG=`cat CURRENT_BM`

echo "****************************************************"
echo "datanimbus.io.bm :: Pushing Image to Docker Hub :: datanimbus/datanimbus.io.bm:$TAG"
echo "****************************************************"

docker tag datanimbus.io.bm:$TAG datanimbus/datanimbus.io.bm:$TAG
docker push datanimbus/datanimbus.io.bm:$TAG

echo "****************************************************"
echo "datanimbus.io.bm :: Image Pushed to Docker Hub AS datanimbus/datanimbus.io.bm:$TAG"
echo "****************************************************"

docker tag datanimbus.io.b2b.base:$TAG datanimbus/datanimbus.io.b2b.base:$TAG
docker push datanimbus/datanimbus.io.b2b.base:$TAG

echo "****************************************************"
echo "datanimbus.io.bm :: Image Pushed to Docker Hub AS datanimbus/datanimbus.io.b2b.base:$TAG"
echo "****************************************************"

docker tag datanimbus.io.faas.base:$TAG datanimbus/datanimbus.io.faas.base:$TAG
docker push datanimbus/datanimbus.io.faas.base:$TAG

echo "****************************************************"
echo "datanimbus.io.bm :: Image Pushed to Docker Hub AS datanimbus/datanimbus.io.faas.base:$TAG"
echo "****************************************************"