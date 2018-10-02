#!/bin/bash
#checkForUpdates () {
#	cd $1
#	UPSTREAM=${1:-'@{u}'}
#	LOCAL=$(git rev-parse @)
#	REMOTE=$(git rev-parse "$UPSTREAM")
#	BASE=$(git merge-base @ origin/master)
#	if [ $LOCAL = $REMOTE ]; then
#		echo "Up-to-date"
#	elif [ $LOCAL = $BASE ]; then
#		echo "Update available"
#	elif [ $REMOTE = $BASE ]; then
#		echo "Ahead"
#	else
#		echo "Diverged"
#	fi
#	cd ../nodeServer/
#}
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
 		echo "### CONTROLLER UPDATE ###"
		cd /home/pi/Public/controllers/
		sudo -u pi git pull origin master
                sed -i '2s/.*/ARDUINO_PORT = \/dev\/controller.1/' Makefile
                make upload #>> /home/pi/Public/nodeServer/log
                rm -rf build-nano328/
                sed -i '2s/.*/ARDUINO_PORT = \/dev\/controller.2/' Makefile
                make upload #>> /home/pi/Public/nodeServer/log
                rm -rf build-nano328/
		#nodepid=$(pidof regni-server)
                #sudo kill -15 $nodepid
                #sudo -u pi node /home/pi/Public/nodeServer/index.js successfull #>> /home/pi/Public/nodeServer/nodelog
		sudo systemctl restart regni-server.service
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
		#nodepid=$(pidof regni-server)
		#sudo kill -15 pidof $nodepid
		#sudo -u pi node /home/pi/Public/nodeServer/index.js successfull #>> /home/pi/Public/nodeServer/nodelog
		sudo systemctl restart regni-server.service
		;;
	driver)
		echo "### DRIVER UPDATE ###" #>> /home/pi/Public/nodeServer/log1
		cd /home/pi/Public/vehicle-driver/driver/
		sudo -u pi git pull origin master #>> /home/pi/Public/nodeServer/log1
                make upload #>> /home/pi/Public/nodeServer/log
                rm -rf build-nano328/
		#nodepid=$(pidof regni-server)
                #sudo kill -15 $nodepid
                #sudo -u pi node /home/pi/Public/nodeServer/index.js successfull #>> /home/pi/Public/nodeServer/nodelog
		sudo systemctl restart regni-server.service
		;;
	*)
		echo "Invalid target";;
esac
echo "DONE"
exit 0
