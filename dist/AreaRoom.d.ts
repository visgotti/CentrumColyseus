/// <reference types="node" />
import { AreaClient } from './AreaClient';
import { BackChannel } from 'gotti-channels';
import { EventEmitter } from 'events';
export declare abstract class AreaRoom extends EventEmitter {
    areaId: string;
    areaType: string;
    patchRate: number;
    state: any;
    metadata: any;
    clients: Array<AreaClient>;
    protected clientsLookup: {
        [sessionId: string]: AreaClient;
    };
    private areaChannel;
    private areaMaster;
    private _simulationInterval;
    private _patchInterval;
    constructor(areaChannel: BackChannel);
    abstract onMessage(sessionId: string, message: any): void;
    abstract onGlobalMessage(message: any): void;
    onInit?(options: any): void;
    onJoin?(sessionId: string, options?: any): void;
    onLeave?(sessionId: string, options?: any): void;
    onListen?(sessionId: string, options: any): void;
    onRemoveListen?(sessionId: string, options: any): void;
    setState(newState: any): void;
    send(sessionId: any, message: any): void;
    broadcastListeners(message: any): void;
    broadcastAll(message: any): void;
    /**
     * Tells the client that it should no longer be a listener to this room.
     * @param sessionId
     * @param options
     */
    removeClientListener(sessionId: any, options?: any): void;
    /**
     * used if you want the area to notify a client that they
     * must listen to a new remote area.
     * @param sessionId - session Id of client in connector room.
     * @param areaId - new area id the client is going to link to.
     * @param options - optional argument if you want to pass data between areas
     */
    addClientToArea(sessionId: any, areaId: any, options?: any): void;
    /**
     * sends a message to the client telling it that it should be using
     * this area room as its writer.
     * @param sessionId
     * @param options
     */
    setClientWrite(sessionId: any, options?: any): void;
    private _onConnectorMessage;
    private _onMessage;
    private _onGlobalMessage;
    private _onAddedAreaClientListen;
    private _onRemovedAreaClientListen;
    private _onAddedAreaClientWrite;
    private _onRemovedAreaClientWrite;
    private registerBackChannelMessages;
}
