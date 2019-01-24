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

import { FrontMaster, Client as GottiClient } from 'gotti-channels';
import { Protocols } from './Protocols';

import * as fossilDelta from 'fossil-delta';
import * as msgpack from 'notepack.io';

import { createTimeline, Timeline } from '@gamestdio/timeline';
import Clock from '@gamestdio/timer';
import { EventEmitter } from 'events';

import { ConnectorClient as Client } from './ConnectorClient';
import { Presence } from 'colyseus/lib/presence/Presence';
import { RemoteClient } from 'colyseus/lib/presence/RemoteClient';

import { decode, Protocol, send, WS_CLOSE_CONSENTED } from 'colyseus/lib/Protocol';
import { Deferred, logError, spliceOne } from 'colyseus/lib/Utils';

import * as jsonPatch from 'fast-json-patch'; // this is only used for debugging patches
import { debugAndPrintError, debugPatch, debugPatchData } from 'colyseus/lib/Debug';

const DEFAULT_PATCH_RATE = 1000 / 20; // 20fps (50ms)
const DEFAULT_SIMULATION_INTERVAL = 1000 / 60; // 60fps (16.66ms)

const DEFAULT_SEAT_RESERVATION_TIME = 3;

export type SimulationCallback = (deltaTime?: number) => void;

export type RoomConstructor<T> = new (masterChannel: FrontMaster, presence?: Presence) => ConnectorRoom<T>;

export interface RoomAvailable {
  roomId: string;
  clients: number;
  maxClients: number;
  metadata?: any;
}

export interface BroadcastOptions {
  except: Client;
}

export abstract class ConnectorRoom<T=any> extends EventEmitter {

  public clock: Clock = new Clock();
  public timeline?: Timeline;

  public roomId: string;
  public roomName: string;

  public maxClients: number = Infinity;
  public patchRate: number = DEFAULT_PATCH_RATE;
  public autoDispose: boolean = true;

  public state: T;
  public metadata: any = null;

  public masterChannel: FrontMaster;
  public channels: any;
  public presence: Presence;

  public clients: Client[] = [];
  public clientsBySessionId: {[sessionId: string]: Client} = {};
  protected remoteClients: {[sessionId: string]: RemoteClient} = {};

  // seat reservation & reconnection
  protected seatReservationTime: number = DEFAULT_SEAT_RESERVATION_TIME;
  protected reservedSeats: Set<string> = new Set();
  protected reservedSeatTimeouts: {[sessionId: string]: NodeJS.Timer} = {};

  protected reconnections: {[sessionId: string]: Deferred} = {};
  protected isDisconnecting: boolean = false;

  // when a new user connects, it receives the '_previousState', which holds
  // the last binary snapshot other users already have, therefore the patches
  // that follow will be the same for all clients.
  private _previousState: any;
  private _previousStateEncoded: any;

  private _simulationInterval: NodeJS.Timer;
  private _patchInterval: NodeJS.Timer;

  private _locked: boolean = false;
  private _lockedExplicitly: boolean = false;
  private _maxClientsReached: boolean = false;

  // this timeout prevents rooms that are created by one process, but no client
  // ever had success joining into it on the specified interval.
  private _autoDisposeTimeout: NodeJS.Timer;

    constructor(masterChannel: FrontMaster, presence?: Presence) {
      super();
      this.presence = presence;

      this.masterChannel = masterChannel;
      this.channels = masterChannel.frontChannels;

      this.registerAreaMessages();

      this.presence = presence;

      this.once('dispose', async () => {
        await this._dispose();
        this.emit('disconnect');
      });

      this.setPatchRate(this.patchRate);
  }

  public async init() {
      try{
        await this.masterChannel.connect();

      } catch(err) {
        throw err;
      }
  };
    // Abstract methods
  public abstract onMessage(client: Client, message: any): void;

  // added abstract methods
  public onAddedAreaListen?(client: Client, areaId: string, options?: any): void | Promise<any>;
  public onRemovedAreaListen?(client: Client, areaId: string, options?: any): void | Promise<any>;
  public onAddedAreaWrite?(client: Client, areaId: string): void | Promise<any>;
  public onRemovedAreaWrite?(client: Client, areaId: string): void | Promise<any>;

