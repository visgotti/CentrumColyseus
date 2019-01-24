/***************************************************************************************
 *  Modified implementation of the original Room class in colyseus, most of the code
 *  is copied directly from the version of colyseus the project was started with to prevent
 *  breaking changes that would come from extending or implementing it directly.
 *
 *  Original code was written by-
 *  https://github.com/colyseus and https://github.com/endel
 *
 *  modified to fit GottiColyseus by -
 *  https://github.com/visgotti
 ***************************************************************************************/
/// <reference types="node" />
import { FrontMaster } from 'gotti-channels';
import { Timeline } from '@gamestdio/timeline';
import Clock from '@gamestdio/timer';
import { EventEmitter } from 'events';
import { ConnectorClient as Client } from './ConnectorClient';
import { Presence } from 'colyseus/lib/presence/Presence';
import { RemoteClient } from 'colyseus/lib/presence/RemoteClient';
import { Deferred } from 'colyseus/lib/Utils';
export declare type SimulationCallback = (deltaTime?: number) => void;
export declare type RoomConstructor<T> = new (masterChannel: FrontMaster, presence?: Presence) => ConnectorRoom<T>;
export interface RoomAvailable {
    roomId: string;
    clients: number;
    maxClients: number;
    metadata?: any;
}
export interface BroadcastOptions {
    except: Client;
}
export declare abstract class ConnectorRoom<T = any> extends EventEmitter {
    clock: Clock;
    timeline?: Timeline;
    roomId: string;
    roomName: string;
    maxClients: number;
    patchRate: number;
    autoDispose: boolean;
    state: T;
    metadata: any;
    masterChannel: FrontMaster;
    channels: any;
    presence: Presence;
    clients: Client[];
    clientsBySessionId: {
        [sessionId: string]: Client;
    };
    protected remoteClients: {
        [sessionId: string]: RemoteClient;
    };
    protected seatReservationTime: number;
    protected reservedSeats: Set<string>;
    protected reservedSeatTimeouts: {
        [sessionId: string]: NodeJS.Timer;
    };
    protected reconnections: {
        [sessionId: string]: Deferred;
    };
    protected isDisconnecting: boolean;
    private _previousState;
    private _previousStateEncoded;
    private _simulationInterval;
    private _patchInterval;
    private _locked;
    private _lockedExplicitly;
    private _maxClientsReached;
    private _autoDisposeTimeout;
    constructor(masterChannel: FrontMaster, presence?: Presence);
    init(): Promise<void>;
    abstract onMessage(client: Client, message: any): void;
    onAddedAreaListen?(client: Client, areaId: string, options?: any): void | Promise<any>;
    onRemovedAreaListen?(client: Client, areaId: string, options?: any): void | Promise<any>;
    onAddedAreaWrite?(client: Client, areaId: string): void | Promise<any>;
    onRemovedAreaWrite?(client: Client, areaId: string): void | Promise<any>;
    onInit?(options: any): void;
    onJoin?(client: Client, options?: any, auth?: any): void | Promise<any>;
    onLeave?(client: Client, consented?: boolean): void | Promise<any>;
    onDispose?(): void | Promise<any>;
    requestJoin(options: any, isNew?: boolean): number | boolean;
    /**
     * overridable methods meant for validating user requested area change ************************
     */
    requestAreaListen(client: Client, areaId: string, options?: any): boolean;
    requestRemoveAreaListen(client: Client, areaId: string, options?: any): boolean;
    requestAreaWrite(client: Client, newAreaId: string, options?: any): number | boolean;
    /************************************************************************************************
  
    public onAuth(options: any): boolean | Promise<any> {
        return true;
    }
  
    public get locked() {
      return this._locked;
    }
  
    public hasReachedMaxClients(): boolean {
      return (this.clients.length + this.reservedSeats.size) >= this.maxClients;
    }
  
    public setSeatReservationTime(seconds: number) {
      this.seatReservationTime = seconds;
      return this;
    }
  
    public hasReservedSeat(sessionId: string): boolean {
      return this.reservedSeats.has(sessionId);
    }
  
    public useTimeline( maxSnapshots: number = 10 ): void {
        this.timeline = createTimeline( maxSnapshots );
    }
  
  
    public setSimulationInterval( callback: SimulationCallback, delay: number = DEFAULT_SIMULATION_INTERVAL ): void {
      // clear previous interval in case called setSimulationInterval more than once
      if ( this._simulationInterval ) { clearInterval( this._simulationInterval ); }
  
      this._simulationInterval = setInterval( () => {
        this.clock.tick();
        callback(this.clock.deltaTime);
      }, delay );
    }
  
  
    public setState(newState) {}
  
    public setMetadata(meta: any) {
      this.metadata = meta;
    }
     */
    setPatchRate(milliseconds: number): void;
    lock(): void;
    unlock(): void;
    send(client: Client, data: any): void;
    disconnect(): Promise<any>;
    protected broadcast(data: any, options?: BroadcastOptions): boolean;
    getAvailableData(): Promise<RoomAvailable>;
    protected sendState(client: Client): void;
    protected broadcastStateUpdates(): void;
    /**
     * since states dont live in room each client is listening for state updates from
     * back servers and will receive new state and patches all at the same time, but they
     * will be received in order so the client can set state before patching it.
     */
    protected broadcastPatch(): void;
    private _onAreaMessages;
    protected allowReconnection(client: Client, seconds?: number): Promise<Client>;
    protected _reserveSeat(client: Client, seconds?: number, allowReconnection?: boolean): Promise<void>;
    protected resetAutoDisposeTimeout(timeoutInSeconds: number): void;
    protected _disposeIfEmpty(): boolean;
    protected _dispose(): Promise<any>;
    private _emitOnClient;
    private registerClientAreaMessageHandling;
    private registerAreaMessages;
    private _onAreaMessage;
    private _onMessage;
    private addAreaListen;
    /**
     * Function that will send a notifcation to the area telling it that a new client has just become
     * a new writer, and it will trigger the onJoin hook with the sessionId of client and any options
     * you pass in as the write options. You must be a listener to the area before writing to it, this
     * is because all writers listen and listening where the real handshaking between the connector and
     * area is done. This will automatically listen before writing- therefore you have the optional listenOptions
     * in case you've configured your area to do specific things on the area room's onListen hook. Which will always be called
     * first before the onJoin. oldWriteOptions will be sent to the previous writing area and trigger the onLeave hook of that area.
     * You are still listening to the area after you leave as a writer, you must call removeClientListen if you want
     * the client to completely stop listening for messages and state updates.
     * @param client
     * @param newAreaId - new area id that will become the writer
     * @param writeOptions - options that get sent with the new write client notification to the new area
     * @param oldWriteOptions - options that get sent to the old write area that youre leaving
     * @param listenOptions - options that you pass to the new area before becoming a writer (must be a listener before becoming a writer)
     * @returns {boolean}
     */
    private changeAreaWrite;
    private removeAreaListen;
    /**
     * Used for validating user requested area changes.
     * if provided, options get sent to area and will
     * return asynchronously with response options from area
     * or a boolean indicating success
     */
    private _requestAreaListen;
    private _requestRemoveAreaListen;
    private _requestAreaWrite;
    private _onJoin;
    private _onLeave;
}
