import * as assert from "assert";
import * as msgpack from "notepack.io";
import * as mocha from 'mocha';
import * as sinon from 'sinon';
import * as WebSocket from "ws";

import { Protocols } from '../src/Protocols'
import { ConnectorRoom as Room } from "../src/ConnectorRoom";
import { MatchMaker } from 'colyseus/lib/MatchMaker';
import { Protocol } from "colyseus/lib/Protocol";

import { FrontMaster, BackMaster } from 'gotti-channels';

import {
    createDummyClient,
    DummyConnectorRoom,
    DummyConnectorRoomWithAsync,
    DummyConnectorApprovalRoom
} from './mocks/connectors';

import {
    DummyAreaRoom,
} from './mocks/areas';

import { generateId } from 'colyseus/lib/index';

import { AreaClient } from '../src/AreaClient';
import { ConnectorClient } from '../src/ConnectorClient';

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

describe('Gotti/Colyseus Room Integration tests', () => {

    beforeEach('initializes rooms', (done) => {
        frontMaster1 = new FrontMaster(0);
        frontMaster1.initialize(TEST_FRONT_1_URI, [TEST_BACK_1_URI, TEST_BACK_2_URI]);
        frontMaster1.addChannels([0, 1, 2, 3, 4, 5]);

        frontMaster2 = new FrontMaster(1);
        frontMaster2.initialize(TEST_FRONT_2_URI, [TEST_BACK_1_URI, TEST_BACK_2_URI]);
        frontMaster2.addChannels([0, 1, 2, 3, 4, 5]);

        backMaster1 = new BackMaster(0);
        backMaster1.initialize(TEST_BACK_1_URI, [TEST_FRONT_1_URI, TEST_FRONT_2_URI]);
        backMaster1.addChannels([0, 1, 2]);

        backMaster2 = new BackMaster(1);
        backMaster2.initialize(TEST_BACK_2_URI, [TEST_FRONT_1_URI, TEST_FRONT_2_URI]);
        backMaster1.addChannels([3, 4, 5]);

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

    describe('Connector Room', () => {
        describe('#onJoin/#onLeave', function() {
            it('should receive onJoin messages and add centrumClient to client', function () {
                var message = null;
                connectorRooms[0]._onJoin(client1, {});
                assert.equal(client1.messages.length, 1);
                assert.ok(client1.hasOwnProperty('centrumClient'));
                message = msgpack.decode(client1.messages[0]);
                assert.equal(message[0], Protocol.JOIN_ROOM);
            });

            it('should close client connection only after onLeave has fulfiled', function(done) {
                const room = connectorAsyncRoom;

                (<any>room)._onJoin(client1);
                (<any>room)._onMessage(client1, msgpack.encode([Protocol.LEAVE_ROOM]));

                assert.equal(client1.getMessageAt(0)[0], Protocol.JOIN_ROOM);
                assert.equal(client1.readyState, WebSocket.OPEN);

                room.on('disconnect', () => {
                    assert.equal(client1.readyState, WebSocket.CLOSED);
                    done();
                });
            });

            it('should cleanup/dispose when all clients disconnect', function(done) {
                const room = connectorRooms[0];
                (<any>room)._onJoin(client1);

                room.on('dispose', function() {
                    done();
                });

                (<any>room)._onLeave(client1);
            });
        });
        describe('#requestAreaListen/#_requestAreaListen', () => {
            it('should reject a request to link to an area', function(done) {

                const room = connectorRooms[0];
                const requestSpy = sinon.spy(room, 'requestAreaListen');
                const _requestSpy = sinon.spy(room, '_requestAreaListen');
                (<any>room)._onMessage(client1, msgpack.encode([Protocols.ADD_AREA_LISTEN, 0]));

                sinon.assert.calledOnce(requestSpy);
                sinon.assert.calledOnce(_requestSpy);

                assert.ok(requestSpy.returned(false));
                requestSpy.resetHistory();
                _requestSpy.resetHistory();
                done();
            });

            it('should accept the listen', function(done) {
                const room = connectorAcceptRoom1;
                const requestSpy = sinon.spy(room, 'requestAreaListen');
                const _requestSpy = sinon.spy(room, '_requestAreaListen');
                const addAreaListenSpy = sinon.spy(room, 'addAreaListen');
                const onAddedAreaListenSpy = sinon.spy(room, 'onAddedAreaListen');

                setTimeout(() => {
                    room.init().then(() => {
                        (<any>room)._onJoin(client1);
                        (<any>room)._onMessage(client1, msgpack.encode([Protocols.ADD_AREA_LISTEN, 0]));

                        sinon.assert.calledOnce(requestSpy);
                        sinon.assert.calledOnce(_requestSpy);
                        sinon.assert.calledOnce(addAreaListenSpy);

                        assert.ok(requestSpy.returned(true));

                        setTimeout(() => {
                            sinon.assert.calledOnce(onAddedAreaListenSpy);
                            assert.ok(client1.centrumClient.isLinkedToChannel(0));
                            requestSpy.resetHistory();
                            _requestSpy.resetHistory();
                            addAreaListenSpy.resetHistory();
                            done();
                        }, 20);
                    });
                }, 200);
            });
        });

        describe('#requestRemoveAreaListen/#_requestRemoveAreaListen', () => {
            beforeEach('listens client to the area', (done) => {
                setTimeout(() => { // wait a bit after listening for sockets before sending messages back and forth
                    let inited = 0;
                    let checkDone = (() => {
                        inited++;
                        inited === 2 && done();
                    });
                    connectorRooms[1].init().then(() => {
                        (<any>connectorRooms[1])._onJoin(client1);
                        setTimeout(() => {
                            checkDone();
                        }, 20);
                    });
                    connectorAcceptRoom1.init().then(() => {
                        (<any>connectorAcceptRoom1)._onJoin(client2);
                        setTimeout(() => {
                            checkDone();
                        }, 20);
                    });
                }, 200);
            });

            it('should reject a request to remove the area listener', function(done) {
                const room = connectorRooms[0];
                const removeRequestSpy = sinon.spy(room, 'requestRemoveAreaListen');
                const _removeRequestSpy = sinon.spy(room, '_requestRemoveAreaListen');

                (<any>room)._onMessage(client1, msgpack.encode([Protocols.REMOVE_AREA_LISTEN, 0]));

                sinon.assert.calledOnce(removeRequestSpy);
                sinon.assert.calledOnce(_removeRequestSpy);

                assert.ok(removeRequestSpy.returned(false));
                removeRequestSpy.resetHistory();
                _removeRequestSpy.resetHistory();
                done();
            });


            it('should accept the request to remove the area listener', function(done) {
                const room = connectorAcceptRoom1;
                const removeRequestSpy = sinon.spy(room, 'requestRemoveAreaListen');
                const _removeRequestSpy = sinon.spy(room, '_requestRemoveAreaListen');

                const onRemovedAreaListenSpy = sinon.spy(room, 'onRemovedAreaListen');
                const removeAreaListenSpy = sinon.spy(room, 'removeAreaListen');

                (<any>room)._onMessage(client2, msgpack.encode([Protocols.REMOVE_AREA_LISTEN, 0]));

                sinon.assert.calledOnce(removeRequestSpy);
                sinon.assert.calledOnce(_removeRequestSpy);
                sinon.assert.calledOnce(removeAreaListenSpy);
                sinon.assert.calledOnce(onRemovedAreaListenSpy);

                assert.ok(removeRequestSpy.returned(true));
                assert.ok(!(client1.centrumClient.isLinkedToChannel(0)));

                removeRequestSpy.resetHistory();
                _removeRequestSpy.resetHistory();
                onRemovedAreaListenSpy.resetHistory();

                done();
            });
        });
    });
});
