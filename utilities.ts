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
	console.log("Upload");
}

export function getParam(clientREDIS, item) {
    
    var param = clientREDIS.getAsync(item).then(function (reply) {
        return reply;
    })
    // @ts-ignore
    return Promise.all([param]);
}