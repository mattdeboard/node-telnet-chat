export const COMMANDS = ['create', 'join', 'part', 'room', 'topic'] as const;
export type Command = (typeof COMMANDS)[number];
