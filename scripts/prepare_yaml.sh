#!/bin/bash

set -e

echo "****************************************************"
echo "datanimbus.io.bm :: Copying yaml file "
echo "****************************************************"
if [ ! -d yamlFiles ]; then
    mkdir yamlFiles
fi

TAG=`cat CURRENT_BM`

rm -rf yamlFiles/bm.*
cp bm.yaml yamlFiles/bm.$TAG.yaml
cd yamlFiles/
echo "****************************************************"
echo "datanimbus.io.bm :: Preparing yaml file "
echo "****************************************************"

sed -i.bak s/__release__/$TAG/ bm.$TAG.yaml

echo "****************************************************"
echo "datanimbus.io.bm :: yaml file saved"
echo "****************************************************"