  // Optional abstract methods
  public onInit?(options: any): void;
  public onJoin?(client: Client, options?: any, auth?: any): void | Promise<any>;
  public onLeave?(client: Client, consented?: boolean): void | Promise<any>;
  public onDispose?(): void | Promise<any>;

  public requestJoin(options: any, isNew?: boolean): number | boolean {
      return 1;
  }

  /**
   * overridable methods meant for validating user requested area change ************************
   */
  public requestAreaListen(client: Client, areaId: string, options?: any): boolean {
    return false;
  }
  public requestRemoveAreaListen(client: Client, areaId: string, options?: any): boolean {
    return false;
  }
  public requestAreaWrite(client: Client, newAreaId: string, options?: any): number | boolean {
    return false;
  }
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


  public setPatchRate( milliseconds: number ): void {
      // clear previous interval in case called setPatchRate more than once
      if (this._patchInterval) {
      clearInterval(this._patchInterval);
      this._patchInterval = undefined;
    }

    if ( milliseconds !== null && milliseconds !== 0 ) {
      this._patchInterval = setInterval( this.broadcastStateUpdates.bind(this), milliseconds );
    }
  }


public lock(): void {
    // rooms locked internally aren't explicit locks.
    this._lockedExplicitly = (arguments[0] === undefined);

    // skip if already locked.
    if (this._locked) { return; }

    this.emit('lock');

    this._locked = true;
  }

  public unlock(): void {
    // only internal usage passes arguments to this function.
    if (arguments[0] === undefined) {
      this._lockedExplicitly = false;
    }

    // skip if already locked
    if (!this._locked) { return; }

    this.emit('unlock');

    this._locked = false;
  }

  public send(client: Client, data: any): void {
      send(client, [Protocols.AREA_DATA, data]);
  }

  public disconnect(): Promise<any> {
    this.isDisconnecting = true;
    this.autoDispose = true;

    this.masterChannel.disconnect();

    let i = this.clients.length;
    while (i--) {
      const client = this.clients[i];
      const reconnection = this.reconnections[client.sessionId];

      if (reconnection) {
        reconnection.reject();

      } else {
        client.close(WS_CLOSE_CONSENTED);
      }
    }

    return new Promise((resolve, reject) => {
      this.once('disconnect', () => resolve());
    });
  }

  protected broadcast(data: any, options?: BroadcastOptions): boolean {
    // no data given, try to broadcast patched state
    if (!data) {
      throw new Error('Room#broadcast: \'data\' is required to broadcast.');
    }

    let numClients = this.clients.length;
    while (numClients--) {
      const client = this.clients[ numClients ];
      if ((!options || options.except !== client)) {
        send(client, data, false);
      }
    }

    return true;
  }

  public async getAvailableData(): Promise<RoomAvailable> {
    return {
      clients: this.clients.length,
      maxClients: this.maxClients,
      metadata: this.metadata,
      roomId: this.roomId,
    };
  }

  protected sendState(client: Client): void {

    const stateUpdates = client.gottiClient.queuedEncodedUpdates;
    if (stateUpdates.length) {

      send(client, [
        Protocols.STATE_UPDATES,
        stateUpdates,
        this.clock.currentTime,
        this.clock.elapsedTime]
      );
      // clear updates after sent.
      client.gottiClient.clearStateUpdates();
    }
  }

  protected broadcastStateUpdates() {
    if (!this._simulationInterval) {
      this.clock.tick();
    }
    let numClients = this.clients.length;
    while (numClients--) {
      const client = this.clients[ numClients ];
      this.sendState(client);
    }
  }

  /**
   * since states dont live in room each client is listening for state updates from
   * back servers and will receive new state and patches all at the same time, but they
   * will be received in order so the client can set state before patching it.
   */
  protected broadcastPatch() {
    this.broadcastStateUpdates();
  }

