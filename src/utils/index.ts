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

export function redisHost(): string {
  if (process.env.REDIS_HOST) {
    return process.env.REDIS_HOST;
  } else {
    return 'localhost';
  }
}

export function redisPort(): number {
  if (process.env.REDIS_PORT) {
    return parseInt(process.env.REDIS_PORT);
  } else {
    return 6379;
  }
}

export function utcTime(date: Date): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds()
    )
  );
}

export function getDistanceInMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(lat2 - lat1); // deg2rad below
  var dLon = deg2rad(lon2 - lon1);
  var a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  var d = R * c; // Distance in km
  return Math.ceil(d / 1000);
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}
