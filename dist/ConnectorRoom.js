"use strict";
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const gotti_channels_1 = require("gotti-channels");
const timer_1 = require("@gamestdio/timer");
const events_1 = require("events");
const RemoteClient_1 = require("colyseus/lib/presence/RemoteClient");
const Protocol_1 = require("colyseus/lib/Protocol");
const Utils_1 = require("colyseus/lib/Utils");
const Debug_1 = require("colyseus/lib/Debug");
const DEFAULT_PATCH_RATE = 1000 / 20; // 20fps (50ms)
const DEFAULT_SIMULATION_INTERVAL = 1000 / 60; // 60fps (16.66ms)
const DEFAULT_SEAT_RESERVATION_TIME = 3;
class ConnectorRoom extends events_1.EventEmitter {
    constructor(masterChannel, presence) {
        super();
        this.clock = new timer_1.default();
        this.maxClients = Infinity;
        this.patchRate = DEFAULT_PATCH_RATE;
        this.autoDispose = true;
        this.metadata = null;
        this.clients = [];
        this.clientsBySessionId = {};
        this.remoteClients = {};
        // seat reservation & reconnection
        this.seatReservationTime = DEFAULT_SEAT_RESERVATION_TIME;
        this.reservedSeats = new Set();
        this.reservedSeatTimeouts = {};
        this.reconnections = {};
        this.isDisconnecting = false;
        this._locked = false;
        this._lockedExplicitly = false;
        this._maxClientsReached = false;
        this.presence = presence;
        this.masterChannel = masterChannel;
        this.channels = masterChannel.frontChannels;
        this.registerAreaMessages();
        this.presence = presence;
        this.once('dispose', () => __awaiter(this, void 0, void 0, function* () {
            yield this._dispose();
            this.emit('disconnect');
        }));
        this.setPatchRate(this.patchRate);
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.masterChannel.connect();
            }
            catch (err) {
                throw err;
            }
        });
    }
    ;
    requestJoin(options, isNew) {
        return 1;
    }
    /**
     * overridable methods meant for validating user requested area change ************************
     */
    requestAreaListen(client, areaId, options) {
        return false;
    }
    requestRemoveAreaListen(client, areaId, options) {
        return false;
    }
    requestAreaWrite(client, newAreaId, options) {
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
    setPatchRate(milliseconds) {
        // clear previous interval in case called setPatchRate more than once
        if (this._patchInterval) {
            clearInterval(this._patchInterval);
            this._patchInterval = undefined;
        }
        if (milliseconds !== null && milliseconds !== 0) {
            this._patchInterval = setInterval(this.broadcastStateUpdates.bind(this), milliseconds);
        }
    }
    lock() {
        // rooms locked internally aren't explicit locks.
        this._lockedExplicitly = (arguments[0] === undefined);
        // skip if already locked.
        if (this._locked) {
            return;
        }
        this.emit('lock');
        this._locked = true;
    }
    unlock() {
        // only internal usage passes arguments to this function.
        if (arguments[0] === undefined) {
            this._lockedExplicitly = false;
        }
        // skip if already locked
        if (!this._locked) {
            return;
        }
        this.emit('unlock');
        this._locked = false;
    }
    send(client, data) {
        Protocol_1.send(client, [18 /* AREA_DATA */, data]);
    }
    disconnect() {
        this.isDisconnecting = true;
        this.autoDispose = true;
        this.masterChannel.disconnect();
        let i = this.clients.length;
        while (i--) {
            const client = this.clients[i];
            const reconnection = this.reconnections[client.sessionId];
            if (reconnection) {
                reconnection.reject();
            }
            else {
                client.close(Protocol_1.WS_CLOSE_CONSENTED);
            }
        }
        return new Promise((resolve, reject) => {
            this.once('disconnect', () => resolve());
        });
    }
    broadcast(data, options) {
        // no data given, try to broadcast patched state
        if (!data) {
            throw new Error('Room#broadcast: \'data\' is required to broadcast.');
        }
        let numClients = this.clients.length;
        while (numClients--) {
            const client = this.clients[numClients];
            if ((!options || options.except !== client)) {
                Protocol_1.send(client, data, false);
            }
        }
        return true;
    }
    getAvailableData() {
        return __awaiter(this, void 0, void 0, function* () {
            return {
                clients: this.clients.length,
                maxClients: this.maxClients,
                metadata: this.metadata,
                roomId: this.roomId,
            };
        });
    }
    sendState(client) {
        const stateUpdates = client.gottiClient.queuedEncodedUpdates;
        if (stateUpdates.length) {
            Protocol_1.send(client, [
                24 /* STATE_UPDATES */,
                stateUpdates,
                this.clock.currentTime,
                this.clock.elapsedTime
            ]);
            // clear updates after sent.
            client.gottiClient.clearStateUpdates();
        }
    }
    broadcastStateUpdates() {
        if (!this._simulationInterval) {
            this.clock.tick();
        }
        let numClients = this.clients.length;
        while (numClients--) {
            const client = this.clients[numClients];
            this.sendState(client);
        }
    }
    /**
     * since states dont live in room each client is listening for state updates from
     * back servers and will receive new state and patches all at the same time, but they
     * will be received in order so the client can set state before patching it.
     */
    broadcastPatch() {
        this.broadcastStateUpdates();
    }
    _onAreaMessages() {
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
    allowReconnection(client, seconds = 15) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isDisconnecting) {
                throw new Error('disconnecting');
            }
            yield this._reserveSeat(client, seconds, true);
            // keep reconnection reference in case the user reconnects into this room.
            const reconnection = new Utils_1.Deferred();
            this.reconnections[client.sessionId] = reconnection;
            // expire seat reservation after timeout
            this.reservedSeatTimeouts[client.sessionId] = setTimeout(() => reconnection.reject(false), seconds * 1000);
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
            return yield reconnection.promise;
        });
    }
    _reserveSeat(client, seconds = this.seatReservationTime, allowReconnection = false) {
        return __awaiter(this, void 0, void 0, function* () {
            this.reservedSeats.add(client.sessionId);
            yield this.presence.setex(`${this.roomId}:${client.id}`, client.sessionId, seconds);
            if (allowReconnection) {
                // store reference of the roomId this client is allowed to reconnect to.
                yield this.presence.setex(client.sessionId, this.roomId, seconds);
            }
            else {
                this.reservedSeatTimeouts[client.sessionId] = setTimeout(() => this.reservedSeats.delete(client.sessionId), seconds * 1000);
                this.resetAutoDisposeTimeout(seconds);
            }
        });
    }
    resetAutoDisposeTimeout(timeoutInSeconds) {
        clearTimeout(this._autoDisposeTimeout);
        if (!this.autoDispose) {
            return;
        }
        this._autoDisposeTimeout = setTimeout(() => {
            this._autoDisposeTimeout = undefined;
            this._disposeIfEmpty();
        }, timeoutInSeconds * 1000);
    }
    _disposeIfEmpty() {
        const willDispose = (this.autoDispose &&
            this._autoDisposeTimeout === undefined &&
            this.clients.length === 0 &&
            this.reservedSeats.size === 0);
        if (willDispose) {
            this.emit('dispose');
        }
        return willDispose;
    }
    _dispose() {
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
    _emitOnClient(sessionId, event, args) {
        const remoteClient = this.remoteClients[sessionId];
        if (!remoteClient) {
            Debug_1.debugAndPrintError(`trying to send event ("${event}") to non-existing remote client (${sessionId})`);
            return;
        }
        if (typeof (event) !== 'string') {
            remoteClient.emit('message', new Buffer(event));
        }
        else {
            remoteClient.emit(event, args);
        }
    }
    registerClientAreaMessageHandling(client) {
        client.gottiClient.onMessage((message) => {
            if (message[0] === 21 /* ADD_AREA_LISTEN */) {
                // message[1] areaId,
                // message[2] options
                this.addAreaListen(client, message[1], message[2]);
            }
            else if (message[0] === 22 /* REMOVE_AREA_LISTEN */) {
                this.removeAreaListen(client, message[1], message[2]);
            }
            else if (message[0] === 23 /* CHANGE_AREA_WRITE */) {
                // the removeOldWriteListener will be false since that should be explicitly sent from the old area itself.
                this.changeAreaWrite(client, message[1], false, message[2]);
            }
            else if (message[0] === 18 /* AREA_DATA */ || message[0] === 20 /* GLOBAL_GAME_DATA */) {
                Protocol_1.send(client, message);
            }
            else {
                throw new Error('Unhandled client message protocol' + message[0]);
            }
        });
    }
    registerAreaMessages() {
        Object.keys(this.channels).forEach(channelId => {
            const channel = this.channels[channelId];
            channel.onMessage((message) => {
                if (message[0] === 18 /* AREA_DATA */ || message[0] === 20 /* GLOBAL_GAME_DATA */) {
                    let numClients = channel.listeningClientUids.length;
                    while (numClients--) {
                        const client = this.clients[numClients];
                        Protocol_1.send(client, message, false);
                    }
                }
            });
        });
    }
    _onAreaMessage(message) {
        this.broadcast(message);
    }
    _onMessage(client, message) {
        message = Protocol_1.decode(message);
        if (!message) {
            Debug_1.debugAndPrintError(`${this.roomName} (${this.roomId}), couldn't decode message: ${message}`);
            return;
        }
        if (message[0] === 18 /* AREA_DATA */) {
            client.gottiClient.sendLocal(message[1]);
        }
        else if (message[0] === 20 /* GLOBAL_GAME_DATA */) {
            client.gottiClient.sendGlobal(message[1]);
        }
        else if (message[0] === 21 /* ADD_AREA_LISTEN */) {
            this._requestAreaListen(client, message[1], message[2]);
        }
        else if (message[0] === 22 /* REMOVE_AREA_LISTEN */) {
            this._requestRemoveAreaListen(client, message[1], message[2]);
        }
        else if (message[0] === 23 /* CHANGE_AREA_WRITE */) {
            this._requestAreaWrite(client, message[1], message[2]);
        }
        else if (message[0] === Protocol_1.Protocol.LEAVE_ROOM) {
            // stop interpreting messages from this client
            client.removeAllListeners('message');
            // prevent "onLeave" from being called twice in case the connection is forcibly closed
            client.removeAllListeners('close');
            // only effectively close connection when "onLeave" is fulfilled
            this._onLeave(client, Protocol_1.WS_CLOSE_CONSENTED).then(() => client.close());
        }
        else {
            this.onMessage(client, message);
        }
    }
    addAreaListen(client, areaId, options) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { responseOptions } = yield client.gottiClient.linkChannel(areaId);
                const combinedOptions = responseOptions ? Object.assign({ options }, responseOptions) : options;
                /* adds newest state from listened area to the clients queued state updates as a 'SET' update
                 sendState method forwards then empties that queue, any future state updates from that area
                 will be added to the client's queue as 'PATCH' updates. */
                this.sendState(client);
                this.onAddedAreaListen(client, areaId, combinedOptions);
                Protocol_1.send(client, [21 /* ADD_AREA_LISTEN */, areaId, combinedOptions]);
                return true;
            }
            catch (err) {
                //   console.log('error was', err);
                return false;
            }
        });
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
    changeAreaWrite(client, newAreaId, writeOptions, oldWriteOptions, listenOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            // if the client wasnt already linked, add listener before writing.
            if (!(client.gottiClient.isLinkedToChannel(newAreaId))) {
                if (!(yield this.addAreaListen(client, newAreaId, listenOptions))) {
                    return false;
                }
                ;
            }
            const success = client.gottiClient.setProcessorChannel(newAreaId, false, writeOptions, oldWriteOptions);
            if (success) {
                this.onAddedAreaWrite(client, newAreaId);
                Protocol_1.send(client, [23 /* CHANGE_AREA_WRITE */, newAreaId]);
                return true;
            }
            else {
                return false;
            }
        });
    }
    removeAreaListen(client, areaId, options) {
        if (!(this.masterChannel.frontChannels[areaId]))
            throw new Error(`Invalid areaId ${areaId}`);
        client.gottiClient.unlinkChannel(areaId);
        this.onRemovedAreaListen(client, areaId, options);
        Protocol_1.send(client, [22 /* REMOVE_AREA_LISTEN */, areaId]);
    }
    /**
     * Used for validating user requested area changes.
     * if provided, options get sent to area and will
     * return asynchronously with response options from area
     * or a boolean indicating success
     */
    _requestAreaListen(client, areaId, options) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.requestAreaListen(client, areaId, options)) {
                const added = yield this.addAreaListen(client, areaId, options);
                return added;
            }
            else {
                return false;
            }
        });
    }
    _requestRemoveAreaListen(client, areaId, options) {
        if (this.requestRemoveAreaListen(client, areaId, options)) {
            this.removeAreaListen(client, areaId, options);
        }
    }
    _requestAreaWrite(client, newAreaId, removeOldWriteListener = false, listenerOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!(this.requestAreaWrite(client, newAreaId)))
                    throw 'user defined write request validator rejected';
                return yield this.changeAreaWrite(client, newAreaId, removeOldWriteListener, listenerOptions);
            }
            catch (err) {
                console.error(`Error changing area client write for client ${client.sessionId} 'error:' ${err}`);
                return false;
            }
        });
    }
    _onJoin(client, options, auth) {
        // create remote client instance.
        if (client.remote) {
            client = (new RemoteClient_1.RemoteClient(client, this.roomId, this.presence));
            this.remoteClients[client.sessionId] = client;
        }
        // add a gottiClient to client
        client.gottiClient = new gotti_channels_1.Client(client.sessionId || client.id, this.masterChannel);
        this.registerClientAreaMessageHandling(client);
        this.clients.push(client);
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
        Protocol_1.send(client, [Protocol_1.Protocol.JOIN_ROOM, client.sessionId]);
        // bind onLeave method.
        client.on('message', this._onMessage.bind(this, client));
        client.once('close', this._onLeave.bind(this, client));
        const reconnection = this.reconnections[client.sessionId];
        if (reconnection) {
            reconnection.resolve(client);
        }
        else {
            // emit 'join' to room handler
            this.emit('join', client);
            return this.onJoin && this.onJoin(client, options, auth);
        }
    }
    _onLeave(client, code) {
        return __awaiter(this, void 0, void 0, function* () {
            // call abstract 'onLeave' method only if the client has been successfully accepted.
            if (Utils_1.spliceOne(this.clients, this.clients.indexOf(client)) && this.onLeave) {
                delete this.clientsBySessionId[client.sessionId];
                // disconnect gotti client too.
                client.gottiClient.unlinkChannel();
                yield this.onLeave(client, (code === Protocol_1.WS_CLOSE_CONSENTED));
            }
            this.emit('leave', client);
            // remove remote client reference
            if (client instanceof RemoteClient_1.RemoteClient) {
                delete this.remoteClients[client.sessionId];
            }
            // dispose immediatelly if client reconnection isn't set up.
            const willDispose = this._disposeIfEmpty();
            // unlock if room is available for new connections
            if (!willDispose && this._maxClientsReached && !this._lockedExplicitly) {
                this._maxClientsReached = false;
                this.unlock.call(this, true);
            }
        });
    }
}
exports.ConnectorRoom = ConnectorRoom;
