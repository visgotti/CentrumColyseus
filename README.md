Gotti-Colyseus is going to be an extension of colyseus. It will use the Centrum library I wrote in order
to allow the integration of 'Connector' servers/rooms that work in conjunction with 'Area' servers/rooms.

The idea is to be able to have multiple connectors that work primarly like the original colyseus rooms,
the key difference is they do not hold nor process state or messages. Instead they work as hubs that relay
messages to the 'Area' servers which will have state and process messages. When a client joins a 'Connector'
room they are then able to 'listen' to multiple 'Area' rooms and can 'write' to one 'Area' at a time.

This gaurentees that a client's messages are only managed by one area at a time and therefore will never have
conflicting state of that client with other 'Areas'. But a client can 'listen' to as many 'Areas' as they want, and
they will receive state updates as patches exactly like how colyseus does it, but the state updates will be seen and
seperated by each 'Area'. This allows the user to only retrieve data if it really needs it, but even though
the data may live in a completely different area and different state, it will still be accessible whenever they need by
simply making a listen request. So if a client is moving through a spatial map, you can listen to new areas as you move
and you can change the client's 'Write' room as well.

It's going to be a work in progress and I want to leverage all of the awesome stuff colyseus already does and keep
the API as simple as possible. You can think about as almost seperating what the existing colyseus room does but
it's in two parts, one that manages the connections and one that manages game state and processing.