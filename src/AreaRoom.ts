import {AreaClient as Client, AreaClient} from './AreaClient';
import { BackMaster, BackChannel } from 'gotti-channels';
import {Protocols} from "./Protocols";
import { EventEmitter } from 'events';

const DEFAULT_PATCH_RATE = 1000 / 20; // 20fps (50ms)
const DEFAULT_SIMULATION_INTERVAL = 1000 / 60; // 60fps (16.66ms)


export abstract class AreaRoom extends EventEmitter {
    public areaId: string;
    public areaType: string;

    public patchRate: number = DEFAULT_PATCH_RATE;

    public state: any;
    public metadata: any = null;

    public clients: Array<AreaClient> = [];
    protected clientsLookup : { [sessionId: string]: AreaClient } = {};

    private areaChannel: BackChannel;
    private areaMaster: BackMaster;

    private _simulationInterval: NodeJS.Timer;
    private _patchInterval: NodeJS.Timer;

    constructor(areaChannel: BackChannel) {
        super();
        this.areaId = areaChannel.channelId;
        this.areaChannel = areaChannel;
        this.areaMaster = areaChannel.masterChannel;
        this.state = areaChannel.state;
        this.registerBackChannelMessages();

       // this.setPatchRate(this.patchRate);
    }

    public abstract onMessage(sessionId: string, message) : void;
    public abstract onGlobalMessage(message) : void;

    public onInit?(options: any): void;
    public onJoin?(sessionId: string, options?: any): void;
    public onLeave?(sessionId: string, options?: any): void;

    public onListen?(sessionId: string, options: any): void;
    public onRemoveListen?(sessionId: string, options: any): void;

    public setState(newState) {
        /*
        if ( this.timeline ) {
            this.timeline.takeSnapshot( this.state );
        }
        */
        this.areaChannel.setState(newState);
    }

    public send(sessionId, message) {
        this.areaMaster.messageClient(sessionId, [Protocols.AREA_DATA, this.areaId, message])
    };

    public broadcastListeners(message) {
        this.areaChannel.broadcastLinked([Protocols.AREA_DATA, this.areaId, message]);
    }

    public broadcastAll(message) {
        this.areaChannel.broadcast([Protocols.AREA_DATA, this.areaId, message]);
    };

    /**
     * Tells the client that it should no longer be a listener to this room.
     * @param sessionId
     * @param options
     */
    public removeClientListener(sessionId, options?) {
        this.areaMaster.messageClient(sessionId, [Protocols.REMOVE_AREA_LISTEN, this.areaId, options]);
    };

    /**
     * used if you want the area to notify a client that they
     * must listen to a new remote area.
     * @param sessionId - session Id of client in connector room.
     * @param areaId - new area id the client is going to link to.
     * @param options - optional argument if you want to pass data between areas
     */
    public addClientToArea(sessionId, areaId, options?) {
        this.areaMaster.messageClient(sessionId, [Protocols.ADD_AREA_LISTEN, areaId, options]);
    }

    /**
     * sends a message to the client telling it that it should be using
     * this area room as its writer.
     * @param sessionId
     * @param options
     */
    public setClientWrite(sessionId, options?) {
        this.areaMaster.messageClient(sessionId, [Protocols.CHANGE_AREA_WRITE, this.areaId, options]);
    };

    private _onConnectorMessage() {};
    private _onMessage(sessionId, message) {};
    private _onGlobalMessage(sessionId, message) {};

    private _onAddedAreaClientListen(sessionId, options?) {};
    private _onRemovedAreaClientListen(sessionId, options?) {};
    private _onAddedAreaClientWrite(sessionId, options?) {};
    private _onRemovedAreaClientWrite(sessionId, options?) {};

    private registerBackChannelMessages() {
        this.areaChannel.onMessage((message) => {
            if (message[0] === Protocols.AREA_DATA) {
            //    this.onMessage();
            } else if (message[0] === Protocols.GLOBAL_GAME_DATA) {
                this.onGlobalMessage(message[1])
            } else if (message[0] === Protocols.REMOTE_SYSTEM_MESSAGE) {
               // this.onSystemMessage(message[1]);
            }
        });
    }
}
