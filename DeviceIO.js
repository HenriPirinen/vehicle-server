"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const SerialPort = require("serialport");
const Delimiter = require("parser-delimiter");
// @ts-ignore
const utilities = require("./utilities");
function initData(numOfGroups) {
    let data = new Array();
    for (let i = 0; i < numOfGroups; i++) {
        data.push({ "voltage": [], "temperature": [] });
    }
    return data;
}
class DeviceIO {
    constructor(port, driverSer, startIdx, numOfGroups, config, websocket) {
        this.port = port;
        this.driverSer = driverSer;
        this.startIdx = startIdx;
        this.numOfGroups = numOfGroups;
        this.config = config;
        this.websocket = websocket;
        this.websocket = websocket;
        this.config = config;
        this.driverSer = driverSer;
        this.groupData = initData(numOfGroups);
        this.ser = new SerialPort(port, { baudRate: 9600 });
        this.serInput = this.ser.pipe(new Delimiter({ delimiter: `\n` }));
        this.serInput.on(`data`, data => this.handleInput(data));
    }
    handleInput(data) {
        let input = data.toString();
        if (input.charAt(0) === '$') {
            if (input.substring(0, 5) === '$init') {
                this.ser.write(`0,${this.config.limits.serialMax}`, (err) => {
                    if (err)
                        return console.log(`Controller: Error on write: ${err.message}`);
                });
            }
            else if (input.substring(0, 14) === '$!serialCharge') {
                this.driverSer.write('SC0', (err) => {
                    if (err)
                        return console.log(`Driver: Error on write: ${err.message}`);
                });
            }
        }
        else if (utilities.validateJSON(input)) { //Validate message from arduino
            let newData = JSON.parse(input);
            if (newData.type === "data") {
                for (let i = 0; i < newData.voltage.length; i++) { //voltage.length == temperature.length
                    this.groupData[newData.Group - this.startIdx].voltage[i] = newData.voltage[i];
                    this.groupData[newData.Group - this.startIdx].temperature[i] = newData.temperature[i];
                }
                this.websocket.sockets.emit(`dataset`, {
                    message: input,
                    handle: `Controller_1`
                });
            }
            else if (newData.type === "log") {
                this.websocket.sockets.emit(`systemLog`, {
                    message: input,
                    handle: `Controller_1`
                });
            }
            else if (newData.type === "param") {
                if (newData.name === "balanceStatus") {
                    //groupChargeStatus[parseInt(newData.value.charAt(0), 10)] = parseInt(newData.value.charAt(1), 10);
                }
                this.websocket.sockets.emit(`systemState`, {
                    message: input,
                    handle: `Controller_1`
                });
            }
        }
    }
    write(output) {
        console.log(output);
    }
}
exports.default = DeviceIO;
