"use strict";
exports.__esModule = true;
var express = require("express");
var socket = require("socket.io");
var redis = require("redis");
var mqtt = require("mqtt");
var SerialPort = require("serialport");
var Delimiter = require("parser-delimiter");
var fetch = require("node-fetch");
var process = require("process");
var bluebird = require("bluebird");
var child_process_1 = require("child_process");
// @ts-ignore
var utilities = require("./utilities");
// @ts-ignore
var config = require("./serverCfg");
bluebird.promisifyAll(redis);
// @ts-ignore
process.title = 'regni-server';
var dataObject = {
    'group': [
        { "voltage": [1, 1, 1, 1, 1, 1, 1, 1], "temperature": [1, 1, 1, 1, 1, 1, 1, 1] },
        { "voltage": [1, 1, 1, 1, 1, 1, 1, 1], "temperature": [1, 1, 1, 1, 1, 1, 1, 1] },
        { "voltage": [1, 1, 1, 1, 1, 1, 1, 1], "temperature": [1, 1, 1, 1, 1, 1, 1, 1] },
        { "voltage": [1, 1, 1, 1, 1, 1, 1, 1], "temperature": [1, 1, 1, 1, 1, 1, 1, 1] },
        { "voltage": [1, 1, 1, 1, 1, 1, 1, 1], "temperature": [1, 1, 1, 1, 1, 1, 1, 1] },
        { "voltage": [1, 1, 1, 1, 1, 1, 1, 1], "temperature": [1, 1, 1, 1, 1, 1, 1, 1] },
        { "voltage": [1, 1, 1, 1, 1, 1, 1, 1], "temperature": [1, 1, 1, 1, 1, 1, 1, 1] },
        { "voltage": [1, 1, 1, 1, 1, 1, 1, 1], "temperature": [1, 1, 1, 1, 1, 1, 1, 1] },
        { "voltage": [1, 1, 1, 1, 1, 1, 1, 1], "temperature": [1, 1, 1, 1, 1, 1, 1, 1] },
        { "voltage": [1, 1, 1, 1, 1, 1, 1, 1], "temperature": [1, 1, 1, 1, 1, 1, 1, 1] } //Group 5 - 9
    ]
};
/**
 * @param {integer array} groupChargeStatus
 * When server starts, all pins are set to zero on controller. (New serial connection will reset controller)
 * This variable is required when client reloads UI. By default every group is set to 0 on UI startup.
 * Variable is updated when JSON response from controller has param "balanceStatus".
 */