  private _onAreaMessages() {
    /*
    this.masterChannel.frontChannels.forEach((frontChannel) => {
        frontChannel.onMessage((data, channelId) => {
          switch(data.protocol) {
            case GottiProtocol.MESSAGE_QUEUE_RELAY,
            case Protocol.ROOM_DATA,
          }
        });
    });
    */
  }
  protected async allowReconnection(client: Client, seconds: number = 15): Promise<Client> {
    if (this.isDisconnecting) {
      throw new Error('disconnecting');
    }

    await this._reserveSeat(client, seconds, true);

    // keep reconnection reference in case the user reconnects into this room.
    const reconnection = new Deferred();
    this.reconnections[client.sessionId] = reconnection;

    // expire seat reservation after timeout
    this.reservedSeatTimeouts[client.sessionId] = setTimeout(() =>
      reconnection.reject(false), seconds * 1000);

    const cleanup = () => {
      this.reservedSeats.delete(client.sessionId);
      delete this.reconnections[client.sessionId];
      delete this.reservedSeatTimeouts[client.sessionId];
    };

    reconnection.
    then(() => {
      clearTimeout(this.reservedSeatTimeouts[client.sessionId]);
      cleanup();
    }).
    catch(() => {
      cleanup();
      this._disposeIfEmpty();
    });

    return await reconnection.promise;
  }

  protected async _reserveSeat(
      client: Client,
      seconds: number = this.seatReservationTime,
      allowReconnection: boolean = false,
  ) {
      this.reservedSeats.add(client.sessionId);
      await this.presence.setex(`${this.roomId}:${client.id}`, client.sessionId, seconds);

      if (allowReconnection) {
        // store reference of the roomId this client is allowed to reconnect to.
        await this.presence.setex(client.sessionId, this.roomId, seconds);

      } else {
        this.reservedSeatTimeouts[client.sessionId] = setTimeout(() =>
          this.reservedSeats.delete(client.sessionId), seconds * 1000);

        this.resetAutoDisposeTimeout(seconds);
      }
    }

  protected resetAutoDisposeTimeout(timeoutInSeconds: number) {
      clearTimeout(this._autoDisposeTimeout);

      if (!this.autoDispose) {
        return;
      }

      this._autoDisposeTimeout = setTimeout(() => {
        this._autoDisposeTimeout = undefined;
        this._disposeIfEmpty();
      }, timeoutInSeconds * 1000);
    }

  protected _disposeIfEmpty() {
      const willDispose = (
        this.autoDispose &&
        this._autoDisposeTimeout === undefined &&
        this.clients.length === 0 &&
        this.reservedSeats.size === 0
      );

      if (willDispose) {
        this.emit('dispose');
      }

      return willDispose;
    }


  protected _dispose(): Promise<any> {
    let userReturnData;

    if (this.onDispose) {
      userReturnData = this.onDispose();
    }

    if (this._patchInterval) {
      clearInterval(this._patchInterval);
      this._patchInterval = undefined;
    }

    if (this._simulationInterval) {
      clearInterval(this._simulationInterval);
      this._simulationInterval = undefined;
    }

    // clear all timeouts/intervals + force to stop ticking
    this.clock.clear();
    this.clock.stop();

    return userReturnData || Promise.resolve();
  }

  // allow remote clients to trigger events on themselves
  private _emitOnClient(sessionId, event, args?: any) {
    const remoteClient = this.remoteClients[sessionId];

    if (!remoteClient) {
      debugAndPrintError(`trying to send event ("${event}") to non-existing remote client (${sessionId})`);
      return;
    }

    if (typeof(event) !== 'string') {
      remoteClient.emit('message', new Buffer(event));

    } else {
      remoteClient.emit(event, args);
    }
  }

