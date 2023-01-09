#!/bin/bash

set -e

cDate=`date +%Y.%m.%d.%H.%M`



TAG=$RELEASE"_"$cDate
if [ $tag == 'dev' || $tag == 'main' || $tag == 'vNext' ]; then

    echo "****************************************************"
    echo "data.stack:bm :: Default Tag Found, Creating new TAG :: $TAG"
    echo "****************************************************"

    echo $TAG > CURRENT_BM

else
    echo "****************************************************"
    echo "data.stack:bm :: User's Tag Found :: $tag"
    echo "****************************************************"

    echo $tag > CURRENT_BM
fi