import { Socket } from 'net';
import { Room, ALL_ROOMS } from './room';

export class Client {
  constructor(
    /** The `currentRoom` is the only channel the client can target with
actions (e.g. sending chats, changing the topic). */
    public currentRoom: Room,
    /** `rooms` is the set of all rooms the client is in. */
    public rooms: Set<Room>,
    public socket: Socket & telnetlib.TelnetSocket,
    public username: string,
  ) {}

  createRoom(name: string) {
    if (ALL_ROOMS.has(name)) {
      this.socket.write(`A room named ${name} already exists!\n`);
      return;
    }

    const roomClients = new Map<string, Client>();
    roomClients.set(this.username, this);
    const room = new Room(roomClients, name, this);
    ALL_ROOMS.set(name, room);
    this.rooms.add(room);
    this.currentRoom = room;
    this.socket.write(`Created ${name}!\n`);
  }

  joinRoom(roomName: string) {
    const room = ALL_ROOMS.get(roomName);
    if (!room) {
      this.socket.write('Sorry, no room by that name was found.\n');
      return;
    }

    if (this.rooms.has(room)) {
      this.socket.write("You're already in that room!\n");
      return;
    }

    this.currentRoom = room;
    room.clients.set(this.username, this);
    this.rooms.add(room);
    this.notifyActiveRoomChange();
    this.readTopic();
    room.broadcast(this, `${this.username} has joined ${roomName}!\n`, true);
  }

  partRoom(roomName: string) {
    const room = ALL_ROOMS.get(roomName);

    if (!room) {
      this.socket.write('Sorry, no room by that name was found.\n');
      return;
    }

    this.rooms.delete(room);
    this.socket.write(`Left ${room.name}.\n`);

    room.clients.delete(this.username);
    room.broadcast(this, `${this.username} has left ${room.name}!\n`, true);

    if (this.currentRoom.name === roomName) {
      for (const r of this.rooms) {
        this.currentRoom = r;
        break;
      }
      this.notifyActiveRoomChange();
    }
  }

  changeTopic(room: Room, topic: string) {
    if (this.currentRoom.name !== room.name) {
      this.socket.write(
        `Tried changing topic in invalid room (target: ${room.name}, current room: ${this.currentRoom.name})\n`,
      );
      return;
    }

    if (room.owner?.username !== this.username) {
      this.socket.write("You don't have permission to do that!\n");
      return;
    }

    room.topic = topic;
    this.socket.write(`Successfully changed the topic to '${topic}'\n`);
    room.broadcast(this, `${this.username} changed the topic to '${topic}'\n`);
  }

  readTopic() {
    this.socket.write(
      `The topic in ${this.currentRoom.name} is: ${this.currentRoom.topic}\n`,
    );
  }

  whichRoom() {
    this.socket.write(`Your active room is ${this.currentRoom.name}\n`);
  }

  listRooms() {
    const msg = `You are in the following rooms:
    ${[...this.rooms]
      .map(room => {
        const output = `\t- ${room.name}`;
        if (room.name === this.currentRoom.name) {
          return `${output} (Active)`;
        }
        return output;
      })
      .join('\r\n')}\n`;
    this.socket.write(msg);
  }

  notifyActiveRoomChange() {
    this.socket.write(`You are now chatting in ${this.currentRoom.name}!\n`);
  }

  switchRooms(newRoomName: string) {
    const room = ALL_ROOMS.get(newRoomName);

    if (!room) {
      this.socket.write('Sorry, no room by that name was found.\n');
      return;
    }

    if (!this.rooms.has(room)) {
      this.joinRoom(newRoomName);
    } else {
      this.currentRoom = room;
      this.notifyActiveRoomChange();
    }
  }
}
