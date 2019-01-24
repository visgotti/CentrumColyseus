"use strict";
// Export 'WebSocket' as 'Client' with 'id' property.
Object.defineProperty(exports, "__esModule", { value: true });
var ClientConnectionState;
(function (ClientConnectionState) {
    ClientConnectionState[ClientConnectionState["WRITE"] = 0] = "WRITE";
    ClientConnectionState[ClientConnectionState["LISTEN"] = 1] = "LISTEN";
})(ClientConnectionState = exports.ClientConnectionState || (exports.ClientConnectionState = {}));
