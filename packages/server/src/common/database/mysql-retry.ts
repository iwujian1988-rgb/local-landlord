type MysqlLikeError = {
  code?: unknown;
  errno?: unknown;
  message?: unknown;
  driverError?: MysqlLikeError;
};

/**
 * MySQL error 1835 can be raised by a stale/proxied CloudRun connection before
 * an otherwise valid statement is processed. Only idempotent callers should
 * use this retry helper.
 */
export function isMalformedMysqlPacket(error: unknown): boolean {
  const current = error as MysqlLikeError | undefined;
  const driver = current?.driverError;
  const code = driver?.code ?? current?.code;
  const errno = Number(driver?.errno ?? current?.errno);
  const message = String(driver?.message ?? current?.message ?? '');

  return code === 'ER_MALFORMED_PACKET'
    || errno === 1835
    || /malformed communication packet/i.test(message);
}

export async function retryMalformedMysqlPacket<T>(
  operation: () => Promise<T>,
  onRetry?: () => void,
): Promise<T> {
  // 1835 is a server-sent error packet, so mysql2 treats the connection as
  // healthy and returns it to the pool — an immediate retry just re-checks
  // out the same poisoned connection and fails again. The delays let the
  // maxIdle:0 reaper (1s sweep) destroy it first so a later attempt gets a
  // fresh connection.
  const RETRY_DELAYS_MS = [300, 1300];
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!isMalformedMysqlPacket(error) || attempt >= RETRY_DELAYS_MS.length) {
        throw error;
      }
      onRetry?.();
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
    }
  }
}
