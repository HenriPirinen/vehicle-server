declare class ControllerIO {
    private params;
    private groupData;
    private ser;
    private serInput;
    private serDriver;
    private serialMax;
    private websocket;
    private startIdx;
    private redis;
    constructor(params: any);
    handleInput(data: any): void;
    getData(): any;
    write(command: any): void;
}
export default ControllerIO;
