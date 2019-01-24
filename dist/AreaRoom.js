"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const DEFAULT_PATCH_RATE = 1000 / 20; // 20fps (50ms)
const DEFAULT_SIMULATION_INTERVAL = 1000 / 60; // 60fps (16.66ms)
class AreaRoom extends events_1.EventEmitter {
    constructor(areaChannel) {
        super();
        this.patchRate = DEFAULT_PATCH_RATE;
        this.metadata = null;
        this.clients = [];
        this.clientsLookup = {};
        this.areaId = areaChannel.channelId;
        this.areaChannel = areaChannel;
        this.areaMaster = areaChannel.masterChannel;
        this.state = areaChannel.state;
        this.registerBackChannelMessages();
        // this.setPatchRate(this.patchRate);
    }
    setState(newState) {
        /*
        if ( this.timeline ) {
            this.timeline.takeSnapshot( this.state );
        }
        */
        this.areaChannel.setState(newState);
    }
    send(sessionId, message) {
        this.areaMaster.messageClient(sessionId, [18 /* AREA_DATA */, this.areaId, message]);
    }
    ;
    broadcastListeners(message) {
        this.areaChannel.broadcastLinked([18 /* AREA_DATA */, this.areaId, message]);
    }
    broadcastAll(message) {
        this.areaChannel.broadcast([18 /* AREA_DATA */, this.areaId, message]);
    }
    ;
    /**
     * Tells the client that it should no longer be a listener to this room.
     * @param sessionId
     * @param options
     */
    removeClientListener(sessionId, options) {
        this.areaMaster.messageClient(sessionId, [22 /* REMOVE_AREA_LISTEN */, this.areaId, options]);
    }
    ;
    /**
     * used if you want the area to notify a client that they
     * must listen to a new remote area.
     * @param sessionId - session Id of client in connector room.
     * @param areaId - new area id the client is going to link to.
     * @param options - optional argument if you want to pass data between areas
     */
    addClientToArea(sessionId, areaId, options) {
        this.areaMaster.messageClient(sessionId, [21 /* ADD_AREA_LISTEN */, areaId, options]);
    }
    /**
     * sends a message to the client telling it that it should be using
     * this area room as its writer.
     * @param sessionId
     * @param options
     */
    setClientWrite(sessionId, options) {
        this.areaMaster.messageClient(sessionId, [23 /* CHANGE_AREA_WRITE */, this.areaId, options]);
    }
    ;
    _onConnectorMessage() { }
    ;
    _onMessage(sessionId, message) { }
    ;
    _onGlobalMessage(sessionId, message) { }
    ;
    _onAddedAreaClientListen(sessionId, options) { }
    ;
    _onRemovedAreaClientListen(sessionId, options) { }
    ;
    _onAddedAreaClientWrite(sessionId, options) { }
    ;
    _onRemovedAreaClientWrite(sessionId, options) { }
    ;
    registerBackChannelMessages() {
        this.areaChannel.onMessage((message) => {
            if (message[0] === 18 /* AREA_DATA */) {
                //    this.onMessage();
            }
            else if (message[0] === 20 /* GLOBAL_GAME_DATA */) {
                this.onGlobalMessage(message[1]);
            }
            else if (message[0] === 14 /* REMOTE_SYSTEM_MESSAGE */) {
                // this.onSystemMessage(message[1]);
            }
        });
    }
}
exports.AreaRoom = AreaRoom;
