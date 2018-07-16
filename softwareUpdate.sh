#!/bin/bash
while getopts d:t:s: option
do
case "${option}"
in
d) DEVICE=${OPTARG};;
t) TARGET=${OPTARG};;
s) SOURCE=${OPTARG};;
esac
done
echo $DEVICE
echo $TARGET
echo $SOURCE
wget $SOURCE -P ../arduinoSketch
make -C ../arduinoSketch/
make upload -C ../arduinoSketch/
rm ../arduinoSketch/electricVehicleDebug.ino && rm -rf ../arduinoSketch/build-nano328/
echo "DONE"
