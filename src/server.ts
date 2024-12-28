import * as telnetlib from 'telnetlib';
import { Client } from './client';
import { ALL_ROOMS, Room } from './room';
import { handleCommand, parseCommand } from 'commands';

export const ALL_CLIENTS = new Map<string, Client>();
export const DEFAULT_ROOM = new Room(
  ALL_CLIENTS,
  'GeneralChat',
  null,
  'General Chat!',
);
ALL_ROOMS.set(DEFAULT_ROOM.name, DEFAULT_ROOM);

const server = telnetlib.createServer({}, c => {
  // This event is emitted by `telnetlib.TelnetSocket#negotiate` and
  // signals that the Telnet server is ready to start handling data.
  c.on('negotiated', () => {
    c.write('Welcome to the Telnet Chat Server!\n');
    promptForUsername(c);
  });

  // The `username set` event is emitted inside `promptForUsername`
  // once, as you may assume, a username has successfully been set.
  c.on('username set', (username: string) => {
    const client = new Client(
      DEFAULT_ROOM,
      new Set([DEFAULT_ROOM]),
      c,
      username,
    );
    ALL_CLIENTS.set(client.username, client);
    DEFAULT_ROOM.broadcast(
      client,
      `${client.username} has joined ${DEFAULT_ROOM.name}!`,
      true,
    );
    client.notifyActiveRoomChange();
    client.socket.write('Type /help to see available commands\n');
    // With our user properly welcomed to the server and a `Client`
    // instance stored in memory, we hand off our client to be used by
    // listeners for the socket's standard `data` and `end` event
    // listeners.
    client.socket.emit('client constructed', client);
  });

  // This event, emitted inside the `username set` listener, signals
  // that we have our client and can attach our 'data' and 'end'
  // handlers to the socket. We need the client in scope here since the
  // listeners for each of those need handles for the rooms the client
  // is in.
  c.on('client constructed', (client: Client) => {
    c.on('data', data => {
      const msg = data.toString().trim();
      if (msg.startsWith('/')) {
        const parsed = parseCommand(msg.slice(1));
        if (parsed) {
          handleCommand(client, ...parsed);
        } else {
          client.socket.write('Unknown command.\n');
        }
      } else {
        handleMessage(client, msg);
      }
    });

    c.on('end', () => {
      ALL_CLIENTS.delete(client.username);
      for (const room of client.rooms) {
        room.broadcast(
          client,
          `${client.username} disconnected from the server.`,
          true,
        );
      }
    });
  });
});

process.on('SIGINT', () => {
  for (const [_, room] of ALL_ROOMS) {
    if (room.flushLogsSync()) console.log('Flushed', room.name);
  }
  process.exit(0);
});

function promptForUsername(c: Client['socket']) {
  c.write('Please enter your username: ');

  c.once('data', data => {
    const poss = data.toString().trim();

    if (ALL_CLIENTS.has(poss)) {
      c.write(`Sorry, but ${poss} is already in use!\n`);
      promptForUsername(c);
    } else {
      c.emit('username set', poss);
    }
  });
}

function handleMessage(client: Client, msg: string) {
  if (msg.length) {
    client.currentRoom.broadcast(client, `(${client.username}): ${msg}`);
  }
}

export default server;
