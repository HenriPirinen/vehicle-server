#!/bin/bash
while getopts t:s:a: option
do
case "${option}"
in
t) TARGET=${OPTARG};;
s) SOURCE=${OPTARG};;
a) ACTION=${OPTARG};;
esac
done
echo $TARGET
echo $SOURCE
echo $ACTION
case "${TARGET}"
in
	microcontroller)
		echo "Check microcontroller updates";;
	ui)
		echo "Check ui updates"
		cd ../vehicle-ui/
		UPSTREAM=${1:-'@{u}'}
		LOCAL=$(git rev-parse @)
		REMOTE=$(git rev-parse "$UPSTREAM")
		BASE=$(git merge-base @ "$UPSTREAM")
		if [ $LOCAL = $REMOTE ]; then
			echo "Up-to-date"
		elif [ $LOCAL = $BASE ]; then
			echo "Update available"
		elif [ $REMOTE = $BASE ]; then
			echo "Ahead"
		else
			echo "Diverged"
		fi
		git status -uno  && cd ../nodeServer/
		;;
	server)
		echo "Check server updates";;
	*)
		echo "Invalid target";;
esac
#wget $SOURCE -P ../arduinoSketch
#make -C ../arduinoSketch/
#make upload -C ../arduinoSketch/
#rm ../arduinoSketch/electricVehicleDebug.ino && rm -rf ../arduinoSketch/build-nano328/
echo "DONE"