  private registerClientAreaMessageHandling(client) {
    client.gottiClient.onMessage((message) => {
      if (message[0] === Protocols.ADD_AREA_LISTEN) {
        // message[1] areaId,
        // message[2] options
        this.addAreaListen(client, message[1], message[2]);
      }
      else if (message[0] === Protocols.REMOVE_AREA_LISTEN) {
        this.removeAreaListen(client, message[1], message[2]);
      }
      else if(message[0] === Protocols.CHANGE_AREA_WRITE) {
        // the removeOldWriteListener will be false since that should be explicitly sent from the old area itself.
        this.changeAreaWrite(client, message[1], false, message[2])
      } else if(message[0] === Protocols.AREA_DATA || message[0] === Protocols.GLOBAL_GAME_DATA) {
          send(client, message);
      } else {
        throw new Error('Unhandled client message protocol'+ message[0]);
      }
    });
  }
  private registerAreaMessages() {
    Object.keys(this.channels).forEach(channelId => {
      const channel = this.channels[channelId];
      channel.onMessage((message) => {
        if(message[0] === Protocols.AREA_DATA || message[0] === Protocols.GLOBAL_GAME_DATA) {
          let numClients = channel.listeningClientUids.length;
          while (numClients--) {
            const client = this.clients[ numClients ];
              send(client, message, false);
          }
        }
      });
    });
  }

  private _onAreaMessage(message) {
      this.broadcast(message);
  }

  private _onMessage(client: Client, message: any) {
      message = decode(message);
      if (!message) {
        debugAndPrintError(`${this.roomName} (${this.roomId}), couldn't decode message: ${message}`);
        return;
      }

      if (message[0] === Protocols.AREA_DATA) {
          client.gottiClient.sendLocal(message[1]);
      } else if (message[0] === Protocols.GLOBAL_GAME_DATA) {
        client.gottiClient.sendGlobal(message[1]);
      } else if (message[0] === Protocols.ADD_AREA_LISTEN) {
        this._requestAreaListen(client, message[1], message[2]);
      } else if (message[0] === Protocols.REMOVE_AREA_LISTEN) {
          this._requestRemoveAreaListen(client, message[1], message[2]);
      } else if(message[0] === Protocols.CHANGE_AREA_WRITE) {
        this._requestAreaWrite(client, message[1], message[2]);

      } else if (message[0] === Protocol.LEAVE_ROOM) {
        // stop interpreting messages from this client
        client.removeAllListeners('message');

        // prevent "onLeave" from being called twice in case the connection is forcibly closed
        client.removeAllListeners('close');

        // only effectively close connection when "onLeave" is fulfilled
        this._onLeave(client, WS_CLOSE_CONSENTED).then(() => client.close());
      } else {
        this.onMessage(client, message);
      }
    }

  private async addAreaListen(client, areaId, options?) : Promise<boolean> {
    try{
      const { responseOptions } = await client.gottiClient.linkChannel(areaId);

      const combinedOptions = responseOptions ? { options, ...responseOptions } : options;

      /* adds newest state from listened area to the clients queued state updates as a 'SET' update
       sendState method forwards then empties that queue, any future state updates from that area
       will be added to the client's queue as 'PATCH' updates. */
      this.sendState(client);

      this.onAddedAreaListen(client, areaId, combinedOptions);

      send(client, [Protocols.ADD_AREA_LISTEN, areaId, combinedOptions]);

      return true;
    } catch(err) {
   //   console.log('error was', err);
      return false;
    }
  }

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
  private async changeAreaWrite(client, newAreaId, writeOptions?, oldWriteOptions?, listenOptions?) : Promise<boolean> {

    // if the client wasnt already linked, add listener before writing.
    if(!(client.gottiClient.isLinkedToChannel(newAreaId))) {
      if (! await this.addAreaListen(client, newAreaId, listenOptions)) {
        return false
      };
    }

    const success = client.gottiClient.setProcessorChannel(newAreaId, false, writeOptions, oldWriteOptions);
    if(success) {
      this.onAddedAreaWrite(client, newAreaId);
      send(client, [Protocols.CHANGE_AREA_WRITE, newAreaId]);
      return true;
    } else {
      return false;
    }
  }

