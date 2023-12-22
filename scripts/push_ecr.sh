#!/bin/bash

set -e

TAG=`cat CURRENT_BM`


echo "****************************************************"
echo "datanimbus.io.bm :: Pushing Image to ECR :: $ECR_URL/datanimbus.io.bm:$TAG"
echo "****************************************************"

$(aws ecr get-login --no-include-email)
docker tag datanimbus.io.bm:$TAG $ECR_URL/datanimbus.io.bm:$TAG
docker push $ECR_URL/datanimbus.io.bm:$TAG


echo "****************************************************"
echo "datanimbus.io.bm :: Image pushed to ECR AS $ECR_URL/datanimbus.io.bm:$TAG"
echo "****************************************************"

docker tag datanimbus.io.b2b.base:$TAG $ECR_URL/datanimbus.io.b2b.base:$TAG
docker push $ECR_URL/datanimbus.io.b2b.base:$TAG

echo "****************************************************"
echo "datanimbus.io.bm :: Image pushed to ECR AS $ECR_URL/datanimbus.io.b2b.base:$TAG"
echo "****************************************************"

docker tag datanimbus.io.faas.base:$TAG $ECR_URL/datanimbus.io.faas.base:$TAG
docker push $ECR_URL/datanimbus.io.faas.base:$TAG

echo "****************************************************"
echo "datanimbus.io.bm :: Image pushed to ECR AS $ECR_URL/datanimbus.io.faas.base:$TAG"
echo "****************************************************"