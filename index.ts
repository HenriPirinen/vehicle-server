import * as express from 'express';
import * as socket from 'socket.io';
import * as redis from 'redis';
import * as mqtt from 'mqtt';
import * as SerialPort from 'serialport';
import * as Delimiter from 'parser-delimiter';
import * as fetch from 'node-fetch';
import * as process from 'process';
// @ts-ignore
import * as config from './serverCfg';
import * as bluebird from 'bluebird';
import { exec, execSync } from 'child_process';

bluebird.promisifyAll(redis);

// @ts-ignore
process.title = 'regni-server';
var dataObject = { //Add log as an array with object
	'group': [
		{ "voltage": [1, 1, 1, 1, 1, 1, 1, 1], "temperature": [1, 1, 1, 1, 1, 1, 1, 1] },
		{ "voltage": [1, 1, 1, 1, 1, 1, 1, 1], "temperature": [1, 1, 1, 1, 1, 1, 1, 1] },
		{ "voltage": [1, 1, 1, 1, 1, 1, 1, 1], "temperature": [1, 1, 1, 1, 1, 1, 1, 1] },
		{ "voltage": [1, 1, 1, 1, 1, 1, 1, 1], "temperature": [1, 1, 1, 1, 1, 1, 1, 1] },
		{ "voltage": [1, 1, 1, 1, 1, 1, 1, 1], "temperature": [1, 1, 1, 1, 1, 1, 1, 1] }, //Group 0 - 4
		{ "voltage": [1, 1, 1, 1, 1, 1, 1, 1], "temperature": [1, 1, 1, 1, 1, 1, 1, 1] },
		{ "voltage": [1, 1, 1, 1, 1, 1, 1, 1], "temperature": [1, 1, 1, 1, 1, 1, 1, 1] },
		{ "voltage": [1, 1, 1, 1, 1, 1, 1, 1], "temperature": [1, 1, 1, 1, 1, 1, 1, 1] },
		{ "voltage": [1, 1, 1, 1, 1, 1, 1, 1], "temperature": [1, 1, 1, 1, 1, 1, 1, 1] },
		{ "voltage": [1, 1, 1, 1, 1, 1, 1, 1], "temperature": [1, 1, 1, 1, 1, 1, 1, 1] } //Group 5 - 9
	]
};

const clientMQTT = mqtt.connect(`mqtt://${config.address.remoteAddress}`); //MQTT server address

clientMQTT.on(`connect`, () => {
	clientMQTT.subscribe(`vehicleData`);
	clientMQTT.subscribe(`vehicleExternalCommand`);
});


clientMQTT.on(`message`, (topic, message) => {
	if (topic !== `vehicleData`) { } //console.log(message.toString());
});

const clientREDIS = redis.createClient(); //Creates new redis client, redis will que commands from client
clientREDIS.on(`connect`, () => {
	console.log(`Redis connected`);
});

clientREDIS.set(`direction`, `0`);

