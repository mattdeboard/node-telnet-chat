import { Client } from './client';

export type Room = {
  clients: Map<string, Client>;
  name: string;
  owner: null | Client;
  topic?: string;
};

class ChatRoom implements Room {
  constructor(
    public clients: Map<string, Client>,
    public name: string,
    public owner: null | Client,
    public topic?: string,
  ) {}

  broadcast(sender: Client, msg: string) {
    for (const [_, client] of this.clients) {
      if (
        sender.socket === client.socket ||
        client.currentRoom.name !== this.name
      ) {
        continue;
      }
      client.socket.write(`[${new Date().toISOString()}] ${msg}\n`);
    }
  }
}

export const rooms = new Map<string, Room>();

export function createRoom(creator: Client, name: string) {
  if (rooms.has(name)) {
    creator.socket.write(`A room named ${name} already exists!\n`);
    return;
  }

  const roomClients = new Map<string, Client>();
  roomClients.set(creator.username, creator);
  const room: Room = {
    clients: roomClients,
    owner: creator,
    name,
  };
  rooms.set(name, room);
  creator.currentRoom = room;
  creator.socket.write(`Created ${name}!\n`);
}
