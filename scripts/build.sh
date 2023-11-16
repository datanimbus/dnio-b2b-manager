#!/bin/bash

set -e

TAG=`cat CURRENT_BM`

echo "****************************************************"
echo "datanimbus.io.bm :: Building B2B Base using TAG :: $TAG"
echo "****************************************************"

cd $WORKSPACE/ds-b2b-base

sed -i.bak s#__image_tag__#$TAG# Dockerfile

if $cleanBuild ; then
    docker build --no-cache --pull -t datanimbus.io.b2b.base:$TAG .
else 
    docker build -t datanimbus.io.b2b.base:$TAG .
fi


echo "****************************************************"
echo "datanimbus.io.bm :: B2B Base Built using TAG :: $TAG"
echo "****************************************************"

echo "****************************************************"
echo "datanimbus.io.bm :: Building FaaS Base using TAG :: $TAG"
echo "****************************************************"

cd $WORKSPACE/ds-faas

sed -i.bak s#__image_tag__#$TAG# Dockerfile

if $cleanBuild ; then
    docker build --no-cache --pull -t datanimbus.io.faas.base:$TAG .
else 
    docker build -t datanimbus.io.faas.base:$TAG .
fi


echo "****************************************************"
echo "datanimbus.io.bm :: FaaS Base Built using TAG :: $TAG"
echo "****************************************************"

if $buildAgent ; then
    echo "****************************************************"
    echo "datanimbus.io.bm :: Building Agents using TAG :: $TAG"
    echo "****************************************************"

    cd $WORKSPACE/ds-agent

    sed -i.bak s#__image_tag__#$TAG# Dockerfile
    # sed -i.bak s#__signing_key_user__#$SIGNING_KEY_USER# Dockerfile
    # sed -i.bak s#__signing_key_password__#$SIGNING_KEY_PASSWORD# Dockerfile

    if [ $cleanBuild ]; then
        docker build --no-cache --pull -t datanimbus.io.b2b.agents:$TAG --build-arg SIGNING_KEY_USER=$SIGNING_KEY_USER --build-arg SIGNING_KEY_PASSWORD=$SIGNING_KEY_PASSWORD .
    else 
        docker build -t datanimbus.io.b2b.agents:$TAG --build-arg SIGNING_KEY_USER=$SIGNING_KEY_USER --build-arg SIGNING_KEY_PASSWORD=$SIGNING_KEY_PASSWORD .
    fi

    cd $WORKSPACE
    echo $TAG > LATEST_AGENT
    echo "****************************************************"
    echo "datanimbus.io.bm :: Agents Built using TAG :: $TAG"
    echo "****************************************************"
else 
    echo "****************************************************"
    echo "datanimbus.io.bm :: Agents Built SKIPPED"
    echo "****************************************************"
fi

if $buildAgentWatcher ; then
    echo "****************************************************"
    echo "datanimbus.io.bm :: Building Agent Watcher using TAG :: $TAG"
    echo "****************************************************"

    cd $WORKSPACE/ds-agent-watcher

    sed -i.bak s#__image_tag__#$TAG# Dockerfile
    # sed -i.bak s#__signing_key_user__#$SIGNING_KEY_USER# Dockerfile
    # sed -i.bak s#__signing_key_password__#$SIGNING_KEY_PASSWORD# Dockerfile

    if [ $cleanBuild ]; then
        docker build --no-cache --pull -t datanimbus.io.b2b.agent.watcher:$TAG --build-arg SIGNING_KEY_USER=$SIGNING_KEY_USER --build-arg SIGNING_KEY_PASSWORD=$SIGNING_KEY_PASSWORD .
    else 
        docker build -t datanimbus.io.b2b.agent.watcher:$TAG --build-arg SIGNING_KEY_USER=$SIGNING_KEY_USER --build-arg SIGNING_KEY_PASSWORD=$SIGNING_KEY_PASSWORD .
    fi

    cd $WORKSPACE
    echo $TAG > LATEST_AGENT_WATCHER
    echo "****************************************************"
    echo "datanimbus.io.bm :: Agent Watcher Built using TAG :: $TAG"
    echo "****************************************************"
else
    echo "****************************************************"
    echo "datanimbus.io.bm :: Agent Watcher Built SKIPPED"
    echo "****************************************************"
fi

cd $WORKSPACE

LATEST_AGENT=`cat LATEST_AGENT`
LATEST_AGENT_WATCHER=`cat LATEST_AGENT_WATCHER`

echo "****************************************************"
echo "datanimbus.io.bm :: Building BM using TAG :: $TAG"
echo "****************************************************"


sed -i.bak s#__image_tag__#$TAG# Dockerfile

if [ $cleanBuild ]; then
    docker build --no-cache -t datanimbus.io.bm:$TAG --build-arg LATEST_AGENTS=$LATEST_AGENT --build-arg LATEST_AGENT_WATCHER=$LATEST_AGENT_WATCHER .
else 
    docker build -t datanimbus.io.bm:$TAG --build-arg LATEST_AGENTS=$LATEST_AGENT --build-arg LATEST_AGENT_WATCHER=$LATEST_AGENT_WATCHER .
fi


echo "****************************************************"
echo "datanimbus.io.bm :: BM Built using TAG :: $TAG"
echo "****************************************************"

echo $TAG > LATEST_BM