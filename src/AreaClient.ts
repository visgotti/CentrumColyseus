
// Export 'WebSocket' as 'Client' with 'id' property.

export enum ClientConnectionState {
    WRITE,
    LISTEN
}

export type AreaClient = {
    sessionId: string,
    masterFrontIndex: number,
    connectionState: ClientConnectionState
};