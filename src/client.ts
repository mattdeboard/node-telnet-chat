import { Socket } from 'net';
import type { Room } from 'room';

export type Client = {
  currentRoom: Room;
  socket: Socket & telnetlib.TelnetSocket;
  username: string;
};
