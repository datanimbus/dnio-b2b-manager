#!/bin/bash

set -e

TAG=`cat CURRENT_BM`

echo "****************************************************"
echo "datanimbus.io.bm :: Saving Image to AWS S3 :: $S3_BUCKET/stable-builds"
echo "****************************************************"

TODAY_FOLDER=`date ++%Y_%m_%d`

docker save -o datanimbus.io.bm_$TAG.tar datanimbus.io.bm:$TAG
bzip2 datanimbus.io.bm_$TAG.tar
aws s3 cp datanimbus.io.bm_$TAG.tar.bz2 s3://$S3_BUCKET/stable-builds/$TODAY_FOLDER/datanimbus.io.bm_$TAG.tar.bz2
rm datanimbus.io.bm_$TAG.tar.bz2

echo "****************************************************"
echo "datanimbus.io.bm :: Image Saved to AWS S3 AS datanimbus.io.bm_$TAG.tar.bz2"
echo "****************************************************"

docker save -o datanimbus.io.b2b.base_$TAG.tar datanimbus.io.b2b.base:$TAG
bzip2 datanimbus.io.b2b.base_$TAG.tar
aws s3 cp datanimbus.io.b2b.base_$TAG.tar.bz2 s3://$S3_BUCKET/stable-builds/$TODAY_FOLDER/datanimbus.io.b2b.base_$TAG.tar.bz2
rm datanimbus.io.b2b.base_$TAG.tar.bz2

echo "****************************************************"
echo "datanimbus.io.bm :: Image Saved to AWS S3 AS datanimbus.io.b2b.base_$TAG.tar.bz2"
echo "****************************************************"

docker save -o datanimbus.io.faas.base_$TAG.tar datanimbus.io.faas.base:$TAG
bzip2 datanimbus.io.faas.base_$TAG.tar
aws s3 cp datanimbus.io.faas.base_$TAG.tar.bz2 s3://$S3_BUCKET/stable-builds/$TODAY_FOLDER/datanimbus.io.faas.base_$TAG.tar.bz2
rm datanimbus.io.faas.base_$TAG.tar.bz2

echo "****************************************************"
echo "datanimbus.io.bm :: Image Saved to AWS S3 AS datanimbus.io.faas.base_$TAG.tar.bz2"
echo "****************************************************"