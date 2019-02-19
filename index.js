#!/user/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const https = require("https");
const fs = require("fs");
const express = require("express");
const socket = require("socket.io");
const redis = require("redis");
const mqtt = require("mqtt");
const SerialPort = require("serialport");
const Delimiter = require("parser-delimiter");
const fetch = require("node-fetch");
const process = require("process");
const bluebird = require("bluebird");
const child_process_1 = require("child_process");
const path = require("path");
const arpScanner = require("arpscan");
// @ts-ignore
const utilities = require("./utilities");
// @ts-ignore
const config = require("./serverCfg");
// @ts-ignore
const DeviceIO_1 = require("./DeviceIO");
bluebird.promisifyAll(redis);
// @ts-ignore
process.title = 'regni-server';
/**
 * @param {integer array} groupChargeStatus
 * When server starts, all pins are set to zero on controller. (New serial connection will reset controller)
 * This variable is required when client reloads UI. By default every group is set to 0 on UI startup.
 * Variable is updated when JSON response from controller has param "balanceStatus".
 */
//Move to redis
let groupChargeStatus = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
let inverterIpAdress = null;
const options = { command: 'arp-scan', interface: 'wlan0', sudo: true }; //arpScanner options
arpScanner((err, data) => {
    if (err)
        throw err;
    for (let i = 0; i < data.length; i++) { //Search scanner results
        if (data[i].mac === '5C:CF:7F:8E:26:00') {
            inverterIpAdress = data[i].ip;
        }
    }
}, options); //Find inverter IP address.
const clientREDIS = redis.createClient(); //Creates new redis client, redis will que commands from client
clientREDIS.on(`connect`, () => {
    console.log(`Redis connected`);
});
clientREDIS.set(`driverState`, `0000`); //Driver, Reverse, Cruiser
clientREDIS.set(`groupChargeStatus`, `0,0,0,0,0,0,0,0,0,0`); //Group 1, Group 2...
clientREDIS.set(`charging`, `false`);
const sslOptions = {
    key: fs.readFileSync('regni-key.pem'),
    cert: fs.readFileSync('regni-cert.pem')
};
const app = express();
const server = https.createServer(sslOptions, app).listen(443, () => {
    console.log('Serving webbapp on port 443');
});
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
const io = socket(server);
const driver_1 = new SerialPort(config.port.driverPort, {
    baudRate: 9600
});
const thermo = new SerialPort(config.port.thermo, {
    baudRate: 9600
});
const driver_1_input = driver_1.pipe(new Delimiter({
    delimiter: `\n`
}));
const thermo_input = thermo.pipe(new Delimiter({
    delimiter: `\n`
}));
const ctrl_1 = new DeviceIO_1.default({
    port: config.port.controllerPort_1,
    startIdx: 0,
    numOfGroups: 5,
    serialMax: config.limits.serialMax,
    websocket: io,
    redis: clientREDIS,
    serDriver: driver_1
});
const ctrl_2 = new DeviceIO_1.default({
    port: config.port.controllerPort_2,
    startIdx: 5,
    numOfGroups: 5,
    serialMax: config.limits.serialMax,
    websocket: io,
    redis: clientREDIS,
    serDriver: driver_1
});
var clientMQTT = mqtt.connect(config.mqttOptions.host, config.mqttOptions); //MQTT server address and options
clientMQTT.on(`connect`, () => {
    clientMQTT.subscribe(`vehicleData`);
    clientMQTT.subscribe(`vehicleExternalCommand`);
});
clientMQTT.on(`message`, (topic, message) => {
    if (topic == `vehicleExternalCommand`) {
        let _command = message.toString();
        driver_1.write(_command, (err) => {
            if (err) {
                return console.log(`Driver: Error on write: ${err.message}`);
            }
        });
    }
});
driver_1_input.on(`data`, (data) => {
    let input = data.toString();
    if (input.charAt(0) != `$`) { //Send log message to the client
        if (utilities.validateJSON(input)) {
            let _params = JSON.parse(input);
            if (_params.type === `log`) {
                io.sockets.emit(`systemLog`, {
                    message: input,
                    handle: `Driver`
                });
            }
            else if (_params.type === `param`) {
                clientREDIS.set(_params.name, _params.value);
                io.sockets.emit(`systemState`, {
                    message: input,
                    handle: `Driver`,
                    type: 'relayState'
                });
            }
        }
    }
    else { //Get desired gear setting from redis and write it to driver
        switch (input.substring(0, input.length - 1)) { //Ignore \n at the end of input, msg length is 11 characters
            case `$getParams`:
                clientREDIS.get(`driverState`, (err, reply) => {
                    driver_1.write(reply, (err) => {
                        if (err)
                            return console.log(`Driver: Error on write: ${err.message}`);
                    });
                    let _newState = [];
                    _newState[0] = reply.charAt(0);
                    _newState[1] = reply.charAt(1);
                    _newState[2] = '0';
                    _newState[3] = reply.charAt(3);
                    clientREDIS.set(`driverState`, _newState.join(''));
                });
                break;
            case `$charging `:
                ctrl_1.write('C1');
                ctrl_2.write('C1');
                io.sockets.emit(`systemState`, {
                    message: JSON.stringify({ origin: "Driver", param: "isCharging", value: true }),
                    handle: `Driver`,
                    type: 'charging'
                });
                break;
            case `$!charging`:
                ctrl_1.write('C0');
                ctrl_2.write('C0');
                io.sockets.emit(`systemState`, {
                    message: JSON.stringify({ origin: "Driver", param: "isCharging", value: false }),
                    handle: `Driver`,
                    type: 'charging'
                });
                io.sockets.emit(`systemState`, {
                    message: JSON.stringify({ origin: "Driver", param: "isBalancing", value: false }),
                    handle: `Driver`,
                    type: 'charging'
                });
                break;
            case `$B1`:
                console.log(`Start balance`);
                ctrl_1.write('$B1');
                ctrl_2.write('$B1');
                io.sockets.emit(`systemState`, {
                    message: JSON.stringify({ origin: "Driver", param: "isBalancing", value: true }),
                    handle: `Driver`,
                    type: 'charging'
                });
                break;
            default:
                console.log(`Invalid request from the driver: ${input}`);
        }
    }
});
thermo_input.on(`data`, (data) => {
    let _input = data.toString();
    if (_input.charAt(0) !== '$') {
        if (utilities.validateJSON(_input)) {
            let _data = JSON.parse(_input);
            if (_data.type === 'measurement') {
                io.sockets.emit(`dataset`, {
                    message: _input,
                    handle: `Thermo`
                });
            }
            else if (_data.type === 'log') {
                io.sockets.emit(`thermalWarning`, {
                    message: _input,
                    handle: `Thermo`
                });
            }
        }
    }
    else {
        if (_input.substring(0, 5) === '$init') {
            thermo.write((config.limits.thermoMax).toString(), (err) => {
                if (err)
                    return console.log(`Thermo: Error on write: ${err.message}`);
            });
        }
    }
});
io.on(`connection`, socket => {
    if (process.argv[2] !== undefined) { //If server starts with argument i.e after software update.
        socket.emit(`systemState`, {
            message: JSON.stringify({ message: process.argv[2] }),
            handle: `Server`
        });
    }
    if (inverterIpAdress !== null) {
        fetch(`http://${inverterIpAdress}/cmd?cmd=json`)
            .then(res => res.json())
            .then(invResult => {
            utilities.getParam(clientREDIS, `driverState`).then((result) => {
                socket.emit(`systemParam`, {
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
                        inverterValues: JSON.stringify(invResult),
                        mqttUName: config.mqttOptions.username,
                        mqttPWord: config.mqttOptions.password
                    }),
                    handle: `Server`
                });
            });
        });
    }
    else {
        utilities.getParam(clientREDIS, `driverState`).then((result) => {
            socket.emit(`systemParam`, {
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
                    inverterValues: null,
                    mqttUName: config.mqttOptions.username,
                    mqttPWord: config.mqttOptions.password
                }),
                handle: `Server`
            });
        });
    }
    socket.on(`command`, (data) => {
        switch (data.target) {
            case "controller_1":
                ctrl_1.write(data.command);
                break;
            case "controller_2":
                ctrl_2.write(data.command);
                break;
            case "inverter":
                fetch(`http://${inverterIpAdress}/cmd?cmd=${data.command}`)
                    .then((res) => res.json())
                    .then((result) => {
                    socket.emit(`inverterResponse`, {
                        message: JSON.stringify(result),
                        handle: `Server`
                    });
                }, (result) => {
                    socket.emit(`inverterResponse`, {
                        message: result.toString(),
                        handle: `Server`
                    });
                });
                break;
            case "server":
                child_process_1.exec(data.command, (err, stdout, stderr) => {
                    if (err) {
                        console.log(err);
                        return;
                    }
                });
                break;
            case "driver":
                if (data.type === 'instant') {
                    driver_1.write(data.command, (err) => {
                        if (err) {
                            return console.log(`Error on write: ${err.message}`);
                        }
                    });
                }
                else {
                    clientREDIS.set(`driverState`, data.command); //Driver, Reverse, Cruiser, Waterpump
                }
                break;
        }
        ;
    });
    socket.on('reconfigure', (data) => {
        child_process_1.exec(`sudo bash /home/pi/Public/nodeServer/restart.sh ${data.weather} ${data.map} ${data.address} ${data.controller1port} ${data.controller2port} ${data.driverPort} ${data.interval * 60000} ${data.voltageLimit} ${data.temperatureLimit} ${data.thermoDevice} ${data.mqttUName} ${data.mqttPWord}`, function (err, stdout, stderr) {
            if (err) {
                console.log(stderr);
                return;
            }
        });
    });
    socket.on(`update`, (command) => {
        child_process_1.exec(`sudo bash /home/pi/Public/nodeServer/softwareUpdate.sh ${command.target}`, function (err, stdout, stderr) {
            if (err) {
                console.log(stderr);
                return;
            }
        });
    });
});
setInterval(() => {
    utilities.uploadData(clientMQTT, { "group": (ctrl_1.getData()).concat(ctrl_2.getData()) });
}, config.interval);
let groupNum = 0;
function demoData(group) {
    let object = { "Group": group, "type": "data", "voltage": [], "temperature": [] };
    for (let i = 0; i <= 7; i++) {
        object.voltage.push(Math.round((Math.random() * (3.9 - 3) + 3) * 100) / 100);
        object.temperature.push(Math.round((Math.random() * (70 - 60) + 60) * 100) / 100);
    }
    io.sockets.emit(`dataset`, {
        message: JSON.stringify(object),
        handle: groupNum < 4 ? `Controller_1` : `Controller_2`
    });
    io.sockets.emit(`dataset`, {
        message: JSON.stringify({ "origin": "Thermocouple", "type": "measurement", "value": "20.2,21.5" }),
        handle: `Thermo`
    });
}
/*setInterval(() => {
    demoData(groupNum);
    groupNum === 9 ? groupNum = 0 : groupNum++;
},1000)*/
