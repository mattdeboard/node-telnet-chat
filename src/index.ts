import { createRoom, rooms, type Room } from './room';
import type { Client } from './client';
import * as telnetlib from 'telnetlib';
import { COMMANDS, type Command } from './commands';

const clients = new Map<string, Client>();

const DEFAULT_ROOM: Room = {
  clients,
  name: 'GeneralChat',
  owner: null,
  topic: 'General Chat!',
};

rooms.set(DEFAULT_ROOM.name, DEFAULT_ROOM);

const server = telnetlib.createServer({}, c => {
  c.on('negotiated', () => {
    c.write('Welcome to the Telnet Chat Server!\n');
    promptForUsername(c);
  });
});

function promptForUsername(c: Client['socket']) {
  c.write('Please enter your username: ');
  c.once('data', data => {
    const poss = data.toString().trim();

    if (clients.has(poss)) {
      c.write(`Sorry, but ${poss} is already in use!\n`);
      promptForUsername(c);
    } else {
      const client: Client = {
        currentRoom: DEFAULT_ROOM,
        username: poss,
        socket: c,
      };
      clients.set(client.username, client);
      broadcast(
        client,
        `${client.username} has joined ${client.currentRoom.name}!`,
      );

      c.on('data', data => {
        const msg = data.toString().trim();
        if (msg.startsWith('/')) {
          const parsed = parseCommand(client, msg.slice(1));
          if (parsed) {
            handleCommand(client, parsed[0], parsed[1]);
          }
        } else {
          handleMessage(client, msg);
        }
      });

      c.on('end', () => {
        clients.delete(client.username);
        broadcast(client, `${client.username} disconnected from the server.`);
      });
    }
  });
}

function broadcast(sender: Client, msg: string) {
  const room = rooms.get(sender.currentRoom.name);

  if (!room) return;

  for (const [_, client] of room.clients) {
    if (
      sender.socket === client.socket ||
      client.currentRoom.name !== room.name
    )
      continue;
    client.socket.write(`[${new Date().toISOString()}] ${msg}\n`);
  }
}

function handleMessage(client: Client, msg: string) {
  if (msg.length) {
    broadcast(client, `(${client.username}): ${msg}`);
  }
}

function isCommand(s: unknown): s is Command {
  return COMMANDS.includes(s as Command);
}

function parseCommand(
  client: Client,
  cmd: string,
): [Command, string[]] | null {
  const [command, ...args] = cmd.split(' ');
  if (!isCommand(command)) {
    client.socket.write(`Unknown command ${command}\n`);
    return null;
  }
  return [command, args];
}

function handleCommand(invoker: Client, command: Command, args: string[]) {
  switch (command) {
    case 'create':
      createRoom(invoker, args[0]);
      break;
    case 'topic': {
      if (args.length) {
        changeTopic(invoker, invoker.currentRoom, args.join(' '));
      } else {
        readTopic(invoker);
      }
      break;
    }
    case 'join':
      joinRoom(invoker, args[0]);
      break;
    case 'room':
      whichRoom(invoker);
      break;
    default:
      invoker.socket.write(`No handler yet for command '${command}'\n`);
      break;
  }
}

export function joinRoom(client: Client, roomName: string) {
  const room = rooms.get(roomName);
  if (!room) {
    client.socket.write('Sorry, no room by that name was found.\n');
    return;
  }
  client.currentRoom = room;
  room.clients.set(client.username, client);
  client.socket.write(`Joined ${roomName}!\n`);
  readTopic(client);
  broadcast(client, `${client.username} has joined ${roomName}!\n`);
}

export function changeTopic(client: Client, room: Room, topic: string) {
  if (client.currentRoom.name !== room.name) {
    client.socket.write(
      `Tried changing topic in invalid room (target: ${room.name}, current room: ${client.currentRoom.name})\n`,
    );
    return;
  }

  if (room.owner?.username !== client.username) {
    client.socket.write("You don't have permission to do that!\n");
    return;
  }

  room.topic = topic;
  client.socket.write(`Successfully changed the topic to '${topic}'\n`);
  broadcast(client, `${client.username} changed the topic to '${topic}'\n`);
}

export function readTopic(client: Client) {
  client.socket.write(
    `The topic in ${client.currentRoom.name} is: ${client.currentRoom.topic}\n`,
  );
}

export function whichRoom(client: Client) {
  client.socket.write(`Your active room is ${client.currentRoom.name}\n`);
}
server.listen(23);
