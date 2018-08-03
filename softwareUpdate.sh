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
#$1 path to directory
	cd $1
	sudo -u pi git pull origin master
	if [[ $1 = "/home/pi/Public/controllers/" ]]
	then
		echo "### CONTROLLER UPDATE ###"
              	sed -i '2s/.*/ARDUINO_PORT = \/dev\/controller.1/' Makefile
          	make upload
               	rm -rf build-nano328/
                sed -i '2s/.*/ARDUINO_PORT = \/dev\/controller.2/' Makefile
                make upload
                rm -rf build-nano328/
                nodepid=$(pidof regni-server)
                sudo kill -15 $nodepid
		sudo -u pi node /home/pi/Public/nodeServer/index.js
	else
		echo "### DRIVER UPDATE ###"
                make upload
                rm -rf build-nano328/
                nodepid=$(pidof regni-server)
                sudo kill -15 $nodepid
                sudo -u pi node /home/pi/Public/nodeServer/index.js
	fi
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
		updateMicro /home/pi/Public/controllers/
		#Update Makefile
		updateMicro /home/pi/Public/controllers/
		;;
	ui)
		echo "Update UI"
		#checkForUpdates ../vehicle-ui/
		cd /home/pi/Public/vehicle-ui/
		sudo -u pi git pull origin master #Get latest version from github
		;;
	server)
		echo "Update server"
		#checkForUpdates ../nodeServer/
		cd /home/pi/Public/nodeServer/
		sudo -u pi git pull origin master
		nodepid=$(pidof regni-server)
		sudo kill -15 pidof $nodepid
		;;
	driver)
		echo "Update driver"
		updateMicro /home/pi/Public/vehicle-driver/driver/
		;;
	*)
		echo "Invalid target";;
esac
echo "DONE"
