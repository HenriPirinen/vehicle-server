export declare function validateJSON(string: string): boolean;
export declare function uploadData(clientMQTT: any, dataObject: any): void;
export declare function getParam(clientREDIS: any, item: any): Promise<any[]>;
export declare function fetchInverter(command: any, ip: any): Promise<any>;
export declare function report(socket: any, broker: any, message: any): void;
