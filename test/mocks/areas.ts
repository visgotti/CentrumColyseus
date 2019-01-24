import { ConnectorRoom } from '../../src/ConnectorRoom'
import { AreaRoom } from '../../src/AreaRoom'
import { generateId } from 'colyseus/lib/index';
import { EventEmitter } from "events";
import { BackChannel, FrontMaster } from 'centrum';
import * as WebSocket from "ws";
import * as msgpack from "notepack.io";
import { LocalPresence } from 'colyseus/lib/presence/LocalPresence';
import { Protocol } from "colyseus/lib/Protocol";

export class DummyAreaRoom extends AreaRoom {
    constructor (backChannel: BackChannel) {
        super(backChannel);
    }

    onInit () {}
    onDispose() {}
    onJoin() {}
    onLeave() {}
    onListen() {};
    onRemoveListen() {};
    onMessage(client, message) { this.broadcastListeners(message); }
    onGlobalMessage(message) { this.broadcastAll(message); } ;
}
