import Taro from '@tarojs/taro';
import AddRoomInfo from '../src/pages/add-room-info';
import { post } from '../src/services/request';

let stateIndex = 0;
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useState: (initial: any) => {
    const index = stateIndex++;
    const value = index === 0 ? '101' : index === 1 ? '2500'
      : typeof initial === 'function' ? initial() : initial;
    return [value, jest.fn()];
  },
  useEffect: jest.fn(),
  useRef: (value: any) => ({ current: value }),
  useCallback: (fn: any) => fn,
}));
jest.mock('@tarojs/taro', () => ({
  __esModule: true,
  default: { ...jest.requireActual('@tarojs/taro').default, getCurrentInstance: jest.fn() },
  useDidHide: jest.fn(),
}));
jest.mock('../src/services/request', () => ({ post: jest.fn(), put: jest.fn(), get: jest.fn() }));

function findSave(node: any): any {
  if (!node || typeof node !== 'object') return undefined;
  if (String(node.props?.className || '').startsWith('save-btn ')) return node;
  const children = node.props?.children;
  for (const child of Array.isArray(children) ? children.flat(Infinity) : [children]) {
    const result = findSave(child);
    if (result) return result;
  }
}

beforeEach(() => {
  stateIndex = 0;
  jest.clearAllMocks();
  jest.useFakeTimers();
  Taro.clearStorageSync();
  (post as jest.Mock).mockResolvedValue({ code: 0, data: { id: 9 } });
});
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

it('saves the preceding photo step URLs in the newly created room', async () => {
  (Taro.getCurrentInstance as jest.Mock).mockReturnValue({ router: { params: { propertyId: '3', fromPhotos: '1' } } });
  Taro.setStorageSync('tempRoomPhotos', ['https://cdn.test/room.jpg']);
  await findSave(AddRoomInfo()).props.onClick();
  expect(post).toHaveBeenCalledWith('/properties/3/rooms', expect.objectContaining({ images: ['https://cdn.test/room.jpg'] }));
  expect(Taro.getStorageSync('tempRoomPhotos')).toBe('');
});

it('a direct new-room form does not accidentally attach stale photos', async () => {
  (Taro.getCurrentInstance as jest.Mock).mockReturnValue({ router: { params: { propertyId: '4' } } });
  Taro.setStorageSync('tempRoomPhotos', ['https://cdn.test/old-room.jpg']);
  await findSave(AddRoomInfo()).props.onClick();
  expect(post).toHaveBeenCalledWith('/properties/4/rooms', expect.objectContaining({ images: [] }));
});
