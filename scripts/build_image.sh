#!/bin/bash
set -e
if [ -f $WORKSPACE/../TOGGLE ]; then
    echo "****************************************************"
    echo "datanimbus.io.bm :: Toggle mode is on, terminating build"
    echo "datanimbus.io.bm :: BUILD CANCLED"
    echo "****************************************************"
    exit 0
fi

cd ..

cDate=`date +%Y.%m.%d.%H.%M` #Current date and time

if [ -f $WORKSPACE/../CICD ]; then
    CICD=`cat $WORKSPACE/../CICD`
fi
if [ -f $WORKSPACE/../DATA_STACK_RELEASE ]; then
    REL=`cat $WORKSPACE/../DATA_STACK_RELEASE`
fi
if [ -f $WORKSPACE/../DOCKER_REGISTRY ]; then
    DOCKER_REG=`cat $WORKSPACE/../DOCKER_REGISTRY`
fi
BRANCH='dev'
if [ -f $WORKSPACE/../BRANCH ]; then
    BRANCH=`cat $WORKSPACE/../BRANCH`
fi
if [ $1 ]; then
    REL=$1
fi
# if [ -f $WORKSPACE/../LATEST_B2BGW ]; then
#     LATEST_B2BGW=`cat $WORKSPACE/../LATEST_B2BGW`
# fi
# if [ ! $LATEST_B2BGW ]; then
#     echo "****************************************************"
#     echo "datanimbus.io.bm :: Please Build B2BGW 1st."
#     echo "datanimbus.io.bm :: BUILD FAILED"
#     echo "****************************************************"
#     exit 0
# fi
if [ ! $REL ]; then
    echo "****************************************************"
    echo "datanimbus.io.bm :: Please Create file DATA_STACK_RELEASE with the releaese at $WORKSPACE or provide it as 1st argument of this script."
    echo "datanimbus.io.bm :: BUILD FAILED"
    echo "****************************************************"
    exit 0
fi
TAG=$REL
if [ $2 ]; then
    TAG=$TAG"-"$2
fi
if [ $3 ]; then
    BRANCH=$3
fi
if [ $CICD ]; then
    echo "****************************************************"
    echo "datanimbus.io.bm :: CICI env found"
    echo "****************************************************"
    TAG=$TAG"_"$cDate
    if [ ! -f $WORKSPACE/../DATA_STACK_NAMESPACE ]; then
        echo "****************************************************"
        echo "datanimbus.io.bm :: Please Create file DATA_STACK_NAMESPACE with the namespace at $WORKSPACE"
        echo "datanimbus.io.bm :: BUILD FAILED"
        echo "****************************************************"
        exit 0
    fi
    DATA_STACK_NS=`cat $WORKSPACE/../DATA_STACK_NAMESPACE`
fi


# echo "****************************************************"
# echo "Building new executables of ds-b2b-agent-watcher"
# echo "****************************************************"
# sh $WORKSPACE/../ds-b2b-agent-watcher/scripts/setup.sh
# sh $WORKSPACE/../ds-b2b-agent-watcher/scripts/build_executables.sh
# cd $WORKSPACE
# echo "****************************************************"
# echo "Building new executables of ds-b2b-agent"
# echo "****************************************************"
# sh $WORKSPACE/../ds-b2b-agent/scripts/setup.sh
# sh $WORKSPACE/../ds-b2b-agent/scripts/build_executables.sh
# cd $WORKSPACE
# echo "****************************************************"
# echo "Building new executables of govault"
# echo "****************************************************"
# sh $WORKSPACE/../govault/scripts/setup.sh
# sh $WORKSPACE/../govault/scripts/build_executables.sh

sh $WORKSPACE/scripts/prepare_yaml.sh $REL $2

cd $WORKSPACE
# echo "****************************************************"
# echo "datanimbus.io.bm :: Removing executables"
# echo "****************************************************"
# rm generatedAgent/exes/*
# rm -rf generatedAgent/sentinels/*
# rm -rf generatedAgent/scriptFiles/*
# echo "****************************************************"
# echo "datanimbus.io.bm :: Copying executables"
# echo "****************************************************"
# cp $WORKSPACE/../ds-b2b-agent/exec/* generatedAgent/exes/ 
# cp $WORKSPACE/../govault/exec/vault-linux-386 generatedAgent/vault/
# cp -r $WORKSPACE/../ds-b2b-agent-watcher/exec/* generatedAgent/sentinels/
# cp -r $WORKSPACE/../ds-b2b-agent-watcher/scriptFiles/* generatedAgent/scriptFiles/
# cp $WORKSPACE/../ds-b2b-agent-watcher/README.md generatedAgent/scriptFiles/

