declare class DeviceIO {
    private port;
    private driverSer;
    private startIdx;
    private numOfGroups;
    private config;
    private websocket;
    groupData: any;
    private ser;
    private serInput;
    constructor(port: string, driverSer: any, startIdx: number, numOfGroups: number, config: any, websocket: any);
    handleInput(data: any): void;
    write(output: any): void;
}
export default DeviceIO;
