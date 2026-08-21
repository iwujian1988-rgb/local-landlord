export function buildSingleChargeCreatePath(roomId: number): string {
  return `/rooms/${roomId}/single-charge`;
}

export function getCreatedSingleChargeId(data: { id?: unknown } | null | undefined): number {
  const id = Number(data?.id);
  return Number.isInteger(id) && id > 0 ? id : 0;
}
