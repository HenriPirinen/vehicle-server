#!/bin/bash
echo "Restart server"
nodepid=$(sudo netstat -lpn | grep :4000 | cut -c81-84)
echo "Stopping PID : "$nodepid
kill -9 $nodepid
echo "Done"
#node /home/pi/Public/nodeServer/index.js