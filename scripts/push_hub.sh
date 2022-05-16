#!/bin/bash

set -e

TAG=`cat CURRENT_BM`

echo "****************************************************"
echo "data.stack:bm :: Pushing Image to Docker Hub :: appveen/data.stack.bm:$TAG"
echo "****************************************************"

docker tag data.stack.bm:$TAG appveen/data.stack.bm:$TAG
docker push appveen/data.stack.bm:$TAG

echo "****************************************************"
echo "data.stack:bm :: Image Pushed to Docker Hub AS appveen/data.stack.bm:$TAG"
echo "****************************************************"