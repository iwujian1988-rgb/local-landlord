/** A supplementary section may fail without hiding the core rent ledger. */
export async function rentSection<T>(request: Promise<{ data: T }>): Promise<{ data: T; error: '' } | { data: null; error: string }> {
  try {
    const response = await request;
    return { data: response.data, error: '' };
  } catch (error: any) {
    return { data: null, error: error?.message || '请求未完成' };
  }
}
