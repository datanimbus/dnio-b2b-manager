#!/bin/bash

echo "****************************************************"
echo "data.stack:bm :: Copying yaml file "
echo "****************************************************"
if [ ! -d $WORKSPACE/../yamlFiles ]; then
    mkdir $WORKSPACE/../yamlFiles
fi

REL=$1
if [ $2 ]; then
    REL=$REL-$2
fi

rm -rf $WORKSPACE/../yamlFiles/bm.*
cp $WORKSPACE/bm.yaml $WORKSPACE/../yamlFiles/bm.$REL.yaml
cd $WORKSPACE/../yamlFiles/
echo "****************************************************"
echo "data.stack:bm :: Preparing yaml file "
echo "****************************************************"
sed -i.bak s/__release_tag__/"'$1'"/ bm.$REL.yaml
sed -i.bak s/__release__/$REL/ bm.$REL.yaml