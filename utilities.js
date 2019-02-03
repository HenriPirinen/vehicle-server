"use strict";
exports.__esModule = true;
function validateJSON(string) {
    try {
        JSON.parse(string);
    }
    catch (e) {
        return false;
    }
    return true;
}
exports.validateJSON = validateJSON;
function uploadData(clientMQTT, dataObject) {
    clientMQTT.publish("vehicleData", JSON.stringify(dataObject));
}
exports.uploadData = uploadData;
function getParam(clientREDIS, item) {
    var param = clientREDIS.getAsync(item).then(function (reply) {
        return reply;
    });
    // @ts-ignore
    return Promise.all([param]);
}
exports.getParam = getParam;
