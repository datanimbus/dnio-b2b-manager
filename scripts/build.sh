#!/bin/bash

set -e

TAG=`cat CURRENT_BM`

echo "****************************************************"
echo "data.stack:bm :: Building BM using TAG :: $TAG"
echo "****************************************************"


docker build -t data.stack.bm:$TAG .


echo "****************************************************"
echo "data.stack:bm :: BM Built using TAG :: $TAG"
echo "****************************************************"


echo $TAG > LATEST_BM