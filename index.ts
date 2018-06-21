import * as express from 'express';
import * as socket from 'socket.io';
import * as redis from 'redis';
import * as mqtt from 'mqtt';
import * as SerialPort from 'serialport';
import * as Delimiter from 'parser-delimiter';
import { exec } from 'child_process';

var dataObject = { //To remote server, remove unnecessary object
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

const clientMQTT = mqtt.connect('mqtt://192.168.2.56'); //MQTT server address

clientMQTT.on('connect', () => {
	clientMQTT.subscribe('vehicleData');
	clientMQTT.subscribe('vehicleExternalCommand');
});


clientMQTT.on('message', (topic, message) => {
	if (topic !== 'vehicleData') { } //console.log(message.toString());
});

var clientREDIS = redis.createClient(); //Creates new redis client, redis will que commands from client
clientREDIS.on('connect', () => {
	console.log('Redis connected');
});

var app = express();
var server = app.listen(4000, () => { //Start server
	console.log("Listening port 4000 @ localhost")
	console.log("MQTT is subscribed to 'vehicleData & vehicleExternalCommand'");
});

var io = socket(server);

const usbPort1 = new SerialPort('/dev/controller.1', { //initiate USB
	baudRate: 9600
});

const usbPort2 = new SerialPort('/dev/controller.2', {
	baudRate: 9600
});

const usbPort3 = new SerialPort('/dev/driver.1', {
	baudRate: 9600
});

const usbPort1parser = usbPort1.pipe(new Delimiter({ //Line change on USB == new dataset
	delimiter: '\n'
}));

const usbPort2parser = usbPort2.pipe(new Delimiter({
	delimiter: '\n'
}));

const usbPort3parser = usbPort3.pipe(new Delimiter({
	delimiter: '\n'
}));

usbPort1parser.on('data', data => { //Real, Read data from 1st USB-port
	let input:string = data.toString();

	if (validateJSON(input)) { //Validate message from arduino
		let newData = JSON.parse(input);
		//console.log("----------------Group " + newData.Group + "--------------------"); //Print pretty table
		for (let i = 0; i < newData.voltage.length; i++) { //voltage.length == temperature.length
			dataObject.group[newData.Group].voltage[i] = newData.voltage[i];
			dataObject.group[newData.Group].temperature[i] = newData.temperature[i];
			//console.log("Voltage " + i + ": " + dataObject.group[newData.Group].voltage[i] + "	  |	  Temperature " + i + ": " + dataObject.group[newData.Group].temperature[i]);
		}

		io.sockets.emit('dataset', { //Send dataset to client via websocket
			message: input,
			handle: 'Controller 1'
		});


	}
	//console.log(input);
});

usbPort2parser.on('data', data => { //Read data from 2nd USB-port
	let input:string = data.toString();
	if (validateJSON(input)) { //Validate message from arduino
		let newData = JSON.parse(input);

		//console.log("----------------Group " + newData.Group + "--------------------"); //Print pretty table
		for (let i = 0; i < newData.voltage.length; i++) { //voltage.length == temperature.length
			dataObject.group[newData.Group].voltage[i] = newData.voltage[i];
			dataObject.group[newData.Group].temperature[i] = newData.temperature[i];
			//console.log("Voltage " + i + ": " + dataObject.group[newData.Group].voltage[i] + "	  |	  Temperature " + i + ": " + dataObject.group[newData.Group].temperature[i]);
		}

		io.sockets.emit('dataset', { //Send dataset to client via websocket
			message: input,
			handle: 'Controller 2'
		});
	}
	//console.log(input);
});

usbPort3parser.on('data', (data:any) => { //Real, Read data from 1st USB-port
	let input:string = data.toString();
	io.sockets.emit('driver', {
		message: input,
		handle: 'driver'
	});
});

io.on('connection', (socket:any) => {
	socket.emit('webSocket', {		//Send notification to new client 
		message: 'WebSocket connected!',
		handle: 'Server'
	});

	socket.on('command', (data:any) => { //Write command to arduino via USB

		switch (data.target) {
			case "controller_1":
				usbPort1.write(data.command, function (err:any) {
					if (err) {
						return console.log('Error on write: ', err.message);
					}
				});
				break;
			case "controller_2":
				usbPort2.write(data.command, function (err) {
					if (err) {
						return console.log('Error on write: ', err.message);
					}
				});
				break;
			case "inverter":
				//TODO
				console.log("Command to inverter");
				break;
			case "server":
				console.log("Command to server");
				exec(data.command, (err, stdout, stderr) => {
					if (err) {
						console.log("Invalid command");
						return;
					}
					console.log('stdout: ' + stdout +'');
					console.log('stderr: ' + stderr + '');
				});

				break;
			case "driver":
				let driverCommand:string = '0';
				let validCommad:boolean = true;
				switch (data.command.toString()) {
					case 'neutral':
						driverCommand = '0';
						break;
					case 'reverse':
						driverCommand = '1';
						break;
					case 'drive':
						driverCommand = '2';
						break;
					case 'getSettings':
						driverCommand = '99';
						break;
					default:
						console.log('Invalid command: ' + data.command.toString());
						validCommad = false;
				}
				console.log(driverCommand);
				if (validCommad) {
					usbPort3.write(driverCommand, function (err) {
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

	socket.on('update', (command) => {

		switch (command.target) {
			case "arduino":
				socket.emit('serverLog', {
					message: 'Updating...',
					handle: 'Server'
				});
				console.log('Updating microcontroller...');
				exec('wget http://student.hamk.fi/~henri1515/electricVehicleDebug.ino -P ../arduinoSketch', function(err, stdout, stderr) {
					if (err) {
						console.log(stderr);
						return;
					}
					//console.log(stdout);
					console.log('Download complete. Compiling...');
					exec('make -C ../arduinoSketch/', function(err, stdout, stderr) {
						if (err) {
							console.log(stderr);
							return;
						}
						//console.log(stdout);
						console.log('Done compiling. Uploading...');
						exec('make upload -C ../arduinoSketch/', function(err, stdout, stderr) {
							if (err) {
								console.log(stderr);
								return;
							}
							//console.log(stdout);
							console.log('Microcontroller software update is complete. Cleaning directory...');
							exec('rm ../arduinoSketch/electricVehicleDebug.ino && rm -rf ../arduinoSketch/build-nano328/', function(err, stdout, stderr) {
								if (err) {
									console.log(stderr);
									return;
								}
								socket.emit('serverLog', {
									message: 'Microcontroller is up to date',
									handle: 'Server'
								});
								//console.log(stdout);
								console.log('Done!');
							})
						})
					})
				});
				break;
			default:
				console.log("Update");
		}
	})
});

function validateJSON(string:string) { //Validate JSON string
	try {
		JSON.parse(string);
	} catch (e) {
		//console.log(e);
		return false;
	}
	return true;
}

var uploadData = () => {
	clientMQTT.publish('vehicleData', JSON.stringify(dataObject));
}

//uploadData();

setInterval(uploadData, 5000); //300000