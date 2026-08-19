export type RoomFilter = 'all' | 'vacant' | 'rented';

export interface FilterableRoom {
  status: number;
  displayStatus?: string;
}

export function getRoomDisplayStatus(room: FilterableRoom): string {
  return room.displayStatus || (room.status === 1 ? 'rented' : 'vacant');
}

export function filterRooms<T extends FilterableRoom>(rooms: T[], filter: RoomFilter): T[] {
  if (filter === 'all') return rooms;
  if (filter === 'vacant') return rooms.filter(room => getRoomDisplayStatus(room) === 'vacant');
  return rooms.filter(room => getRoomDisplayStatus(room) !== 'vacant');
}

export function countRooms(rooms: FilterableRoom[]): Record<RoomFilter, number> {
  const vacant = rooms.filter(room => getRoomDisplayStatus(room) === 'vacant').length;
  return {
    all: rooms.length,
    vacant,
    rented: rooms.length - vacant,
  };
}
