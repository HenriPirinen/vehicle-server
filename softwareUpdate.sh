#!/bin/bash
for i
do
	case "$i"
	in
		microcontroller)
 			echo "### CONTROLLER UPDATE ###"
			cd /home/pi/Public/controllers/
			sudo -u pi git pull origin master
                	sed -i '2s/.*/ARDUINO_PORT = \/dev\/controller.1/' Makefile
                	make upload
                	rm -rf build-nano328/
                	sed -i '2s/.*/ARDUINO_PORT = \/dev\/controller.2/' Makefile
                	make upload
                	rm -rf build-nano328/
			;;
		server)
			echo "### SERVER UPDATE ###"
			cd /home/pi/Public/nodeServer/
			sudo -u pi git pull origin master
			;;
		driver)
			echo "### DRIVER UPDATE ###"
			cd /home/pi/Public/vehicle-driver/driver/
			sudo -u pi git pull origin master
                	make upload
                	rm -rf build-nano328/
			;;
		thermo)
			echo "### THERMO UPDATE ###"
			cd /home/pi/Public/vehicle-thermo/
			sudo -u pi git pull origin master
			make upload
			rm -rf build-nano328/
			;;
		*)
			echo "<<< INVALID DEVICE >>>"
			;;
	esac
done
sudo systemctl restart regni-server.service
echo "--- UPDATE COMPLETED ---"
exit 0
