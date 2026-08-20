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
  try {
    return await operation();
  } catch (error) {
    if (!isMalformedMysqlPacket(error)) throw error;
    onRetry?.();
    return operation();
  }
}
