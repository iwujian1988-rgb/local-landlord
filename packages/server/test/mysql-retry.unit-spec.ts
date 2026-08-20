import { isMalformedMysqlPacket, retryMalformedMysqlPacket } from '../src/common/database/mysql-retry';

describe('MySQL malformed packet retry', () => {
  it('recognizes the production QueryFailedError shape', () => {
    expect(isMalformedMysqlPacket({
      name: 'QueryFailedError',
      message: 'Malformed communication packet.',
      driverError: { code: 'ER_MALFORMED_PACKET', errno: 1835 },
    })).toBe(true);
  });

  it('retries an idempotent operation once and returns its result', async () => {
    const operation = jest.fn()
      .mockRejectedValueOnce({ driverError: { code: 'ER_MALFORMED_PACKET', errno: 1835 } })
      .mockResolvedValueOnce({ id: 21 });
    const onRetry = jest.fn();

    await expect(retryMalformedMysqlPacket(operation, onRetry)).resolves.toEqual({ id: 21 });
    expect(operation).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('does not retry validation or ordinary query errors', async () => {
    const error = new Error('Data too long for column');
    const operation = jest.fn().mockRejectedValue(error);

    await expect(retryMalformedMysqlPacket(operation)).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
