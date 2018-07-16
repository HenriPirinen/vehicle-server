#!/bin/bash
weatherKey=$1
mapKey=$2
address=$3
if [[ -n $weatherKey  ]];
then
cat >/home/pi/Public/nodeServer/serverCfg.js <<EOL
module.exports = {
    api: {
       	weather: "$weatherKey",
        maps: '$mapKey'
    },
    port: {
        controllerPort_1: '/dev/controller.1',
        controllerPort_2: '/dev/controller.2',
        driverPort: '/dev/driver.1'
    },
    address: {
        remoteAddress: '$address'
    }
}
EOL
fi
nodepid=$(pidof regni-server)
if [[ -z $nodepid ]];
then
	echo "Starting server"
	node /home/pi/Public/nodeServer/index.js
else
	echo "Stopping PID: "$nodepid
	kill -15 $nodepid
	echo "Restarting server"
	node /home/pi/Public/nodeServer/index.js
fi
echo "Done"

