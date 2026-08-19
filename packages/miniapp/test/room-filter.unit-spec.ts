import { countRooms, filterRooms } from '../src/utils/room-filter';

describe('room list filters', () => {
  const rooms = [
    { id: 1, status: 0, displayStatus: 'vacant' },
    { id: 2, status: 1, displayStatus: 'rented' },
    { id: 3, status: 1, displayStatus: 'approaching' },
    { id: 4, status: 1, displayStatus: 'overdue' },
  ];

  it('counts vacant and all occupied states consistently', () => {
    expect(countRooms(rooms)).toEqual({ all: 4, vacant: 1, rented: 3 });
  });

  it('treats rented, approaching and overdue rooms as occupied', () => {
    expect(filterRooms(rooms, 'vacant').map(room => room.id)).toEqual([1]);
    expect(filterRooms(rooms, 'rented').map(room => room.id)).toEqual([2, 3, 4]);
  });
});
