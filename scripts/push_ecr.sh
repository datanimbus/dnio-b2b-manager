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

docker tag data.stack.b2b.base:$TAG $ECR_URL/data.stack.b2b.base:$TAG
docker push $ECR_URL/data.stack.b2b.base:$TAG

echo "****************************************************"
echo "data.stack:bm :: Image pushed to ECR AS $ECR_URL/data.stack.b2b.base:$TAG"
echo "****************************************************"

docker tag data.stack.faas.base:$TAG $ECR_URL/data.stack.faas.base:$TAG
docker push $ECR_URL/data.stack.faas.base:$TAG

echo "****************************************************"
echo "data.stack:bm :: Image pushed to ECR AS $ECR_URL/data.stack.faas.base:$TAG"
echo "****************************************************"