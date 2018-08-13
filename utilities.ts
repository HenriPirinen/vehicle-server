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

export function getParam(clientREDIS) {
    
    var param = clientREDIS.getAsync(`direction`).then(function (reply) {
        return reply;
    })
    // @ts-ignore
    return Promise.all([param]);
}