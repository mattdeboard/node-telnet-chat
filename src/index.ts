import { ALL_ROOMS, Room } from './room';
import { Client } from './client';
import * as telnetlib from 'telnetlib';
import { COMMANDS, type Command } from './commands';

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
      const client = new Client(
        DEFAULT_ROOM,
        new Set([DEFAULT_ROOM]),
        c,
        poss,
      );
      ALL_CLIENTS.set(client.username, client);
      DEFAULT_ROOM.broadcast(
        client,
        `${client.username} has joined ${DEFAULT_ROOM.name}!`,
        true,
      );
      client.notifyActiveRoomChange();
      client.socket.write('Type /help to see available commands\n');
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
        ALL_CLIENTS.delete(client.username);
        for (const room of client.rooms) {
          room.broadcast(
            client,
            `${client.username} disconnected from the server.`,
            true,
          );
        }
      });
    }
  });
}

function handleMessage(client: Client, msg: string) {
  if (msg.length) {
    client.currentRoom.broadcast(client, `(${client.username}): ${msg}`);
  }
}

function isCommand(s: unknown): s is Command {
  return (s as Command) in COMMANDS;
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
      invoker.createRoom(args[0]);
      break;
    case 'help': {
      const maxCmdLength = Math.max(
        ...Object.keys(COMMANDS).map(k => k.length),
      );
      const msg = `The following commands are available:
      ${Object.entries(COMMANDS)
        .map(([c, helpText]) => {
          // Add some padding so the help text aligns nicely
          const paddingNeeded = maxCmdLength - c.length;
          const padding = new Array(paddingNeeded).fill(' ').join('');
          return `\t- /${c}${padding}\t${helpText}`;
        })
        .join('\r\n')}\n`;
      invoker.socket.write(msg);
      break;
    }
    case 'join':
      invoker.joinRoom(args[0]);
      break;
    case 'part':
      invoker.partRoom(args[0]);
      break;
    case 'room':
      invoker.whichRoom();
      break;
    case 'rooms':
      invoker.listRooms();
      break;
    case 'switch':
      invoker.switchRooms(args[0]);
      break;
    case 'topic': {
      if (args.length) {
        invoker.changeTopic(invoker.currentRoom, args.join(' '));
      } else {
        invoker.readTopic();
      }
      break;
    }
    default:
      invoker.socket.write(`No handler yet for command '${command}'\n`);
      break;
  }
}

server.listen(23, () => {
  console.log('Now listening on port 23\n');
});
