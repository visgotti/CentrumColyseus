/// <reference types="node" />
/**
 * Connector Client is the same thing as the regular colyseus client and has all the same functionality
 * with the additional 'centrumClient' object and its methods to communicate with the centrum back channels
 * which are aliased as 'Areas'
 */
import { Client as GottiClient } from 'gotti-channels';
import * as WebSocket from 'ws';
import * as http from 'http';
export declare type ConnectorClient = WebSocket & {
    upgradeReq?: http.IncomingMessage;
    id: string;
    options: any;
    sessionId: string;
    pingCount: number;
    remote?: boolean;
    auth?: any;
    gottiClient: GottiClient;
};
