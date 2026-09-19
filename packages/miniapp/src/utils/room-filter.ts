export type RoomFilter = 'all' | 'vacant' | 'rented' | 'archived';

export interface FilterableRoom {
  status: number;
  displayStatus?: string;
}

export function getRoomDisplayStatus(room: FilterableRoom): string {
  return room.displayStatus || (room.status === 2 ? 'archived' : room.status === 1 ? 'rented' : 'vacant');
}

export function filterRooms<T extends FilterableRoom>(rooms: T[], filter: RoomFilter): T[] {
  if (filter === 'all') return rooms.filter(room => getRoomDisplayStatus(room) !== 'archived');
  if (filter === 'vacant') return rooms.filter(room => getRoomDisplayStatus(room) === 'vacant');
  if (filter === 'archived') return rooms.filter(room => getRoomDisplayStatus(room) === 'archived');
  return rooms.filter(room => !['vacant', 'archived'].includes(getRoomDisplayStatus(room)));
}

export function countRooms(rooms: FilterableRoom[]): Record<RoomFilter, number> {
  const vacant = rooms.filter(room => getRoomDisplayStatus(room) === 'vacant').length;
  const archived = rooms.filter(room => getRoomDisplayStatus(room) === 'archived').length;
  return {
    all: rooms.length - archived,
    vacant,
    rented: rooms.length - vacant - archived,
    archived,
  };
}
