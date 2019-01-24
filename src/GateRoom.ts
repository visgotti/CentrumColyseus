import { Room } from 'colyseus';

import { GateProtocols } from './Protocols';

export class GateConnector extends Room {
    constructor() {
        this.available = {}
    }

    onAuth() {
        return true;
    }

    onJoin() {
        return true;
    }

    requestJoin(options, isNew) {
        return true;
    }

    onLeave(client, consented) {
        //  this.state.clientLeft(client);
    }

    onMessage(client, message) {
        if(message[0] === GateProtocols.CLIENT_REQUEST_CONNECTOR) {
            if(this.available[message[1]]) {
                this.send(client, this.available[message[1]])
            } else {
                this.send(client, false);
            }
        }
    }
}