var express = require('express');
var socket = require('socket.io');
var redis = require('redis');
var mqtt = require('mqtt');
var formidable = require('formidable');
const SerialPort = require('serialport');
const Delimiter = require('parser-delimiter');
const { exec } = require('child_process'); //For executing shell commands

var dataObject = {
	'group': [
		{"voltage": [1,1,1,1,1,1,1,1],"temperature": [1,1,1,1,1,1,1,1]},
		{"voltage": [1,1,1,1,1,1,1,1],"temperature": [1,1,1,1,1,1,1,1]},
		{"voltage": [1,1,1,1,1,1,1,1],"temperature": [1,1,1,1,1,1,1,1]},
		{"voltage": [1,1,1,1,1,1,1,1],"temperature": [1,1,1,1,1,1,1,1]},
		{"voltage": [1,1,1,1,1,1,1,1],"temperature": [1,1,1,1,1,1,1,1]}, //Group 0 - 4
		{"voltage": [1,1,1,1,1,1,1,1],"temperature": [1,1,1,1,1,1,1,1]},
		{"voltage": [1,1,1,1,1,1,1,1],"temperature": [1,1,1,1,1,1,1,1]},
		{"voltage": [1,1,1,1,1,1,1,1],"temperature": [1,1,1,1,1,1,1,1]},
		{"voltage": [1,1,1,1,1,1,1,1],"temperature": [1,1,1,1,1,1,1,1]},
		{"voltage": [1,1,1,1,1,1,1,1],"temperature": [1,1,1,1,1,1,1,1]} //Group 5 - 9
	]
};

var clientMQTT = mqtt.connect('mqtt://192.168.2.56'); //MQTT server address

clientMQTT.on('connect', function () {
	clientMQTT.subscribe('vehicleData');
	clientMQTT.subscribe('vehicleExternalCommand');
});


clientMQTT.on('message', function (topic, message) {
	if (topic !== 'vehicleData'){} //console.log(message.toString());
});

var clientREDIS = redis.createClient(); //Creates new redis client, redis will que commands from client
clientREDIS.on('connect', function () {
	console.log('Redis connected');
});

var app = express();
var server = app.listen(4000, function () { //Start server
	console.log("Listening port 4000 @ localhost")
	console.log("MQTT is subscribed to 'vehicleData & vehicleExternalCommand'");
});

var io = socket(server);

const usbPort1 = new SerialPort('/dev/ttyUSB1', { //initiate USB
	baudRate: 9600
});

const usbPort2 = new SerialPort('/dev/ttyUSB0', {
	baudRate: 9600
});

const usbPort1parser = usbPort1.pipe(new Delimiter({ //Line change on USB == new dataset
	delimiter: '\n'
}));

const usbPort2parser = usbPort2.pipe(new Delimiter({
	delimiter: '\n'
}));

usbPort1parser.on('data', data => { //Real, Read data from 1st USB-port
	let input = data.toString();

	if (validateJSON(input)) { //Validate message from arduino
		let newData = JSON.parse(input);

		console.log("----------------Group " + newData.Group + "--------------------"); //Print pretty table
		for(let i = 0; i < newData.voltage.length; i++){ //voltage.length == temperature.length
			dataObject.group[newData.Group].voltage[i] = newData.voltage[i];
			dataObject.group[newData.Group].temperature[i] = newData.temperature[i];
			console.log("Voltage " + i + ": " + dataObject.group[newData.Group].voltage[i] + "	  |	  Temperature " + i + ": " + dataObject.group[newData.Group].temperature[i]);
		}

		io.sockets.emit('dataset', { //Send dataset to client via websocket
			message: input,
			handle: 'Controller 1'
		});


	}
	//console.log(input);
});

usbPort2parser.on('data', data => { //Read data from 2nd USB-port
	let input = data.toString();

	if (validateJSON(input)) { //Validate message from arduino
		let newData = JSON.parse(input);

		console.log("----------------Group " + newData.Group + "--------------------"); //Print pretty table
		for(let i = 0; i < newData.voltage.length; i++){ //voltage.length == temperature.length
			dataObject.group[newData.Group].voltage[i] = newData.voltage[i];
			dataObject.group[newData.Group].temperature[i] = newData.temperature[i];
			console.log("Voltage " + i + ": " + dataObject.group[newData.Group].voltage[i] + "	  |	  Temperature " + i + ": " + dataObject.group[newData.Group].temperature[i]);
		}

		io.sockets.emit('dataset', { //Send dataset to client via websocket
			message: input,
			handle: 'Controller 2'
		});
	}
	//console.log(input);
});

io.on('connection', function (socket) {
	socket.emit('webSocket', {		//Send notification to new client 
		message: 'WebSocket connected!',
		handle: 'Server'
	});

	socket.on('command', function (data) { //Write command to arduino via USB

		switch (data.target) {
			case "controller_1":
				usbPort1.write(data.command, function (err) {
					if (err) {
						return console.log('Error on write: ', err.message);
					}
					console.log('Message written to controller 1');
				});
				break;
			case "controller_2":
				usbPort2.write(data.command, function (err) {
					if (err) {
						return console.log('Error on write: ', err.message);
					}
					console.log('Message written to controller 2: ' + data.command);
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
					console.log(`stdout: ${stdout}`);
					console.log(`stderr: ${stderr}`);
				});

				break;
			default:
				console.log("Invalid target");
		}
	});
});

function validateJSON(string) { //Validate JSON string
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

setInterval(uploadData, 300000);