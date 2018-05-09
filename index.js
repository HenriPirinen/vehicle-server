var express = require('express');
var socket = require('socket.io');
var redis = require('redis');
var mqtt = require('mqtt')
const SerialPort = require('serialport');
const Delimiter = require('parser-delimiter');

var clientMQTT  = mqtt.connect('mqtt://192.168.2.45'); //Local MQTT server address

clientMQTT.on('connect', function () {
	clientMQTT.subscribe('testConnection');
});


clientMQTT.on('message', function (topic, message) {
	console.log(message.toString())
	clientMQTT.end()
});

var clientREDIS = redis.createClient(); //Creates new redis client, redis will que commands from client
clientREDIS.on('connect', function() {
    console.log('Redis connected');
});

var app = express();
var server = app.listen(4000, function(){ //Start server
	console.log("Listening port 4000 @ localhost")
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
	delimiter : '\n'
}));

usbPort1parser.on('data', data => { //Real, Read data from 1st USB-port
	let input = data.toString();
	
	if(validateJSON(input)){ //Validate message from arduino
		let newData = JSON.parse(input);
	
		io.sockets.emit('dataset', {
			message: newData.temperature.temp_1,
			handle: 'Controller 1'	
		});
	}
	console.log("Controller 1" + input);
});

usbPort2parser.on('data', data => { //Read data from 2nd USB-port
	let input = data.toString();

	if(validateJSON(input)){ //Validate message from arduino
		let newData = JSON.parse(input);
		
			io.sockets.emit('dataset',{
				message: newData.voltage.volt_1,
				handle: 'Controller 2'
			});
	}
	console.log("Controller 2" + input);
});
	

io.on('connection', function(socket){
	socket.emit('webSocket', {		//Send notification to new client 
		message: 'WebSocket connected!',
		handle: 'Server'
	});
				
	socket.on('command', function(data){ //Write command to arduino via USB

		switch(data.target){
			case "controller_1":
				usbPort1.write(data.command, function(err) {
					if (err) {
					return console.log('Error on write: ', err.message);
					}
					console.log('message written');
				});
			break;
			case "controller_2":
				usbPort2.write(data.command, function(err) {
					if (err) {
					return console.log('Error on write: ', err.message);
					}
					console.log('message written');
				});
			break;
			case "inverter":
				//TODO
				console.log("Command to inverter");
			break;
			case "server":
				//TODO
				console.log("Command to server");
			break;
			default:
				console.log("Invalid target");
		}
	});
});

function validateJSON(string){ //Validate JSON string
	try {
		JSON.parse(string);
	} catch (e) {
		//console.log(e);
		return false;
	}
	return true;
}