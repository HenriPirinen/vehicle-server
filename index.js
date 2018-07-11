"use strict";
exports.__esModule = true;
var express = require("express");
var socket = require("socket.io");
var redis = require("redis");
var mqtt = require("mqtt");
var SerialPort = require("serialport");
var Delimiter = require("parser-delimiter");
var fetch = require("node-fetch");
// @ts-ignore
var config = require("./serverCfg");
var child_process_1 = require("child_process");
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
var clientMQTT = mqtt.connect('mqtt://' + config.address.remoteAddress); //MQTT server address
clientMQTT.on('connect', function () {
    clientMQTT.subscribe('vehicleData');
    clientMQTT.subscribe('vehicleExternalCommand');
});
clientMQTT.on('message', function (topic, message) {
    if (topic !== 'vehicleData') { } //console.log(message.toString());
});
var clientREDIS = redis.createClient(); //Creates new redis client, redis will que commands from client
clientREDIS.on('connect', function () {
    console.log('Redis connected');
});
clientREDIS.set('direction', '0');
var app = express();
var server = app.listen(4000, function () {
    console.log("Listening port 4000 @ localhost");
    console.log("MQTT is subscribed to 'vehicleData & vehicleExternalCommand'");
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
    delimiter: '\n'
}));
var controller_2_input = controller_2.pipe(new Delimiter({
    delimiter: '\n'
}));
var driver_1_input = driver_1.pipe(new Delimiter({
    delimiter: '\n'
}));
controller_1_input.on('data', function (data) {
    var input = data.toString();
    if (validateJSON(input)) { //Validate message from arduino
        var newData = JSON.parse(input);
        //console.log("----------------Group " + newData.Group + "--------------------"); //Print pretty table
        for (var i = 0; i < newData.voltage.length; i++) { //voltage.length == temperature.length
            dataObject.group[newData.Group].voltage[i] = newData.voltage[i];
            dataObject.group[newData.Group].temperature[i] = newData.temperature[i];
            //console.log("Voltage " + i + ": " + dataObject.group[newData.Group].voltage[i] + "	  |	  Temperature " + i + ": " + dataObject.group[newData.Group].temperature[i]);
        }
        io.sockets.emit('dataset', {
            message: input,
            handle: 'Controller 1'
        });
    }
});
controller_2_input.on('data', function (data) {
    var input = data.toString();
    if (validateJSON(input)) { //Validate message from arduino
        var newData = JSON.parse(input);
        //console.log("----------------Group " + newData.Group + "--------------------"); //Print pretty table
        for (var i = 0; i < newData.voltage.length; i++) { //voltage.length == temperature.length
            dataObject.group[newData.Group].voltage[i] = newData.voltage[i];
            dataObject.group[newData.Group].temperature[i] = newData.temperature[i];
            //console.log("Voltage " + i + ": " + dataObject.group[newData.Group].voltage[i] + "	  |	  Temperature " + i + ": " + dataObject.group[newData.Group].temperature[i]);
        }
        io.sockets.emit('dataset', {
            message: input,
            handle: 'Controller 2'
        });
    }
});
driver_1_input.on('data', function (data) {
    var input = data.toString();
    if (input.charAt(0) != '$') { //$ == request from driver
        console.log("Response from the driver " + input);
        io.sockets.emit('driver', {
            message: input,
            handle: 'driver'
        });
    }
    else {
        console.log("Request from the driver: " + input);
        switch (input.substring(0, 10)) { //Ignore \n at the end of input
            case '$getParams':
                clientREDIS.get('direction', function (err, reply) {
                    driver_1.write(reply, function (err) {
                        if (err) {
                            return console.log('Error on write: ', err.message);
                        }
                    });
                });
                break;
            default:
                console.log('Invalid request from the driver: ' + input);
        }
    }
});
io.on('connection', function (socket) {
    socket.emit('webSocket', {
        message: JSON.stringify({ weatherAPI: config.api.weather, mapAPI: config.api.maps, remoteAddress: config.address.remoteAddress }),
        handle: 'Server'
    });
    socket.on('command', function (data) {
        switch (data.target) {
            case "controller_1":
                controller_1.write(data.command, function (err) {
                    if (err) {
                        return console.log('Error on write: ', err.message);
                    }
                    else {
                        socket.emit('serverLog', {
                            message: '{"msg": "Command to controller 1: ' + data.command + '","importance":"Medium"}',
                            handle: 'Server'
                        });
                    }
                });
                break;
            case "controller_2":
                controller_2.write(data.command, function (err) {
                    if (err) {
                        return console.log('Error on write: ', err.message);
                    }
                    else {
                        socket.emit('serverLog', {
                            message: '{"msg": "Command to controller 2: ' + data.command + '","importance":"Medium"}',
                            handle: 'Server'
                        });
                    }
                });
                break;
            case "inverter":
                fetch("http://192.168.1.33/cmd?cmd=" + data.command)
                    .then(function (res) { return res.json(); })
                    .then(function (result) {
                    socket.emit('inverterResponse', {
                        message: JSON.stringify(result),
                        handle: 'Server'
                    });
                }, function (result) {
                    socket.emit('inverterResponse', {
                        message: result.toString(),
                        handle: 'Server'
                    });
                });
                break;
            case "server":
                child_process_1.exec(data.command, function (err, stdout, stderr) {
                    if (err) {
                        console.log("Invalid command");
                        return;
                    }
                    console.log('Server: ' + stdout + '');
                    console.log('Server: ' + stderr + '');
                });
                break;
            case "driver":
                var driverCommand = '0';
                var instantAction = true;
                //Add command type to message
                switch (data.command.toString()) {
                    case 'neutral':
                        instantAction = false;
                        clientREDIS.set('direction', '0');
                        break;
                    case 'reverse':
                        instantAction = false;
                        clientREDIS.set('direction', '1');
                        break;
                    case 'drive':
                        instantAction = false;
                        clientREDIS.set('direction', '2');
                        break;
                    case 'getSettings':
                        instantAction = true;
                        driverCommand = '99';
                        break;
                    default:
                        console.log('Invalid command: ' + data.command.toString());
                        instantAction = false;
                }
                console.log("Command to driver: " + data.command.toString() + "	| instantAction = " + instantAction);
                if (instantAction) {
                    driver_1.write(driverCommand, function (err) {
                        if (err) {
                            return console.log('Error on write: ', err.message);
                        }
                    });
                }
                break;
            default:
                console.log("Invalid target: " + data.target);
        }
    });
    socket.on('update', function (command) {
        switch (command.target) {
            case "arduino":
                socket.emit('serverLog', {
                    message: '{\"msg\":\"Downloading controller update.\",\"importance\":\"High\"}',
                    handle: 'Server'
                });
                console.log('Updating microcontroller...');
                child_process_1.exec('wget http://student.hamk.fi/~henri1515/electricVehicleDebug.ino -P ../arduinoSketch', function (err, stdout, stderr) {
                    if (err) {
                        console.log(stderr);
                        return;
                    }
                    //console.log(stdout);
                    socket.emit('serverLog', {
                        message: '{\"msg\":\"Compiling code.\",\"importance\":\"High\"}',
                        handle: 'Server'
                    });
                    console.log('Download complete. Compiling...');
                    child_process_1.exec('make -C ../arduinoSketch/', function (err, stdout, stderr) {
                        if (err) {
                            console.log(stderr);
                            return;
                        }
                        //console.log(stdout);
                        socket.emit('serverLog', {
                            message: '{\"msg\":\"Uploading code to 1st. controller.\",\"importance\":\"High\"}',
                            handle: 'Server'
                        });
                        console.log('Done compiling. Uploading...');
                        child_process_1.exec('make upload -C ../arduinoSketch/', function (err, stdout, stderr) {
                            if (err) {
                                console.log(stderr);
                                return;
                            }
                            //console.log(stdout);
                            socket.emit('serverLog', {
                                message: '{\"msg\":\"1st. controller update completed.\",\"importance\":\"High\"}',
                                handle: 'Server'
                            });
                            console.log('Microcontroller software update is complete. Cleaning directory...');
                            child_process_1.exec('rm ../arduinoSketch/electricVehicleDebug.ino && rm -rf ../arduinoSketch/build-nano328/', function (err, stdout, stderr) {
                                if (err) {
                                    console.log(stderr);
                                    return;
                                }
                                socket.emit('serverLog', {
                                    message: '{\"msg\":\"Controllers are up-to-date.\",\"importance\":\"High\"}',
                                    handle: 'Server'
                                });
                                //console.log(stdout);
                                console.log('Done!');
                            });
                        });
                    });
                });
                break;
            default:
                console.log("Update");
        }
    });
});
function validateJSON(string) {
    try {
        JSON.parse(string);
    }
    catch (e) {
        //console.log(e);
        return false;
    }
    return true;
}
var uploadData = function () {
    clientMQTT.publish('vehicleData', JSON.stringify(dataObject));
};
setInterval(uploadData, 300000);
