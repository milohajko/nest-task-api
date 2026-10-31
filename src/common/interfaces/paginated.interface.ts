/** Standard envelope for every list endpoint. */
export interface Paginated<T> {
  items: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export function paginate<T>(items: T[], total: number, page: number, limit: number): Paginated<T> {
  return {
    items,
    meta: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) },
  };
}
