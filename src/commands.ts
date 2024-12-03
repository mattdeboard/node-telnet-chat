import { Client } from './client';

export const COMMANDS = {
  create: 'Create a new room: /create foo',
  help: 'This command',
  join: 'Join a room: /join foo',
  part: 'Leave a room: /part',
  room: 'Display your active room: /room',
  rooms: "Display all rooms you're in: /rooms",
  switch: 'Make another room active: /switch foo',
  topic: 'Change the topic in your active room: /topic This is a new topic',
} as const;

export type Command = keyof typeof COMMANDS;

function isCommand(s: unknown): s is Command {
  return (s as Command) in COMMANDS;
}

export function parseCommand(cmd: string): [Command, string[]] | null {
  const [command, ...args] = cmd.split(' ');
  if (!isCommand(command)) {
    return null;
  }
  return [command, args];
}

export function handleCommand(
  invoker: Client,
  command: Command,
  args: string[],
) {
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
