"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const fetch = require("node-fetch");
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
    clientMQTT.publish(`vehicleData`, JSON.stringify(dataObject));
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
function fetchInverter(command, ip) {
    return __awaiter(this, void 0, void 0, function* () {
        //await fetch(`http://${ip}/cmd?cmd=${command}`)
        const result = yield fetch(`https://jsonplaceholder.typicode.com/todos/1`)
            .then(res => res.json())
            .then(invResult => { return JSON.stringify(invResult); }, res => { return res.toString(); });
        return result;
    });
}
exports.fetchInverter = fetchInverter;
