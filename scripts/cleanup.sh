#!/bin/bash

set -e

TAG=`cat CURRENT_BM`

echo "****************************************************"
echo "data.stack:bm :: Cleaning Up Local Images :: $TAG"
echo "****************************************************"

docker rmi data.stack.bm:$TAG -f
docker rmi data.stack.b2b.base:$TAG -f
docker rmi data.stack.faas.base:$TAG -f