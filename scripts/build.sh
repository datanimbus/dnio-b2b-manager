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


echo "****************************************************"
echo "data.stack:bm :: Building B2B Base using TAG :: $TAG"
echo "****************************************************"

cd $WORKSPACE/ds-b2b-base

docker build -t data.stack.b2b.base:$TAG .


echo "****************************************************"
echo "data.stack:bm :: B2B Base Built using TAG :: $TAG"
echo "****************************************************"

echo "****************************************************"
echo "data.stack:bm :: Building FaaS Base using TAG :: $TAG"
echo "****************************************************"

cd $WORKSPACE/ds-faas

docker build -t data.stack.faas.base:$TAG .


echo "****************************************************"
echo "data.stack:bm :: FaaS Base Built using TAG :: $TAG"
echo "****************************************************"

echo $TAG > LATEST_BM