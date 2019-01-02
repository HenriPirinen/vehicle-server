#!/user/bin/env node
import * as https from 'https';
import * as fs from 'fs';
import * as express from 'express';
import * as socket from 'socket.io';
import * as redis from 'redis';
import * as mqtt from 'mqtt';
import * as SerialPort from 'serialport';
import * as Delimiter from 'parser-delimiter';
import * as fetch from 'node-fetch';
import * as process from 'process';
import * as bluebird from 'bluebird';
import { exec, execSync } from 'child_process';
import * as path from 'path';
import * as arpScanner from 'arpscan';
// @ts-ignore
import * as utilities from './utilities';
// @ts-ignore
import * as config from './serverCfg';

bluebird.promisifyAll(redis);

// @ts-ignore
process.title = 'regni-server';

var dataObject = {
	'group': [
		{ "voltage": [3.3, 3.4, 3.5, 3.6, 3.55, 3.45, 3.35, 3.23], "temperature": [1, 1, 1, 1, 1, 1, 1, 1] },
		{ "voltage": [3.3, 3.4, 3.5, 3.6, 3.55, 3.45, 3.35, 3.23], "temperature": [1, 1, 1, 1, 1, 1, 1, 1] },
		{ "voltage": [3.3, 3.4, 3.5, 3.6, 3.55, 3.45, 3.35, 3.23], "temperature": [1, 1, 1, 1, 1, 1, 1, 1] },
		{ "voltage": [3.3, 3.4, 3.5, 3.6, 3.55, 3.45, 3.35, 3.23], "temperature": [1, 1, 1, 1, 1, 1, 1, 1] },
		{ "voltage": [3.3, 3.4, 3.5, 3.6, 3.55, 3.45, 3.35, 3.23], "temperature": [1, 1, 1, 1, 1, 1, 1, 1] }, //Group 0 - 4
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

const clientREDIS = redis.createClient(); //Creates new redis client, redis will que commands from client
clientREDIS.on(`connect`, () => {
	console.log(`Redis connected`);
});

clientREDIS.set(`driverState`, `0000`); //Driver, Reverse, Cruiser
clientREDIS.set(`groupChargeStatus`, `0,0,0,0,0,0,0,0,0,0`); //Group 1, Group 2...
clientREDIS.set(`charging`, `true`);

const sslOptions = {
	key: fs.readFileSync('regni-key.pem'),
	cert: fs.readFileSync('regni-cert.pem')
}

const app = express();
const server = https.createServer(sslOptions, app).listen(443, () => {
	console.log('Serving webbapp on port 443');
})

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

const controller_1 = new SerialPort(config.port.controllerPort_1, { //initiate USB
	baudRate: 9600
});

const controller_2 = new SerialPort(config.port.controllerPort_2, {
	baudRate: 9600
});

const driver_1 = new SerialPort(config.port.driverPort, {
	baudRate: 9600
});

const thermo = new SerialPort(config.port.thermo, {
	baudRate: 9600
});

const controller_1_input = controller_1.pipe(new Delimiter({ //Line change on USB == new dataset
	delimiter: `\n`
}));

const controller_2_input = controller_2.pipe(new Delimiter({
	delimiter: `\n`
}));

const driver_1_input = driver_1.pipe(new Delimiter({
	delimiter: `\n`
}));

const thermo_input = thermo.pipe(new Delimiter({
	delimiter: `\n`
}))

var clientMQTT = mqtt.connect(config.address.remoteAddress, config.mqttOptions); //MQTT server address and options

clientMQTT.on(`connect`, () => {
	clientMQTT.subscribe(`vehicleData`);
	clientMQTT.subscribe(`vehicleExternalCommand`);
});


clientMQTT.on(`message`, (topic, message) => {
	if (topic == `vehicleExternalCommand`) {
		let _command = message.toString();
		driver_1.write(_command, function (err) {
			if (err) {
				return console.log(`Driver: Error on write: ${err.message}`);
			}
		});
	}
});

controller_1_input.on(`data`, data => { //Real, Read data from 1st USB-port
	let input: string = data.toString();
	if (input.charAt(0) === '$') {
		if (input.substring(0, 5) === '$init') {
			controller_1.write(`0,${config.limits.serialMax}`, function (err) {
				if (err) {
					return console.log(`Controller: Error on write: ${err.message}`);
				}
			});
		} else if (input.substring(0, 14) === '$!serialCharge') {
			driver_1.write('SC0', function (err) {
				if (err) {
					return console.log(`Driver: Error on write: ${err.message}`);
				}
			});
		}
	} else if (utilities.validateJSON(input)) { //Validate message from arduino
		let newData = JSON.parse(input);
		if (newData.type === "data") {
			for (let i = 0; i < newData.voltage.length; i++) { //voltage.length == temperature.length
				dataObject.group[newData.Group].voltage[i] = newData.voltage[i];
				dataObject.group[newData.Group].temperature[i] = newData.temperature[i];
			}

			io.sockets.emit(`dataset`, { //Send dataset to client via websocket
				message: input,
				handle: `Controller_1`
			});
		} else if (newData.type === "log") {
			io.sockets.emit(`systemLog`, { //Send dataset to client via websocket
				message: input,
				handle: `Controller_1`
			});
		} else if (newData.type === "param") {
			if (newData.name === "balanceStatus") {
				groupChargeStatus[parseInt(newData.value.charAt(0), 10)] = parseInt(newData.value.charAt(1), 10);
			}
			io.sockets.emit(`systemState`, { //Send log to client via websocket
				message: input,
				handle: `Controller_1`
			});
		}
	}
});

controller_2_input.on(`data`, data => { //Read data from 2nd USB-port
	let input: string = data.toString();
	if (input.charAt(0) === '$') {
		if (input.substring(0, 5) === '$init') {
			controller_2.write(`5,${config.limits.serialMax}`, function (err) {
				if (err) {
					return console.log(`Controller: Error on write: ${err.message}`);
				}
			});
		} else if (input.substring(0, 14) === '$!serialCharge') {
			driver_1.write('SC0', function (err) {
				if (err) {
					return console.log(`Driver: Error on write: ${err.message}`);
				}
			});
		}
	} else if (utilities.validateJSON(input)) { //Validate message from arduino
		let newData = JSON.parse(input);
		if (newData.type === "data") {
			for (let i = 0; i < newData.voltage.length; i++) { //voltage.length == temperature.length
				dataObject.group[newData.Group].voltage[i] = newData.voltage[i];
				dataObject.group[newData.Group].temperature[i] = newData.temperature[i];
			}

			io.sockets.emit(`dataset`, { //Send dataset to client via websocket
				message: input,
				handle: `Controller_2`
			});
		} else if (newData.type === "log") {
			io.sockets.emit(`systemLog`, { //Send log to client via websocket
				message: input,
				handle: `Controller_2`
			});
		} else if (newData.type === "param") {
			if (newData.name === "balanceStatus") {
				groupChargeStatus[parseInt(newData.value.charAt(0), 10) + 5] = parseInt(newData.value.charAt(1), 10);
			}
			io.sockets.emit(`systemState`, { //Send log to client via websocket
				message: input,
				handle: `Controller_2`
			});
		}
	}
});

driver_1_input.on(`data`, (data: any) => { //Real, Read data from 1st USB-port
	let input: string = data.toString();
	if (input.charAt(0) != `$`) { //Send log message to the client
		if (utilities.validateJSON(input)) {
			let _params = JSON.parse(input);
			if (_params.type === `log`) {
				io.sockets.emit(`systemLog`, {
					message: input,
					handle: `Driver`
				});
			} else if (_params.type === `param`) {
				clientREDIS.set(_params.name, _params.value);
				io.sockets.emit(`systemState`, {
					message: input,
					handle: `Driver`,
					type: 'relayState'
				});
			}
		}
	} else { //Get desired gear setting from redis and write it to driver
		switch (input.substring(0, input.length - 1)) { //Ignore \n at the end of input, msg length is 11 characters
			case `$getParams`:
				clientREDIS.get(`driverState`, (err, reply) => {
					driver_1.write(reply, function (err) {
						if (err) {
							return console.log(`Driver: Error on write: ${err.message}`);
						}
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
				controller_1.write('C1', function (err) {
					if (err) {
						return console.log(`Controller: Error on write: ${err.message}`);
					}
				});
				controller_2.write('C1', function (err) {
					if (err) {
						return console.log(`Controller: Error on write: ${err.message}`);
					}
				});
				io.sockets.emit(`systemState`, {
					message: JSON.stringify({ origin: "Driver", param: "isCharging", value: true }),
					handle: `Driver`,
					type: 'charging'
				});
				break;
			case `$!charging`:
				controller_1.write('C0', function (err) {
					if (err) {
						return console.log(`Controller: Error on write: ${err.message}`);
					}
				});
				controller_2.write('C0', function (err) {
					if (err) {
						return console.log(`Controller: Error on write: ${err.message}`);
					}
				});
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
				controller_1.write('$B1', function (err) {
					if (err) {
						return console.log(`Controller: Error on write: ${err.message}`);
					}
				});
				controller_2.write('$B1', function (err) {
					if (err) {
						return console.log(`Controller: Error on write: ${err.message}`);
					}
				});
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

thermo_input.on(`data`, (data: any) => {
	let _input = data.toString();
	if (_input.charAt(0) !== '$') {
		if (utilities.validateJSON(_input)) {
			let _data = JSON.parse(_input);
			if (_data.type === 'measurement') {
				io.sockets.emit(`dataset`, { //Send dataset to client via websocket
					message: _input,
					handle: `Thermo`
				});
			} else if (_data.type === 'log') {
				io.sockets.emit(`thermalWarning`,{
					message: _input,
					handle: `Thermo`
				});
			}
		}
	} else {
		if (_input.substring(0, 5) === '$init') {
			thermo.write((config.limits.thermoMax).toString(), function (err) {
				if (err) {
					return console.log(`Thermo: Error on write: ${err.message}`);
				}
			});
		}
	}
});

io.on(`connection`, (socket: any) => {
	if (process.argv[2] !== undefined) { //If server starts with argument i.e after software update.
		socket.emit(`systemState`, {
			message: JSON.stringify({ message: process.argv[2] }),
			handle: `Server`
		})
	}

	let options = {
		command: 'arp-scan',
		interface: 'wlan0',
		sudo: true
	}
	
	arpScanner(onResult, options); //Find inverter IP address.
	function onResult(err, data) {
		let inverterIpAdress = '';
	
		if (err) throw err;
		for (let i = 0; i < data.length; i++) {
			if (data[i].mac === '5C:CF:7F:8E:26:00') {
				inverterIpAdress = data[i].ip;
			}
		}
	
		fetch(`http://${inverterIpAdress}/cmd?cmd=json`)
		.then(res => res.json())
		.then(invResult => {
			console.log(JSON.stringify(invResult));
			utilities.getParam(clientREDIS, `driverState`).then(function (result) {
				socket.emit(`systemParam`, {		//Send notification to new client
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
					handle: `Server`
				});
			});
		}, error => {
			utilities.getParam(clientREDIS, `driverState`).then(function (result) {
				socket.emit(`systemParam`, {		//Send notification to new client
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
						inverterValues: null
					}),
					handle: `Server`
				});
			});
		}
		)
	}

	socket.on(`command`, (data: any) => { //Write command to arduino via USB
		switch (data.target) {
			case "controller_1":
				controller_1.write(data.command, function (err: any) {
					if (err) {
						return console.log(`Error on write: ${err.message}`);
					} else {
						socket.emit(`systemLog`, {		//Send notification to new client 
							message: JSON.stringify({ origin: "Server", msg: `Command to 1st. controller: ${data.command}`, importance: `Medium` }),
							handle: `Server`
						});
					}
				});
				break;
			case "controller_2":
				controller_2.write(data.command, function (err) {
					if (err) {
						return console.log(`Error on write: ${err.message}`);
					} else {
						socket.emit(`systemLog`, {		//Send notification to new client 
							message: JSON.stringify({ origin: "Server", msg: `Command to 2nd. controller: ${data.command}`, importance: `Medium` }),
							handle: `Server`
						});
					}
				});
				break;
			case "inverter":
				fetch(`http://192.168.1.33/cmd?cmd=${data.command}`)
					.then((res) => res.json())
					.then((result) => {
						socket.emit(`inverterResponse`, {
							message: JSON.stringify(result),
							handle: `Server`
						});
					},
						(result) => {
							socket.emit(`inverterResponse`, {
								message: result.toString(),
								handle: `Server`
							});
						}
					)
				break;
			case "server":
				exec(data.command, (err, stdout, stderr) => {
					if (err) {
						console.log(err);
						return;
					}
				});

				break;
			case "driver":
				if (data.type === 'instant') {
					driver_1.write(data.command, function (err) {
						if (err) {
							return console.log(`Error on write: ${err.message}`);
						}
					})
				} else {
					clientREDIS.set(`driverState`, data.command); //Driver, Reverse, Cruiser, Waterpump
				}
				break;
		};
	});

	socket.on('reconfigure', (data) => {
		exec(`sudo bash /home/pi/Public/nodeServer/restart.sh ${data.weather} ${data.map} ${data.address} ${data.controller1port} ${data.controller2port} ${data.driverPort} ${data.interval * 60000} ${data.voltageLimit} ${data.temperatureLimit}  ${data.thermoDevice}`, function (err, stdout, stderr) {
			if (err) {
				console.log(stderr);
				return;
			}
		})
	})

	socket.on(`update`, (command) => {
		let targets = command.target.split(" ");
		let bashCommand = "sudo bash /home/pi/Public/nodeServer/softwareUpdate.sh";
		for(let device of targets){
			bashCommand += ` ${device}`
		}

		exec(`sudo bash /home/pi/Public/nodeServer/softwareUpdate.sh ${command.target}`, function (err, stdout, stderr) {
			if (err) {
				console.log(stderr);
				return;
			}
		})
	})
});

setInterval(function () {
	console.log("Uploading data to cloud");
	utilities.uploadData(clientMQTT, dataObject);
}, config.interval);
