import * as assert from "assert";
import * as msgpack from "notepack.io";
import * as mocha from 'mocha';
import * as sinon from 'sinon';
import * as WebSocket from "ws";

import { Protocols } from '../src/Protocols'
import { ConnectorRoom as Room } from "../src/ConnectorRoom";
import { MatchMaker } from 'colyseus/lib/MatchMaker';
import { Protocol } from "colyseus/lib/Protocol";

import {
    createDummyClient,
    DummyConnectorRoom,
    DummyAreaRoom,
    DummyConnectorRoomWithAsync,
    DummyConnectorApprovalRoom
} from './mock/areas';

import { generateId } from 'colyseus/lib/index';

import { AreaClient } from '../src/AreaClient';
import { ConnectorClient } from '../src/ConnectorClient';

import { Messenger } from 'centrum-messengers/dist/core/Messenger';
import { FrontMaster, BackMaster } from 'centrum';

let connectorAsyncRoom;

let client1;
let client2;

let frontMaster1;
let frontMaster2;

let connectorAcceptRoom1;
let connectorAcceptRoom2;

let backMaster1;
let backMaster2;

let areaRooms = [];
let connectorRooms = [];

const TEST_FRONT_1_URI = 'tcp://127.0.0.1:4000';
const TEST_FRONT_2_URI = 'tcp://127.0.0.1:4001';

const TEST_BACK_1_URI = 'tcp://127.0.0.1:5000';
const TEST_BACK_2_URI = 'tcp://127.0.0.1:5001';

describe('Gotti/Colyseus Area Room Integration tests', () => {

    beforeEach('initializes rooms', (done) => {

        // initialize centrum messengers
        const frontMessenger1 = new Messenger({ id: 'testFront1', publish: { pubSocketURI: TEST_FRONT_1_URI } , subscribe: { pubSocketURIs: [TEST_BACK_1_URI, TEST_BACK_2_URI] } });
        const frontMessenger2 = new Messenger({ id: 'testFront2', publish: { pubSocketURI: TEST_FRONT_2_URI } , subscribe: { pubSocketURIs: [TEST_BACK_1_URI, TEST_BACK_2_URI] } });

        const backMessenger1 = new Messenger({ id: 'testBack1', publish: { pubSocketURI: TEST_BACK_1_URI } , subscribe: { pubSocketURIs: [TEST_FRONT_1_URI, TEST_FRONT_2_URI] } });
        const backMessenger2 = new Messenger({ id: 'testBack2', publish: { pubSocketURI: TEST_BACK_2_URI } , subscribe: { pubSocketURIs: [TEST_FRONT_1_URI, TEST_FRONT_2_URI] } });

        frontMaster1 = new FrontMaster([0, 1, 2, 3, 4, 5], 0, frontMessenger1);
        frontMaster2 = new FrontMaster([0, 1, 2, 3, 4, 5], 1, frontMessenger2);
        backMaster1 = new BackMaster([0, 1, 2], 0, backMessenger1);
        backMaster2 = new BackMaster([3, 4, 5], 1, backMessenger2);


        backMaster1.backChannelsArray.forEach((backChannel) => {
            areaRooms.push(new DummyAreaRoom(backChannel));
        });

        backMaster2.backChannelsArray.forEach((backChannel) => {
            areaRooms.push(new DummyAreaRoom(backChannel));
        });

        assert.strictEqual(areaRooms.length, 6);

        connectorAsyncRoom = new DummyConnectorRoomWithAsync(frontMaster1);
        connectorAcceptRoom1 = new DummyConnectorApprovalRoom(frontMaster1);
        connectorAcceptRoom2 = new DummyConnectorApprovalRoom(frontMaster2);
        connectorRooms.push(new DummyConnectorRoom(frontMaster1));
        connectorRooms.push(new DummyConnectorRoom(frontMaster2));

        client1 = createDummyClient();
        client2 = createDummyClient();
        done();
    });

    afterEach((done) => {
        client1 = null;
        client2 = null;

        connectorRooms[0].disconnect();
        connectorRooms[1].disconnect();
        connectorAsyncRoom.disconnect();

        areaRooms.length = 0;
        connectorRooms.length = 0;

        backMaster1.disconnect();
        backMaster1 = null;

        backMaster2.disconnect();
        backMaster2 = null;

        frontMaster1.disconnect();
        frontMaster1 = null;

        frontMaster2.disconnect();
        frontMaster2 = null;
        done();
    });

    describe('Area Room', () => {
        describe('#onJoin/#onLeave', function() {
        })
    });
});
