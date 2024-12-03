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
