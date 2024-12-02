import { Client } from './client';
import * as fsProm from 'fs/promises';
import * as fs from 'fs';

export class Room {
  private chatLog: string;
  private logBuffer: string[] = [];
  private maxBufferedLines = 2;

  constructor(
    public clients: Map<string, Client>,
    public name: string,
    public owner: null | Client,
    public topic?: string,
  ) {
    this.chatLog = `./${name}.log`;
  }

  broadcast(sender: Client, msg: string) {
    const chatMsg = `[${new Date().toISOString()}] ${msg}\n`;

    for (const [_, client] of this.clients) {
      if (
        sender.socket === client.socket ||
        client.currentRoom.name !== this.name
      ) {
        continue;
      }
      client.socket.write(chatMsg);
    }
    this.addToLogBuffer(chatMsg.trim());
  }

  private addToLogBuffer(msg: string) {
    this.logBuffer.push(msg);
    if (this.logBuffer.length > this.maxBufferedLines) {
      this.writeLog(this.logBuffer.join('\n')).then(() => {
        this.logBuffer = [];
      });
    }
  }

  flushLogs() {
    if (this.logBuffer.length) {
      fs.writeFileSync(this.chatLog, `\n${this.logBuffer.join('\n')}`, {
        flag: 'a+',
      });
      return true;
    }
    return false;
  }

  async writeLog(content: string) {
    try {
      await fsProm.writeFile(this.chatLog, `\n${content}`, { flag: 'a+' });
    } catch (e: any) {
      console.error("Couldn't write to", this.chatLog);
      console.error(e);
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
  const room = new Room(roomClients, name, creator);
  rooms.set(name, room);
  creator.currentRoom = room;
  creator.socket.write(`Created ${name}!\n`);
}
