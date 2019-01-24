export declare enum ClientConnectionState {
    WRITE = 0,
    LISTEN = 1
}
export declare type AreaClient = {
    sessionId: string;
    masterFrontIndex: number;
    connectionState: ClientConnectionState;
};
