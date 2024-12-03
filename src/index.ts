import { ALL_ROOMS, Room } from './room';
import { Client } from './client';
import * as telnetlib from 'telnetlib';
import { handleCommand, parseCommand } from './commands';

const ALL_CLIENTS = new Map<string, Client>();

const DEFAULT_ROOM = new Room(
  ALL_CLIENTS,
  'GeneralChat',
  null,
  'General Chat!',
);

ALL_ROOMS.set(DEFAULT_ROOM.name, DEFAULT_ROOM);

const server = telnetlib.createServer({}, c => {
  c.on('negotiated', () => {
    c.write('Welcome to the Telnet Chat Server!\n');
    promptForUsername(c);
  });

  // Once we set our username inside `promptForUsername`, we can finish
  // setting up our handlers
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
    client.socket.emit('client constructed', client);
  });

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

server.listen(23, () => {
  console.log('Now listening on port 23\n');
});
