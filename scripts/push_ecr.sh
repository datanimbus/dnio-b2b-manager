#!/bin/bash

set -e

TAG=`cat CURRENT_BM`


echo "****************************************************"
echo "data.stack:bm :: Pushing Image to ECR :: $ECR_URL/data.stack.bm:$TAG"
echo "****************************************************"

aws ecr get-login --no-include-email
docker tag data.stack.bm:$TAG $ECR_URL/data.stack.bm:$TAG
docker push $ECR_URL/data.stack.bm:$TAG


echo "****************************************************"
echo "data.stack:bm :: Image pushed to ECR AS $ECR_URL/data.stack.bm:$TAG"
echo "****************************************************"