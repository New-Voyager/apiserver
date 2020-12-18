export function isPostgres() {
  if (process.env.DB_USED === 'sqllite') {
    return false;
  }
  return true;
}

export function fixQuery(query: string): string {
  if (isPostgres()) {
    for (let i = 1; query.includes('?'); i++) {
      query = query.replace('?', '$' + i);
    }
  }
  return query;
}
