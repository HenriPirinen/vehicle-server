#!/bin/bash
weatherKey=$1
mapKey=$2
address=$3
controller1=$4
controller2=$5
driver=$6
interval=$7
serialMax=$8
thermoMax=$9
thermoDevice=${10}
mqttUName=${11}
mqttPWord=${12}
if [[ -n $weatherKey  ]]; #If params exist, reconfigure. Otherwise proceed to start / restart
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
        driverPort: "$driver",
	thermo: "$thermoDevice"
    },
    address: {
        remoteAddress: '$address'
    },
    interval: $interval,
    mqttOptions:{
	port: 23664,
        host: '$address',
        clientId: 'mqttjs_' + Math.random().toString(16).substr(2, 8),
        username: "$mqttUName",
        password: "$mqttPWord",
        keepalive: 60,
        reconnectPeriod: 1000,
        protocolId: 'MQTT',
        protocolVersion: 4,
        clean: true,
    },
    limits:{
        thermoMax: "$thermoMax",
        serialMax: "$serialMax" //At this point, change serial charge to balance. I.e. 370 = 3.70V
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

