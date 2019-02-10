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
	//await fetch(`http://${ip}/cmd?cmd=${command}`)
	const result = await fetch(`https://jsonplaceholder.typicode.com/todos/1`)
		.then(res => res.json())
		.then(invResult => { return JSON.stringify(invResult) }, res => { return res.toString() });
		
	return result;
}