  private removeAreaListen(client, areaId, options) {
    if(!(this.masterChannel.frontChannels[areaId])) throw new Error(`Invalid areaId ${areaId}`);
    client.gottiClient.unlinkChannel(areaId);

    this.onRemovedAreaListen(client, areaId, options);

    send(client, [Protocols.REMOVE_AREA_LISTEN, areaId]);
  }

  /**
   * Used for validating user requested area changes.
   * if provided, options get sent to area and will
   * return asynchronously with response options from area
   * or a boolean indicating success
   */
  private async _requestAreaListen(client: Client, areaId: string, options?: any) : Promise<boolean>  {
      if(this.requestAreaListen(client, areaId, options)) {
        const added = await this.addAreaListen(client, areaId, options);
        return added;
      } else {
        return false;
      }
  }

  private _requestRemoveAreaListen(client: Client, areaId: string, options?: any) {
    if(this.requestRemoveAreaListen(client, areaId, options)) {
        this.removeAreaListen(client, areaId, options);
    }
  }

  private async _requestAreaWrite(client: Client, newAreaId: string, removeOldWriteListener=false, listenerOptions?: any) : Promise<boolean> {
    try{
      if (!(this.requestAreaWrite(client, newAreaId))) throw 'user defined write request validator rejected';

      return await this.changeAreaWrite(client, newAreaId, removeOldWriteListener, listenerOptions);

    }catch(err) {
      console.error(`Error changing area client write for client ${client.sessionId } 'error:' ${err}`);
      return false;
    }
  }

  private _onJoin(client: Client, options?: any, auth?: any) {
      // create remote client instance.
      if (client.remote) {
        client = (new RemoteClient(client, this.roomId, this.presence)) as any;
        this.remoteClients[client.sessionId] = client as any;
      }

      // add a gottiClient to client
      client.gottiClient = new GottiClient(client.sessionId || client.id, this.masterChannel);
      this.registerClientAreaMessageHandling(client);
      this.clients.push( client );
      this.clientsBySessionId[client.sessionId] = client;

      // delete seat reservation
      this.reservedSeats.delete(client.sessionId);
      if (this.reservedSeatTimeouts[client.sessionId]) {
        clearTimeout(this.reservedSeatTimeouts[client.sessionId]);
        delete this.reservedSeatTimeouts[client.sessionId];
      }

      // clear auto-dispose timeout.
      if (this._autoDisposeTimeout) {
        clearTimeout(this._autoDisposeTimeout);
        this._autoDisposeTimeout = undefined;
      }

      // lock automatically when maxClients is reached
      if (!this._locked && this.clients.length === this.maxClients) {
        this._maxClientsReached = true;
        this.lock.call(this, true);
      }

      // confirm room id that matches the room name requested to join
      send(client, [ Protocol.JOIN_ROOM, client.sessionId ]);

      // bind onLeave method.
      client.on('message', this._onMessage.bind(this, client));
      client.once('close', this._onLeave.bind(this, client));

      const reconnection = this.reconnections[client.sessionId];
      if (reconnection) {
        reconnection.resolve(client);

      } else {
        // emit 'join' to room handler
        this.emit('join', client);

        return this.onJoin && this.onJoin(client, options, auth);
      }
    }

  private async _onLeave(client: Client, code?: number): Promise<any> {
      // call abstract 'onLeave' method only if the client has been successfully accepted.
      if (spliceOne(this.clients, this.clients.indexOf(client)) && this.onLeave) {
        delete this.clientsBySessionId[client.sessionId];
        // disconnect gotti client too.
        client.gottiClient.unlinkChannel();
        await this.onLeave(client, (code === WS_CLOSE_CONSENTED));
    }

    this.emit('leave', client);

    // remove remote client reference
    if (client instanceof RemoteClient) {
      delete this.remoteClients[client.sessionId];
    }

    // dispose immediatelly if client reconnection isn't set up.
    const willDispose = this._disposeIfEmpty();

    // unlock if room is available for new connections
    if (!willDispose && this._maxClientsReached && !this._lockedExplicitly) {
      this._maxClientsReached = false;
      this.unlock.call(this, true);
    }
  }
}