const app = express();
const server = app.listen(4000, () => { //Start server
	console.log(`Listening port 4000 @ localhost`)
	console.log(`MQTT is subscribed to "vehicleData" & "vehicleExternalCommand"`);
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

const controller_1_input = controller_1.pipe(new Delimiter({ //Line change on USB == new dataset
	delimiter: `\n`
}));

const controller_2_input = controller_2.pipe(new Delimiter({
	delimiter: `\n`
}));

const driver_1_input = driver_1.pipe(new Delimiter({
	delimiter: `\n`
}));

setTimeout(function () {
	driver_1.write('99', function (err) {
		if (err) {
			return console.log(`Error on write: ${err.message}`);
		}
		console.log('Get driver settings');
	});
}, 2000);

controller_1_input.on(`data`, data => { //Real, Read data from 1st USB-port
	let input: string = data.toString();
	if (input.charAt(0) === '$') {
		console.log('Controller 1 request');
		controller_1.write('0', function (err) {
			if (err) {
				return console.log(`Error on write: ${err.message}`);
			}
		});
	} else if (validateJSON(input)) { //Validate message from arduino
		let newData = JSON.parse(input);
		if (newData.type === "data") {
			console.log("----------------Group " + newData.Group + "--------------------"); //Print pretty table
			for (let i = 0; i < newData.voltage.length; i++) { //voltage.length == temperature.length
				dataObject.group[newData.Group].voltage[i] = newData.voltage[i];
				dataObject.group[newData.Group].temperature[i] = newData.temperature[i];
				console.log("Voltage " + i + ": " + dataObject.group[newData.Group].voltage[i] + "	  |	  Temperature " + i + ": " + dataObject.group[newData.Group].temperature[i]);
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
			io.sockets.emit(`systemState`, { //Send log to client via websocket
				message: input,
				handle: `Controller_1`
			});
		}
	}
});

controller_2_input.on(`data`, data => { //Read data from 2nd USB-port, (Connected to debugger)
	let input: string = data.toString();
	if (input.charAt(0) === '$') {
		console.log('Controller 2 request');
		controller_2.write('5', function (err) {
			if (err) {
				return console.log(`Error on write: ${err.message}`);
			}
		});
	} else if (validateJSON(input)) { //Validate message from arduino
		let newData = JSON.parse(input);
		if (newData.type === "data") {
			console.log("----------------Group " + newData.Group + "--------------------"); //Print pretty table
			for (let i = 0; i < newData.voltage.length; i++) { //voltage.length == temperature.length
				dataObject.group[newData.Group].voltage[i] = newData.voltage[i];
				dataObject.group[newData.Group].temperature[i] = newData.temperature[i];
				console.log("Voltage " + i + ": " + dataObject.group[newData.Group].voltage[i] + "	  |	  Temperature " + i + ": " + dataObject.group[newData.Group].temperature[i]);
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
		let _params = JSON.parse(input);

		if (_params.type === `log`) {
			io.sockets.emit(`systemLog`, {
				message: input,
				handle: `driver`
			});
		} else if (_params.type === `param`) {
			input = JSON.parse(input);
			console.log(`${_params.name} : ${_params.value}`);
			clientREDIS.set(_params.name, _params.value);
		}

	} else { //Get desired gear setting from redis and write it to driver
		console.log("Request from the driver: " + input);
		switch (input.substring(0, 10)) { //Ignore \n at the end of input
			case `$getParams`:
				clientREDIS.get(`direction`, (err, reply) => {
					driver_1.write(reply, function (err) {
						if (err) {
							return console.log(`Error on write: ${err.message}`);
						}
					});
				});
				break;
			default:
				console.log(`Invalid request from the driver: ${input}`);
		}
	}
});

io.on(`connection`, (socket: any) => {
	getParam().then(function (result) {
		socket.emit(`systemParam`, {		//Send notification to new client
			message: JSON.stringify({
				weatherAPI: config.api.weather,
				mapAPI: config.api.maps,
				remoteAddress: config.address.remoteAddress,
				controller_1: config.port.controllerPort_1,
				controller_2: config.port.controllerPort_2,
				driverPort: config.port.driverPort,
				driveDirection: result[0],
				remoteUpdateInterval: config.interval / 60000
			}),
			handle: `Server`
		});
	});

	socket.on(`command`, (data: any) => { //Write command to arduino via USB
		switch (data.target) {
			case "controller_1":
				console.log(data.target);
				console.log(data.command);
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
				console.log(data.target);
				console.log(data.command);
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
				let driverCommand: string = `0`;
				let instantAction: boolean = true;
				//Add command type to message
				switch (data.command.toString()) {
					case `neutral`:
						instantAction = false;
						clientREDIS.set(`direction`, `0`);
						break;
					case `reverse`:
						instantAction = false;
						clientREDIS.set(`direction`, `1`);
						break;
					case `drive`:
						instantAction = false;
						clientREDIS.set(`direction`, `2`);
						break;
					case `getSettings`:
						instantAction = true;
						driverCommand = `99`;
						break;
					default:
						console.log(`Invalid command: ` + data.command.toString());
						instantAction = false;
				}
				console.log(`Command to driver: ${data.command.toString()} | instantAction = ${instantAction}`);
				if (instantAction) {
					driver_1.write(driverCommand, function (err) {
						if (err) {
							return console.log(`Error on write: ${err.message}`);
						}
					});
				}
				break;
			default:
				console.log("Invalid target: " + data.target);
		}
	});

	socket.on('reconfigure', (data) => {
		exec(`sudo bash /home/pi/Public/nodeServer/restart.sh ${data.weather} ${data.map} ${data.address} ${data.controller1port} ${data.controller2port} ${data.driverPort} ${data.interval * 60000}`, function (err, stdout, stderr) {
			if (err) {
				console.log(stderr);
				return;
			}
		})
	})

	socket.on(`update`, (command) => {
		console.log(command.target);
		exec(`sudo bash /home/pi/Public/nodeServer/softwareUpdate.sh -t ${command.target} -a update`, function (err, stdout, stderr) {
			if (err) {
				console.log(stderr);
				return;
			}
		})
	})
});

function validateJSON(string: string) { //Validate JSON string
	try {
		JSON.parse(string);
	} catch (e) {
		return false;
	}
	return true;
}

var uploadData = () => {
	clientMQTT.publish(`vehicleData`, JSON.stringify(dataObject));
}

function getParam() {

	var param = clientREDIS.getAsync(`direction`).then(function (reply) {
		return reply;
	})
	// @ts-ignore
	return Promise.all([param]);
}

setInterval(uploadData, config.interval);