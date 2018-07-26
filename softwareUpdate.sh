#!/bin/bash
checkForUpdates () {
	cd $1
	UPSTREAM=${1:-'@{u}'}
	LOCAL=$(git rev-parse @)
	REMOTE=$(git rev-parse "$UPSTREAM")
	BASE=$(git merge-base @ origin/master)
	if [ $LOCAL = $REMOTE ]; then
		echo "Up-to-date"
	elif [ $LOCAL = $BASE ]; then
		echo "Update available"
	elif [ $REMOTE = $BASE ]; then
		echo "Ahead"
	else
		echo "Diverged"
	fi
	cd ../nodeServer/
}

updateMicro () {
#$1 path to micro directory
	cd $1
	sudo -u pi git pull origin master
	make upload
	rm -rf build-nano328/
	cd ../nodeServer/
	nodepid=$(pidof regni-server)
	echo "Restarting server"
	sudo kill -15 $nodepid
	node /home/pi/Public/nodeServer/index.js
}
while getopts t:a: option
do
case "${option}"
in
t) TARGET=${OPTARG};;
a) ACTION=${OPTARG};;
esac
done
echo $TARGET
echo $ACTION
case "${TARGET}"
in
	microcontroller)
		echo "Update controller"
		#checkForUpdates ../arduinoSketch/
		#updateMicro
		#cd ../controller_1/
		#pull
		#make
		#make upload
		#rm build
		#cd ../controller_2/
		#pull
		#make
		#make upload
		#rm buil
		#cd ../nodeServer/
		;;
	ui)
		echo "Update UI"
		#checkForUpdates ../vehicle-ui/
		cd ../vehicle-ui/
		sudo -u pi git pull origin master #Get latest version from github
		cd ../nodeServer/
		;;
	server)
		echo "Update server"
		#checkForUpdates ../nodeServer/
		sudo -u pi git pull origin master
		;;
	driver)
		echo "Update driver"
		updateMicro ../vehicle-driver/driver/
		;;
	*)
		echo "Invalid target";;
esac
#wget $SOURCE -P ../arduinoSketch
#make -C ../arduinoSketch/
#make upload -C ../arduinoSketch/
#rm ../arduinoSketch/electricVehicleDebug.ino && rm -rf ../arduinoSketch/build-nano328/
echo "DONE"