echo "****************************************************"
echo "datanimbus.io.bm :: Using build :: "$TAG
echo "****************************************************"

echo "****************************************************"
echo "datanimbus.io.bm :: Adding IMAGE_TAG in Dockerfile :: "$TAG
echo "****************************************************"
sed -i.bak s#__image_tag__#$TAG# Dockerfile

if [ -f $WORKSPACE/../CLEAN_BUILD_BM ]; then
    echo "****************************************************"
    echo "datanimbus.io.bm :: Doing a clean build"
    echo "****************************************************"
    
    # docker build --no-cache -t datanimbus.io.bm.$TAG --build-arg LATEST_B2BGW=$LATEST_B2BGW --build-arg RELEASE=$REL .
    docker build --no-cache -t datanimbus.io.bm:$TAG --build-arg RELEASE=$REL .
    rm $WORKSPACE/../CLEAN_BUILD_BM


    echo "****************************************************"
    echo "datanimbus.io.bm :: Building Base Image"
    echo "****************************************************"
    
    cd $WORKSPACE/../ds-b2b-base
    docker build --no-cache -t datanimbus.io.b2b.base:$TAG .


    echo "****************************************************"
    echo "datanimbus.io.bm :: Building Faas Image"
    echo "****************************************************"

    cd $WORKSPACE/../ds-faas
    docker build --no-cache -t datanimbus.io.faas.base:$TAG .

    cd $WORKSPACE
    echo "****************************************************"
    echo "datanimbus.io.bm :: Copying deployment files"
    echo "****************************************************"

    if [ $CICD ]; then
        sed -i.bak s#__docker_registry_server__#$DOCKER_REG# bm.yaml
        sed -i.bak s/__release_tag__/"'$REL'"/ bm.yaml
        sed -i.bak s#__release__#$TAG# bm.yaml
        sed -i.bak s#__namespace__#$DATA_STACK_NS# bm.yaml
        sed -i.bak '/imagePullSecrets/d' bm.yaml
        sed -i.bak '/- name: regsecret/d' bm.yaml

        kubectl delete deploy bm -n $DATA_STACK_NS || true # deleting old deployement
        kubectl delete service bm -n $DATA_STACK_NS || true # deleting old service
        #creating bmw deployment
        kubectl create -f bm.yaml
    fi

else
    echo "****************************************************"
    echo "datanimbus.io.bm :: Doing a normal build"
    echo "****************************************************"
    # docker build -t datanimbus.io.bm:$TAG --build-arg LATEST_B2BGW=$LATEST_B2BGW --build-arg RELEASE=$REL .
    docker build -t datanimbus.io.bm:$TAG --build-arg RELEASE=$REL .

    echo "****************************************************"
    echo "datanimbus.io.bm :: Building Base Image"
    echo "****************************************************"
    
    cd $WORKSPACE/../ds-b2b-base
    docker build -t datanimbus.io.b2b.base:$TAG .

    cd $WORKSPACE/../ds-faas
    docker build --no-cache -t datanimbus.io.faas.base:$TAG .

    cd $WORKSPACE

    if [ $CICD ]; then
        if [ $DOCKER_REG ]; then
            kubectl set image deployment/bm bm=$DOCKER_REG/datanimbus.io.bm:$TAG -n $DATA_STACK_NS --record=true
        else 
            kubectl set image deployment/bm bm=datanimbus.io.bm:$TAG -n $DATA_STACK_NS --record=true
        fi
    fi
fi
if [ $DOCKER_REG ]; then
    echo "****************************************************"
    echo "datanimbus.io.bm :: Docker Registry found, pushing image"
    echo "****************************************************"

    docker tag datanimbus.io.bm:$TAG $DOCKER_REG/datanimbus.io.bm:$TAG
    docker push $DOCKER_REG/datanimbus.io.bm:$TAG
    docker tag datanimbus.io.b2b.base:$TAG $DOCKER_REG/datanimbus.io.b2b.base:$TAG
    docker push $DOCKER_REG/datanimbus.io.b2b.base:$TAG
    docker tag datanimbus.io.faas.base:$TAG $DOCKER_REG/datanimbus.io.faas.base:$TAG
    docker push $DOCKER_REG/datanimbus.io.faas.base:$TAG
fi
echo "****************************************************"
echo "datanimbus.io.bm :: BUILD SUCCESS :: datanimbus.io.bm:$TAG"
echo "****************************************************"
echo $TAG > $WORKSPACE/../LATEST_BM
