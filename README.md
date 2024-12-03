# node-telnet-chat

This repository contains a multi-user chat server with support for rooms
built on top of the telnet protocol.

We leverage the [`telnetlib`](https://www.npmjs.com/package/telnetlib)
library to handle the Telnet protocol details. It provides an
implementation of Node's
[`net.Server`](https://nodejs.org/api/net.html#class-netserver) TCP
server that understands Telnet datagrams.

## Getting Started

```bash
npm i
npm run dev
```

## Server Loop

All of this should be fairly obvious while reading the code, but in the
interest of looking out for my future-self, who will absolutely have
forgotten about every detail of writing this, I think it's valuable to
lay this out explicitly in prose.

### Order of Events

At a high level, event handlers are attached to the socket object in the
following order at request-time:

1. `negotiated`
2. `username set`
3. `client constructed`

#### `negotiated`

When a client connects to the server, `telnetlib` handles all the
[connection
negotiation](https://www.omnisecu.com/tcpip/telnet-negotiation.php).
Once it does that, it
[emits](https://github.com/cadpnq/telnetlib/blob/5ee49b73bdde7cd77064c3797778d9087ab9ef5f/src/TelnetSocket/TelnetSocket.js#L298)
the  `negotiated` signal.

In this listener, we handle that signal by displaying a welcome message
and prompt the user to enter a unique username.

Once the user does so, `username set` is emitted with the validated
username as the payload.

#### `username set`

In this listener, we use the username to construct the `Client` object
we'll be storing in memory. We then display some additional
info/instructions to the user.

Once all that has been written, we emit the `client constructed` event
with the `Client` object as the payload.

#### `client constructed`

Once we have the client, we attach our listeners for `data` (i.e.
handling user input) and `end` (handling user disconnection).

## Architecture

The server is built around two main concepts:

- [`Client`](./src/client.ts): The `Client` class closes over the logic
  for handling any action a user can do, such as creating or leaving a
  room. It is also responsible for sending feedback messages over the
  socket to the user when they perform an action.
- [`Room`](./src/room.ts): The `Room` class is responsible for both
  broadcasting chat messages to other users, as well as writing chat
  logs to disk every so often.

### Client

When a new telnet client connects to the server, a `Client` class is
instantiated and stored in memory in the
[`ALL_CLIENTS`](https://github.com/mattdeboard/node-telnet-chat/blob/93778457dfa68cf96f1cc45dba66b5df2906649f/src/index.ts#L32)
map. This map maps usernames to clients.

The client has a handle on the telnet socket. It uses this to send
feedback messages to the end user, such as success messages when the
user creates a room.

The client also has the concept of the ["current
room."](https://github.com/mattdeboard/node-telnet-chat/blob/776cddb64f099cbafb6dd622b42b51ca67992626/src/client.ts#L6)
This is a handle on a `Room` object. The user can only chat in, change
the topic of, etc., the "current room."

Additionally, the client tracks all the rooms in which it is a member.
The client will receive messages from any room it's a member of, even if
it's not the "current room."

### Room

Each room, of course, tracks all the clients "in" the room. Being "in the
room" means that the user will receive messages sent by other users to
that room.

Each room will also log the chat to disk. This is currently just bare
minimum, very primitive implementation of logging. It's not being used
for anything, but was rather an exercise in making it work.

On process termination, any outstanding logs in memory are synchronously
flushed to disk.