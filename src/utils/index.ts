import {Cards} from './cards';

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

export function stringCards(cards: Array<number>): Array<string | undefined> {
  const stringCards = cards.map(x => Cards.get(x));
  return stringCards;
}

export function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
