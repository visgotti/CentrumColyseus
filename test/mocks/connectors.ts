import { ConnectorRoom } from '../../src/ConnectorRoom'
import { AreaRoom } from '../../src/AreaRoom'
import { generateId } from 'colyseus/lib/index';
import { EventEmitter } from "events";
import { BackChannel, FrontMaster } from 'centrum';
import * as WebSocket from "ws";
import * as msgpack from "notepack.io";
import { LocalPresence } from 'colyseus/lib/presence/LocalPresence';
import { Protocol } from "colyseus/lib/Protocol";

export function awaitForTimeout(ms: number = 200) {
    return new Promise((resolve, reject) => setTimeout(resolve, ms));
}

export function createDummyClient (options: any = {}): any {
    let client = new Client(generateId());
    (<any>client).options = options;
    return client;
}

export class Client extends EventEmitter {

    public id: string;
    public messages: Array<any> = [];
    public readyState: number = WebSocket.OPEN;

    constructor (id?: string) {
        super();
        this.id = id || null;

        this.once('close', () => {
            this.readyState = WebSocket.CLOSED
        });
    }

    send (message) {
        this.messages.push(message);
    }

    receive (message) {
        this.emit('message', msgpack.encode(message));
    }

    getMessageAt(index: number) {
        return msgpack.decode(this.messages[index]);
    }

    get lastMessage () {
        return this.getMessageAt(this.messages.length - 1);
    }

    close (code?: number) {
        this.readyState = WebSocket.CLOSED;
        this.emit('close');
    }
}


export class DummyConnectorRoom extends ConnectorRoom {
    constructor (frontMaster: FrontMaster) {
        super(frontMaster, new LocalPresence());
    }

    onAuth() {};

    requestJoin (options) {
        return !options.invalid_param
    }

    onInit () {}
    onJoin() {}
    onMessage(client, message) {}

    onLeave() {}
    onDispose() {}
}


export class DummyConnectorApprovalRoom extends ConnectorRoom {
    constructor (frontMaster: FrontMaster) {
        super(frontMaster, new LocalPresence());
    }
    onAddedAreaListen(client: Client, areaId: string, options?: any) {};
    onRemovedAreaListen(client: Client, areaId: string, options?: any) {};
    onAddedAreaWrite(client: Client, areaId: string, options?: any) {};
    onRemovedAreaWrite(client: Client, areaId: string, options?: any) {};

    onAuth() {};
    requestAreaListen(client, areaId, options?) {
        return true;
    }
    requestRemoveAreaListen(client, areaId, options?) {
        return true;
    }
    requestAreaWrite(client, areaId, options?) {
        return true;
    }
    requestJoin (options) {
        return !options.invalid_param
    }

    onInit () {}
    onJoin() {}
    onMessage(client, message) {}

    onLeave() {}
    onDispose() {}
}


export class DummyConnectorRoomWithAsync extends ConnectorRoom {
    static ASYNC_TIMEOUT = 200;

    maxClients = 1;

    async onAuth() {
        await awaitForTimeout(DummyConnectorRoomWithAsync.ASYNC_TIMEOUT);
        return true;
    }

    constructor (frontMaster: FrontMaster) {
        super(frontMaster, new LocalPresence());
    }
    requestJoin (options) {
        return !options.invalid_param
    }
    onInit () {}
    onJoin() {}
    onMessage(client, message) {}

    async onLeave() {
        await awaitForTimeout(DummyConnectorRoomWithAsync.ASYNC_TIMEOUT);
    }

    async onDispose() {
        await awaitForTimeout(DummyConnectorRoomWithAsync.ASYNC_TIMEOUT);
    }
}