//Move to redis
var groupChargeStatus = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
var clientMQTT = mqtt.connect("mqtt://" + config.address.remoteAddress, config.mqttOptions); //MQTT server address and options
clientMQTT.on("connect", function () {
    clientMQTT.subscribe("vehicleData");
    clientMQTT.subscribe("vehicleExternalCommand");
});
clientMQTT.on("message", function (topic, message) {
    if (topic !== "vehicleData") { } //console.log(message.toString());
});
var clientREDIS = redis.createClient(); //Creates new redis client, redis will que commands from client
clientREDIS.on("connect", function () {
    console.log("Redis connected");
});
clientREDIS.set("driverState", "0000"); //Driver, Reverse, Cruiser, Waterpump
clientREDIS.set("groupChargeStatus", "0,0,0,0,0,0,0,0,0,0"); //Group 1, Group 2...
clientREDIS.set("charging", "true");
var app = express();
var server = app.listen(4000, function () {
    console.log("Listening port 4000 @ localhost");
    console.log("MQTT is subscribed to \"vehicleData\" & \"vehicleExternalCommand\"");
});
var io = socket(server);
var controller_1 = new SerialPort(config.port.controllerPort_1, {
    baudRate: 9600
});
var controller_2 = new SerialPort(config.port.controllerPort_2, {
    baudRate: 9600
});
var driver_1 = new SerialPort(config.port.driverPort, {
    baudRate: 9600
});
var controller_1_input = controller_1.pipe(new Delimiter({
    delimiter: "\n"
}));
var controller_2_input = controller_2.pipe(new Delimiter({
    delimiter: "\n"
}));
var driver_1_input = driver_1.pipe(new Delimiter({
    delimiter: "\n"
}));
controller_1_input.on("data", function (data) {
    var input = data.toString();
    if (input.charAt(0) === '$') {
        console.log('Controller 1 request');
        controller_1.write('0', function (err) {
            if (err) {
                return console.log("Error on write: " + err.message);
            }
        });
    }
    else if (utilities.validateJSON(input)) { //Validate message from arduino
        var newData = JSON.parse(input);
        if (newData.type === "data") {
            console.log("----------------Group " + newData.Group + "--------------------"); //Print pretty table
            for (var i = 0; i < newData.voltage.length; i++) { //voltage.length == temperature.length
                dataObject.group[newData.Group].voltage[i] = newData.voltage[i];
                dataObject.group[newData.Group].temperature[i] = newData.temperature[i];
                console.log("Voltage " + i + ": " + dataObject.group[newData.Group].voltage[i] + "	  |	  Temperature " + i + ": " + dataObject.group[newData.Group].temperature[i]);
            }
            io.sockets.emit("dataset", {
                message: input,
                handle: "Controller_1"
            });
        }
        else if (newData.type === "log") {
            io.sockets.emit("systemLog", {
                message: input,
                handle: "Controller_1"
            });
        }
        else if (newData.type === "param") {
            io.sockets.emit("systemState", {
                message: input,
                handle: "Controller_1"
            });
            if (newData.name === "balanceStatus") {
                var groupChargeStatus_1;
                groupChargeStatus_1[parseInt(newData.value.charAt(0), 10)] = parseInt(newData.value.charAt(1), 10);
                console.log(groupChargeStatus_1);
            }
        }
    }
});
controller_2_input.on("data", function (data) {
    var input = data.toString();
    if (input.charAt(0) === '$') {
        console.log('Controller 2 request');
        controller_2.write('5', function (err) {
            if (err) {
                return console.log("Error on write: " + err.message);
            }
        });
    }
    else if (utilities.validateJSON(input)) { //Validate message from arduino
        var newData = JSON.parse(input);
        if (newData.type === "data") {
            console.log("----------------Group " + newData.Group + "--------------------"); //Print pretty table
            for (var i = 0; i < newData.voltage.length; i++) { //voltage.length == temperature.length
                dataObject.group[newData.Group].voltage[i] = newData.voltage[i];
                dataObject.group[newData.Group].temperature[i] = newData.temperature[i];
                console.log("Voltage " + i + ": " + dataObject.group[newData.Group].voltage[i] + "	  |	  Temperature " + i + ": " + dataObject.group[newData.Group].temperature[i]);
            }
            io.sockets.emit("dataset", {
                message: input,
                handle: "Controller_2"
            });
        }
        else if (newData.type === "log") {
            io.sockets.emit("systemLog", {
                message: input,
                handle: "Controller_2"
            });
        }
        else if (newData.type === "param") {
            if (newData.name === "balanceStatus") {
                groupChargeStatus[parseInt(newData.value.charAt(0), 10) + 5] = parseInt(newData.value.charAt(1), 10);
                console.log(groupChargeStatus);
            }
            io.sockets.emit("systemState", {
                message: input,
                handle: "Controller_2"
            });
        }
    }
});
driver_1_input.on("data", function (data) {
    var input = data.toString();
    if (input.charAt(0) != "$") { //Send log message to the client
        var _params = JSON.parse(input);
        if (_params.type === "log") {
            io.sockets.emit("systemLog", {
                message: input,
                handle: "Driver"
            });
        }
        else if (_params.type === "param") {
            clientREDIS.set(_params.name, _params.value);
            io.sockets.emit("systemState", {
                message: input,
                handle: "Driver"
            });
        }
    }
    else { //Get desired gear setting from redis and write it to driver
        console.log("Request from the driver: " + input);
        switch (input.substring(0, 10)) { //Ignore \n at the end of input, msg length is 11 characters
            case "$getParams":
                clientREDIS.get("driverState", function (err, reply) {
                    driver_1.write(reply, function (err) {
                        if (err) {
                            return console.log("Error on write: " + err.message);
                        }
                    });
                });
                break;
            case "$charging ":
                console.log("Set charging to 1");
                break;
            case "$!charging":
                console.log("Set charging to 0");
                break;
            default:
                console.log("Invalid request from the driver: " + input);
        }
    }
});
io.on("connection", function (socket) {
    if (process.argv[2] !== undefined) { //If server starts with argument i.e after software update.
        socket.emit("systemState", {
            message: JSON.stringify({ message: process.argv[2] }),
            handle: "Server"
        });
    }
    utilities.getParam(clientREDIS, "driverState").then(function (result) {
        socket.emit("systemParam", {
            message: JSON.stringify({
                weatherAPI: config.api.weather,
                mapAPI: config.api.maps,
                remoteAddress: config.address.remoteAddress,
                controller_1: config.port.controllerPort_1,
                controller_2: config.port.controllerPort_2,
                driverPort: config.port.driverPort,
                driverState: result[0],
                remoteUpdateInterval: config.interval / 60000,
                groupChargeStatus: groupChargeStatus
            }),
            handle: "Server"
        });
    });
    socket.on("command", function (data) {
        switch (data.target) {
            case "controller_1":
                console.log(data.target);
                console.log(data.command);
                controller_1.write(data.command, function (err) {
                    if (err) {
                        return console.log("Error on write: " + err.message);
                    }
                    else {
                        socket.emit("systemLog", {
                            message: JSON.stringify({ origin: "Server", msg: "Command to 1st. controller: " + data.command, importance: "Medium" }),
                            handle: "Server"
                        });
                    }
                });
                break;
            case "controller_2":
                console.log(data.target);
                console.log(data.command);
                controller_2.write(data.command, function (err) {
                    if (err) {
                        return console.log("Error on write: " + err.message);
                    }
                    else {
                        socket.emit("systemLog", {
                            message: JSON.stringify({ origin: "Server", msg: "Command to 2nd. controller: " + data.command, importance: "Medium" }),
                            handle: "Server"
                        });
                    }
                });
                break;
            case "inverter":
                fetch("http://192.168.1.33/cmd?cmd=" + data.command)
                    .then(function (res) { return res.json(); })
                    .then(function (result) {
                    socket.emit("inverterResponse", {
                        message: JSON.stringify(result),
                        handle: "Server"
                    });
                }, function (result) {
                    socket.emit("inverterResponse", {
                        message: result.toString(),
                        handle: "Server"
                    });
                });
                break;
            case "server":
                child_process_1.exec(data.command, function (err, stdout, stderr) {
                    if (err) {
                        console.log(err);
                        return;
                    }
                });
                break;
            case "driver":
                console.log(data.command);
                clientREDIS.set("driverState", data.command); //Driver, Reverse, Cruiser, Waterpump
                break;
        }
        ;
    });
    socket.on('reconfigure', function (data) {
        child_process_1.exec("sudo bash /home/pi/Public/nodeServer/restart.sh " + data.weather + " " + data.map + " " + data.address + " " + data.controller1port + " " + data.controller2port + " " + data.driverPort + " " + data.interval * 60000, function (err, stdout, stderr) {
            if (err) {
                console.log(stderr);
                return;
            }
        });
    });
    socket.on("update", function (command) {
        console.log(command.target);
        child_process_1.exec("sudo bash /home/pi/Public/nodeServer/softwareUpdate.sh -t " + command.target + " -a update", function (err, stdout, stderr) {
            if (err) {
                console.log(stderr);
                return;
            }
        });
    });
});
setInterval(function () {
    utilities.uploadData(clientMQTT, dataObject);
}, config.interval);
