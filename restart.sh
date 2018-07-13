#!/bin/bash
weatherKey=$1
mapKey=$2
address=$3
controller1=$4
controller2=$5
driver=$6
interval=$7
if [[ -n $weatherKey  ]];
then
cat >/home/pi/Public/nodeServer/serverCfg.js <<EOL
module.exports = {
    api: {
       	weather: "$weatherKey",
        maps: "$mapKey"
    },
    port: {
        controllerPort_1: "$controller1",
        controllerPort_2: "$controller2",
        driverPort: "$driver"
    },
    address: {
        remoteAddress: '$address'
    },
    interval: $interval
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

