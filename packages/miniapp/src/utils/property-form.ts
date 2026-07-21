/** Accept the current API field and legacy aliases used by older clients. */
export function getPropertyCoverImage(property: any): string {
  return property?.coverImage || property?.coverImageURL || property?.cover_image || '';
}
