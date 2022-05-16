#!/bin/bash

set -e

TAG=`cat CURRENT_BM`

echo "****************************************************"
echo "data.stack:bm :: Saving Image to AWS S3 :: $S3_BUCKET/stable-builds"
echo "****************************************************"

TODAY_FOLDER=`date ++%Y_%m_%d`

docker save -o data.stack.bm_$TAG.tar data.stack.bm:$TAG
bzip2 data.stack.bm_$TAG.tar
aws s3 cp data.stack.bm_$TAG.tar.bz2 s3://$S3_BUCKET/stable-builds/$TODAY_FOLDER/data.stack.bm_$TAG.tar.bz2
rm data.stack.bm_$TAG.tar.bz2

echo "****************************************************"
echo "data.stack:bm :: Image Saved to AWS S3 AS data.stack.bm_$TAG.tar.bz2"
echo "****************************************************"

docker save -o data.stack.b2b.base_$TAG.tar data.stack.b2b.base:$TAG
bzip2 data.stack.b2b.base_$TAG.tar
aws s3 cp data.stack.b2b.base_$TAG.tar.bz2 s3://$S3_BUCKET/stable-builds/$TODAY_FOLDER/data.stack.b2b.base_$TAG.tar.bz2
rm data.stack.b2b.base_$TAG.tar.bz2

echo "****************************************************"
echo "data.stack:bm :: Image Saved to AWS S3 AS data.stack.b2b.base_$TAG.tar.bz2"
echo "****************************************************"

docker save -o data.stack.faas.base_$TAG.tar data.stack.faas.base:$TAG
bzip2 data.stack.faas.base_$TAG.tar
aws s3 cp data.stack.faas.base_$TAG.tar.bz2 s3://$S3_BUCKET/stable-builds/$TODAY_FOLDER/data.stack.faas.base_$TAG.tar.bz2
rm data.stack.faas.base_$TAG.tar.bz2

echo "****************************************************"
echo "data.stack:bm :: Image Saved to AWS S3 AS data.stack.faas.base_$TAG.tar.bz2"
echo "****************************************************"