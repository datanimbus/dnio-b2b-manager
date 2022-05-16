#!/bin/bash

set -e

TAG=`cat CURRENT_BM`


echo "****************************************************"
echo "data.stack:bm :: Deploying Image in K8S :: $NAMESPACE"
echo "****************************************************"

kubectl set image deployment/bm bm=$ECR_URL/data.stack.bm:$TAG -n $NAMESPACE --record=true


echo "****************************************************"
echo "data.stack:bm :: Image Deployed in K8S AS $ECR_URL/data.stack.bm:$TAG"
echo "****************************************************"