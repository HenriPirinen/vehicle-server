#!/user/bin/env node
"use strict";
exports.__esModule = true;
var https = require("https");
var fs = require("fs");
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
var path = require("path");
var arpScanner = require("arpscan");
// @ts-ignore
var utilities = require("./utilities");
// @ts-ignore
var config = require("./serverCfg");
bluebird.promisifyAll(redis);
// @ts-ignore
process.title = 'regni-server';
var dataObject = {
    'group': [
        { "voltage": [3.3, 3.4, 3.5, 3.6, 3.55, 3.45, 3.35, 3.23], "temperature": [1, 1, 1, 1, 1, 1, 1, 1] },
        { "voltage": [3.3, 3.4, 3.5, 3.6, 3.55, 3.45, 3.35, 3.23], "temperature": [1, 1, 1, 1, 1, 1, 1, 1] },
        { "voltage": [3.3, 3.4, 3.5, 3.6, 3.55, 3.45, 3.35, 3.23], "temperature": [1, 1, 1, 1, 1, 1, 1, 1] },
        { "voltage": [3.3, 3.4, 3.5, 3.6, 3.55, 3.45, 3.35, 3.23], "temperature": [1, 1, 1, 1, 1, 1, 1, 1] },
        { "voltage": [3.3, 3.4, 3.5, 3.6, 3.55, 3.45, 3.35, 3.23], "temperature": [1, 1, 1, 1, 1, 1, 1, 1] },
        { "voltage": [3.3, 3.4, 3.5, 3.6, 3.55, 3.45, 3.35, 3.23], "temperature": [1, 1, 1, 1, 1, 1, 1, 1] },
        { "voltage": [3.3, 3.4, 3.5, 3.6, 3.55, 3.45, 3.35, 3.23], "temperature": [1, 1, 1, 1, 1, 1, 1, 1] },
        { "voltage": [3.3, 3.4, 3.5, 3.6, 3.55, 3.45, 3.35, 3.23], "temperature": [1, 1, 1, 1, 1, 1, 1, 1] },
        { "voltage": [3.3, 3.4, 3.5, 3.6, 3.55, 3.45, 3.35, 3.23], "temperature": [1, 1, 1, 1, 1, 1, 1, 1] },
        { "voltage": [3.3, 3.4, 3.5, 3.6, 3.55, 3.45, 3.35, 3.23], "temperature": [1, 1, 1, 1, 1, 1, 1, 1] } //Group 5 - 9
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
var clientREDIS = redis.createClient(); //Creates new redis client, redis will que commands from client
clientREDIS.on("connect", function () {
    console.log("Redis connected");
});
clientREDIS.set("driverState", "0000"); //Driver, Reverse, Cruiser
clientREDIS.set("groupChargeStatus", "0,0,0,0,0,0,0,0,0,0"); //Group 1, Group 2...
clientREDIS.set("charging", "true");
var sslOptions = {
    key: fs.readFileSync('regni-key.pem'),
    cert: fs.readFileSync('regni-cert.pem')
};
var app = express();
var server = https.createServer(sslOptions, app).listen(443, function () {
    console.log('Server started');
});
/*const server = app.listen(4000, () => { //Start server
    console.log(`Listening port 4000`)
});*/
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});
// @ts-ignore
app.use('/webApp/', express.static(path.join(__dirname, 'webApp')));
app.get('/*', function (req, res) {
    // @ts-ignore
    res.sendFile(path.join(__dirname, 'webApp', 'index.html'));
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
var thermo = new SerialPort(config.port.thermo, {
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
var thermo_input = thermo.pipe(new Delimiter({
    delimiter: "\n"
}));
var clientMQTT = mqtt.connect(config.address.remoteAddress, config.mqttOptions); //MQTT server address and options
clientMQTT.on("connect", function () {
    clientMQTT.subscribe("vehicleData");
    clientMQTT.subscribe("vehicleExternalCommand");
});
clientMQTT.on("message", function (topic, message) {
    if (topic == "vehicleExternalCommand") {
        var _command = message.toString();
        driver_1.write(_command, function (err) {
            if (err) {
                return console.log("Error on write: " + err.message);
            }
        });
    }
});
controller_1_input.on("data", function (data) {
    var input = data.toString();
    if (input.charAt(0) === '$') {
        console.log(input);
        if (input.substring(0, 5) === '$init') {
            controller_1.write("0," + config.limits.serialMax, function (err) {
                if (err) {
                    return console.log("Error on write: " + err.message);
                }
            });
        }
        else if (input.substring(0, 14) === '$!serialCharge') {
            driver_1.write('SC0', function (err) {
                if (err) {
                    return console.log("Error on write: " + err.message);
                }
            });
        }
    }
    else if (utilities.validateJSON(input)) { //Validate message from arduino
        var newData = JSON.parse(input);
        if (newData.type === "data") {
            //console.log("----------------Group " + newData.Group + "--------------------"); //Print pretty table
            for (var i = 0; i < newData.voltage.length; i++) { //voltage.length == temperature.length
                dataObject.group[newData.Group].voltage[i] = newData.voltage[i];
                dataObject.group[newData.Group].temperature[i] = newData.temperature[i];
                //console.log("Voltage " + i + ": " + dataObject.group[newData.Group].voltage[i] + "	  |	  Temperature " + i + ": " + dataObject.group[newData.Group].temperature[i]);
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
            if (newData.name === "balanceStatus") {
                groupChargeStatus[parseInt(newData.value.charAt(0), 10)] = parseInt(newData.value.charAt(1), 10);
                console.log(groupChargeStatus);
            }
            io.sockets.emit("systemState", {
                message: input,
                handle: "Controller_1"
            });
        }
    }
});
controller_2_input.on("data", function (data) {
    var input = data.toString();
    if (input.charAt(0) === '$') {
        console.log(input);
        if (input.substring(0, 5) === '$init') {
            controller_2.write("5," + config.limits.serialMax, function (err) {
                if (err) {
                    return console.log("Error on write: " + err.message);
                }
            });
        }
        else if (input.substring(0, 14) === '$!serialCharge') {
            driver_1.write('SC0', function (err) {
                if (err) {
                    return console.log("Error on write: " + err.message);
                }
            });
        }
    }
    else if (utilities.validateJSON(input)) { //Validate message from arduino
        var newData = JSON.parse(input);
        if (newData.type === "data") {
            //console.log("----------------Group " + newData.Group + "--------------------"); //Print pretty table
            for (var i = 0; i < newData.voltage.length; i++) { //voltage.length == temperature.length
                dataObject.group[newData.Group].voltage[i] = newData.voltage[i];
                dataObject.group[newData.Group].temperature[i] = newData.temperature[i];
                //console.log("Voltage " + i + ": " + dataObject.group[newData.Group].voltage[i] + "	  |	  Temperature " + i + ": " + dataObject.group[newData.Group].temperature[i]);
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
    console.log("Driver: " + input);
    if (input.charAt(0) != "$") { //Send log message to the client
        if (utilities.validateJSON(input)) {
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
                    handle: "Driver",
                    type: 'relayState'
                });
            }
        }
    }
    else { //Get desired gear setting from redis and write it to driver
        switch (input.substring(0, input.length - 1)) { //Ignore \n at the end of input, msg length is 11 characters
            case "$getParams":
                clientREDIS.get("driverState", function (err, reply) {
                    driver_1.write(reply, function (err) {
                        if (err) {
                            return console.log("Error on write: " + err.message);
                        }
                    });
                    var _newState = [];
                    _newState[0] = reply.charAt(0);
                    _newState[1] = reply.charAt(1);
                    _newState[2] = '0';
                    _newState[3] = reply.charAt(3);
                    clientREDIS.set("driverState", _newState.join(''));
                });
                break;
            case "$charging ":
                console.log("Vehicle is charging...");
                controller_1.write('C1', function (err) {
                    if (err) {
                        return console.log("Error on write: " + err.message);
                    }
                });
                controller_2.write('C1', function (err) {
                    if (err) {
                        return console.log("Error on write: " + err.message);
                    }
                });
                io.sockets.emit("systemState", {
                    message: JSON.stringify({ origin: "Driver", param: "isCharging", value: true }),
                    handle: "Driver",
                    type: 'charging'
                });
                break;
            case "$!charging":
                console.log("Charging completed");
                controller_1.write('C0', function (err) {
                    if (err) {
                        return console.log("Error on write: " + err.message);
                    }
                });
                controller_2.write('C0', function (err) {
                    if (err) {
                        return console.log("Error on write: " + err.message);
                    }
                });
                io.sockets.emit("systemState", {
                    message: JSON.stringify({ origin: "Driver", param: "isCharging", value: false }),
                    handle: "Driver",
                    type: 'charging'
                });
                io.sockets.emit("systemState", {
                    message: JSON.stringify({ origin: "Driver", param: "isBalancing", value: false }),
                    handle: "Driver",
                    type: 'charging'
                });
                break;
            case "$B1":
                console.log("Start balance");
                controller_1.write('$B1', function (err) {
                    if (err) {
                        return console.log("Error on write: " + err.message);
                    }
                });
                controller_2.write('$B1', function (err) {
                    if (err) {
                        return console.log("Error on write: " + err.message);
                    }
                });
                io.sockets.emit("systemState", {
                    message: JSON.stringify({ origin: "Driver", param: "isBalancing", value: true }),
                    handle: "Driver",
                    type: 'charging'
                });
                break;
            default:
                console.log("Invalid request from the driver: " + input);
        }
    }
});
thermo_input.on("data", function (data) {
    var _input = data.toString();
    if (_input.charAt(0) !== '$') {
        if (utilities.validateJSON(_input)) {
            var _data = JSON.parse(_input);
            if (_data.type === 'measurement') {
                io.sockets.emit("dataset", {
                    message: _input,
                    handle: "Thermo"
                });
            }
            else if (_data.type === 'measurement') {
                console.log(_input);
            }
        }
    }
    else {
        if (_input.substring(0, 5) === '$init') {
            thermo.write((config.limits.thermoMax).toString(), function (err) {
                if (err) {
                    return console.log("Error on write: " + err.message);
                }
            });
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
    var options = {
        command: 'arp-scan',
        interface: 'wlan0',
        sudo: true
    };
    arpScanner(onResult, options); //Find inverter IP address.
    function onResult(err, data) {
        var inverterIpAdress = '';
        if (err)
            throw err;
        for (var i = 0; i < data.length; i++) {
            if (data[i].mac === '5C:CF:7F:8E:26:00') {
                inverterIpAdress = data[i].ip;
            }
        }
        fetch("http://" + inverterIpAdress + "/cmd?cmd=json")
            .then(function (res) { return res.json(); })
            .then(function (invResult) {
            console.log(JSON.stringify(invResult));
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
                        groupChargeStatus: groupChargeStatus,
                        thermoDevice: config.port.thermo,
                        temperatureLimit: config.limits.thermoMax,
                        voltageLimit: config.limits.serialMax,
                        isCharging: false,
                        inverterValues: JSON.stringify(invResult)
                    }),
                    handle: "Server"
                });
            });
        }, function (error) {
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
                        groupChargeStatus: groupChargeStatus,
                        thermoDevice: config.port.thermo,
                        temperatureLimit: config.limits.thermoMax,
                        voltageLimit: config.limits.serialMax,
                        isCharging: false,
                        inverterValues: JSON.stringify({ def: error })
                    }),
                    handle: "Server"
                });
            });
        });
    }
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
                if (data.type === 'instant') {
                    driver_1.write(data.command, function (err) {
                        if (err) {
                            return console.log("Error on write: " + err.message);
                        }
                    });
                }
                else {
                    clientREDIS.set("driverState", data.command); //Driver, Reverse, Cruiser, Waterpump
                }
                break;
        }
        ;
    });
    socket.on('reconfigure', function (data) {
        child_process_1.exec("sudo bash /home/pi/Public/nodeServer/restart.sh " + data.weather + " " + data.map + " " + data.address + " " + data.controller1port + " " + data.controller2port + " " + data.driverPort + " " + data.interval * 60000 + " " + data.voltageLimit + " " + data.temperatureLimit + "  " + data.thermoDevice, function (err, stdout, stderr) {
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
