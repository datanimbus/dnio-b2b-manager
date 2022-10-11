#!/bin/bash

set -e

TAG=`cat CURRENT_BM`

echo "****************************************************"
echo "data.stack:bm :: Building B2B Base using TAG :: $TAG"
echo "****************************************************"

cd $WORKSPACE/ds-b2b-base

sed -i.bak s#__image_tag__#$TAG# Dockerfile

if [ $cleanBuild ]; then
    docker build --no-cache -t data.stack.b2b.base:$TAG .
else 
    docker build -t data.stack.b2b.base:$TAG .
fi


echo "****************************************************"
echo "data.stack:bm :: B2B Base Built using TAG :: $TAG"
echo "****************************************************"

echo "****************************************************"
echo "data.stack:bm :: Building FaaS Base using TAG :: $TAG"
echo "****************************************************"

cd $WORKSPACE/ds-faas

sed -i.bak s#__image_tag__#$TAG# Dockerfile

if [ $cleanBuild ]; then
    docker build --no-cache -t data.stack.faas.base:$TAG .
else 
    docker build -t data.stack.faas.base:$TAG .
fi


echo "****************************************************"
echo "data.stack:bm :: FaaS Base Built using TAG :: $TAG"
echo "****************************************************"

echo "****************************************************"
echo "data.stack:bm :: Building Agents using TAG :: $TAG"
echo "****************************************************"

cd $WORKSPACE/ds-agent

sed -i.bak s#__image_tag__#$TAG# Dockerfile
sed -i.bak s#__signing_key_user__#$SIGNING_KEY_USER# Dockerfile
sed -i.bak s#__signing_key_password__#$SIGNING_KEY_PASSWORD# Dockerfile

if [ $cleanBuild ]; then
    docker build --no-cache -t data.stack.b2b.agents:$TAG .
else 
    docker build -t data.stack.b2b.agents:$TAG .
fi

echo "****************************************************"
echo "data.stack:bm :: Agents Built using TAG :: $TAG"
echo "****************************************************"

echo "****************************************************"
echo "data.stack:bm :: Building Agent Watcher using TAG :: $TAG"
echo "****************************************************"

cd $WORKSPACE/ds-agent-watcher

sed -i.bak s#__image_tag__#$TAG# Dockerfile
sed -i.bak s#__signing_key_user__#$SIGNING_KEY_USER# Dockerfile
sed -i.bak s#__signing_key_password__#$SIGNING_KEY_PASSWORD# Dockerfile

if [ $cleanBuild ]; then
    docker build --no-cache -t data.stack.b2b.agent.watcher:$TAG .
else 
    docker build -t data.stack.b2b.agent.watcher:$TAG .
fi

echo "****************************************************"
echo "data.stack:bm :: Agent Watcher Built using TAG :: $TAG"
echo "****************************************************"

echo "****************************************************"
echo "data.stack:bm :: Building BM using TAG :: $TAG"
echo "****************************************************"

cd $WORKSPACE/ds-b2b-manager

sed -i.bak s#__image_tag__#$TAG# Dockerfile

if [ $cleanBuild ]; then
    docker build --no-cache -t data.stack.bm:$TAG --build-arg LATEST_AGENTS=$TAG .
else 
    docker build -t data.stack.bm:$TAG --build-arg LATEST_AGENTS=$TAG .
fi


echo "****************************************************"
echo "data.stack:bm :: BM Built using TAG :: $TAG"
echo "****************************************************"

echo $TAG > LATEST_BM