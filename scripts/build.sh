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


if [ "$buildAgent"=true ]; then
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

    cd $WORKSPACE
    echo $TAG > LATEST_AGENT
    echo "****************************************************"
    echo "data.stack:bm :: Agents Built using TAG :: $TAG"
    echo "****************************************************"
else 
    echo "****************************************************"
    echo "data.stack:bm :: Agents Built SKIPPED"
    echo "****************************************************"
fi

if [ "$buildAgentWatcher"=true ]; then
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

    cd $WORKSPACE
    echo $TAG > LATEST_AGENT_WATCHER
    echo "****************************************************"
    echo "data.stack:bm :: Agent Watcher Built using TAG :: $TAG"
    echo "****************************************************"
else
    echo "****************************************************"
    echo "data.stack:bm :: Agent Watcher Built SKIPPED"
    echo "****************************************************"
fi

cd $WORKSPACE

LATEST_AGENT=`cat LATEST_AGENT`
LATEST_AGENT_WATCHER=`cat LATEST_AGENT_WATCHER`

echo "****************************************************"
echo "data.stack:bm :: Building BM using TAG :: $TAG"
echo "****************************************************"


sed -i.bak s#__image_tag__#$TAG# Dockerfile

if [ $cleanBuild ]; then
    docker build --no-cache -t data.stack.bm:$TAG --build-arg LATEST_AGENTS=$LATEST_AGENT --build-arg LATEST_AGENT_WATCHER=$LATEST_AGENT_WATCHER .
else 
    docker build -t data.stack.bm:$TAG --build-arg LATEST_AGENTS=$LATEST_AGENT --build-arg LATEST_AGENT_WATCHER=$LATEST_AGENT_WATCHER .
fi


echo "****************************************************"
echo "data.stack:bm :: BM Built using TAG :: $TAG"
echo "****************************************************"

echo $TAG > LATEST_BM