"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const SerialPort = require("serialport");
const Delimiter = require("parser-delimiter");
// @ts-ignore
const utilities = require("./utilities");
function initData(numOfGroups) {
    let data = new Array();
    for (let i = 1; i <= numOfGroups; i++) {
        data.push({ "voltage": [0, 0, 0, 0, 0, 0, 0, 0], "temperature": [0, 0, 0, 0, 0, 0, 0, 0] });
    }
    return data;
}
class ControllerIO {
    constructor(params) {
        this.params = params;
        this.websocket = params.websocket;
        this.serialMax = params.serialMax;
        this.groupData = initData(params.numOfGroups);
        this.startIdx = params.startIdx;
        this.redis = params.redis;
        this.serDriver = params.serDriver;
        this.ser = new SerialPort(params.port, { baudRate: 9600 });
        this.serInput = this.ser.pipe(new Delimiter({ delimiter: `\n` }));
        this.serInput.on(`data`, data => this.handleInput(data));
    }
    handleInput(data) {
        let input = data.toString();
        if (input.charAt(0) === '$') { //If input is a command
            if (input.substring(0, 5) === '$init') { //Return startup values to Controller
                this.ser.write(`${this.startIdx},${this.serialMax}`, (err) => {
                    if (err)
                        return console.log(`Controller: Error on write: ${err.message}`);
                });
            }
            else if (input.substring(0, 14) === '$!serialCharge') { //Command to stop serialcharging
                this.serDriver.write('SC0', (err) => {
                    if (err)
                        return console.log(`Driver: Error on write: ${err.message}`);
                });
            }
        }
        else if (utilities.validateJSON(input)) { //If input is JSON message
            let newData = JSON.parse(input);
            if (newData.type === "data") { //Input is an measurement => update group data object
                for (let i = 0; i < newData.voltage.length; i++) { //voltage.length == temperature.length
                    this.groupData[newData.Group - this.startIdx].voltage[i] = newData.voltage[i];
                    this.groupData[newData.Group - this.startIdx].temperature[i] = newData.temperature[i];
                }
            }
            else if (newData.type === "param") {
                if (newData.name === "balanceStatus") {
                    utilities.getParam(this.redis, 'groupChargeStatus').then(result => {
                        let newStatus = result[0].split(","); //Make an array from the result
                        newStatus[parseInt(newData.value.charAt(0), 10) + this.startIdx] = newData.value.charAt(1); //Update array
                        this.redis.set(`groupChargeStatus`, newStatus.toString()); //Set updated array as new groupChargeStatus to Redis
                    });
                }
            }
            utilities.report(this.websocket.sockets, 'Controller_1', input); //Send JSON message to the UI
        }
    }
    getData() {
        return this.groupData;
    }
    write(command) {
        this.ser.write(command.toString(), (err) => {
            if (err)
                return console.log(`Controller: Error on write: ${err.message}`);
        });
    }
}
exports.default = ControllerIO;
