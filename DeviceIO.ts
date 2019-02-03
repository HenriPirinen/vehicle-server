import * as SerialPort from 'serialport';
import * as Delimiter from 'parser-delimiter';
// @ts-ignore
import * as utilities from './utilities';

function initData(numOfGroups) {
    let data = new Array();
    for (let i = 0; i < numOfGroups; i++) {
        data.push({ "voltage": [], "temperature": [] })
    }
    return data;
}

class DeviceIO {
    public groupData;
    private ser;
    private serInput;
    constructor(private port: string, private driverSer, private startIdx: number, private numOfGroups: number, private config, private websocket) {
        this.websocket = websocket;
        this.config = config;
        this.driverSer = driverSer;
        this.groupData = initData(numOfGroups);
        this.ser = new SerialPort(port, { baudRate: 9600 });
        this.serInput = this.ser.pipe(new Delimiter({ delimiter: `\n` }));
        this.serInput.on(`data`, data => this.handleInput(data));
    }

    handleInput(data) {
        let input: string = data.toString();
        if (input.charAt(0) === '$') {
            if (input.substring(0, 5) === '$init') {
                this.ser.write(`0,${this.config.limits.serialMax}`, (err) => {
                    if (err) return console.log(`Controller: Error on write: ${err.message}`);
                });
            } else if (input.substring(0, 14) === '$!serialCharge') {
                this.driverSer.write('SC0', (err) => {
                    if (err) return console.log(`Driver: Error on write: ${err.message}`);
                });
            }
        } else if (utilities.validateJSON(input)) { //Validate message from arduino
            let newData = JSON.parse(input);
            if (newData.type === "data") {
                for (let i = 0; i < newData.voltage.length; i++) { //voltage.length == temperature.length
                    this.groupData[newData.Group - this.startIdx].voltage[i] = newData.voltage[i];
                    this.groupData[newData.Group - this.startIdx].temperature[i] = newData.temperature[i];
                }
    
                this.websocket.sockets.emit(`dataset`, { //Send dataset to client via websocket
                    message: input,
                    handle: `Controller_1`
                });
            } else if (newData.type === "log") {
                this.websocket.sockets.emit(`systemLog`, { //Send dataset to client via websocket
                    message: input,
                    handle: `Controller_1`
                });
            } else if (newData.type === "param") {
                if (newData.name === "balanceStatus") {
                    //groupChargeStatus[parseInt(newData.value.charAt(0), 10)] = parseInt(newData.value.charAt(1), 10);
                }
                this.websocket.sockets.emit(`systemState`, { //Send log to client via websocket
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

export default DeviceIO;