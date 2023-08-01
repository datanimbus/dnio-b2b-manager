#!/bin/bash

set -e

TAG=`cat CURRENT_BM`


echo "****************************************************"
echo "datanimbus.io.bm :: Deploying Image in K8S :: $NAMESPACE"
echo "****************************************************"

kubectl set image deployment/bm bm=$ECR_URL/datanimbus.io.bm:$TAG -n $NAMESPACE --record=true


echo "****************************************************"
echo "datanimbus.io.bm :: Image Deployed in K8S AS $ECR_URL/datanimbus.io.bm:$TAG"
echo "****************************************************"