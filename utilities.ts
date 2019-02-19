import * as fetch from 'node-fetch';

export function validateJSON(string: string) { //Validate JSON string
	try {
		JSON.parse(string);
	} catch (e) {
		return false;
	}
	return true;
}

export function uploadData(clientMQTT, dataObject) {
	clientMQTT.publish(`vehicleData`, JSON.stringify(dataObject));
}

export function getParam(clientREDIS, item) {
	var param = clientREDIS.getAsync(item).then(function (reply) {
		return reply;
	})
	// @ts-ignore
	return Promise.all([param]);
}

export async function fetchInverter(command, ip) {
	const result = await fetch(`http://${ip}/cmd?cmd=${command}`)
		.then(res => res.json())
		.then(invResult => { return JSON.stringify(invResult) }, res => { return res.toString() });
		
	return result;
}

export function report(socket,broker,message){
	const msg = JSON.parse(message);
	switch(msg.type){
		case 'data':
		socket.emit(`dataset`, { //Send dataset to client via websocket
			message: message,
			handle: broker
		});	
		break;
		case 'log':
		socket.emit(`systemLog`, { //Send dataset to client via websocket
			message: message,
			handle: broker
		});
		break;
		case 'param':
		socket.emit(`systemState`, { //Send log to client via websocket
			message: message,
			handle: broker
		});
		break;
	}
}