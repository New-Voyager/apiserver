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

export function redisUser(): string | undefined {
  if (process.env.REDIS_USER) {
    return process.env.REDIS_USER;
  } else {
    return undefined;
  }
}

export function redisPassword(): string | undefined {
  if (process.env.REDIS_PASSWORD) {
    return process.env.REDIS_PASSWORD;
  } else {
    return undefined;
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
  const R = 6371000; // Radius of the earth in meters
  const dLat = deg2rad(lat2 - lat1); // deg2rad below
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in meters
  return Math.ceil(d);
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

export function isRunningUnitTest(): boolean {
  if (process.env.UNIT_TEST === '1') {
    return true;
  }
  return false;
}

export function cardNumber(card: number) {
  if (card >= 1 && card <= 8) {
    return 2;
  } else if (card >= 17 && card <= 24) {
    return 3;
  } else if (card >= 33 && card <= 40) {
    return 4;
  } else if (card >= 49 && card <= 56) {
    return 5;
  } else if (card >= 65 && card <= 72) {
    return 6;
  } else if (card >= 81 && card <= 88) {
    return 7;
  } else if (card >= 97 && card <= 104) {
    return 8;
  } else if (card >= 113 && card <= 120) {
    return 9;
  } else if (card >= 129 && card <= 136) {
    return 10;
  } else if (card >= 145 && card <= 152) {
    return 11; // jack
  } else if (card >= 161 && card <= 168) {
    return 12; // queen
  } else if (card >= 177 && card <= 184) {
    return 13; // king
  } else if (card >= 193 && card <= 200) {
    return 14;
  }
  return 0;
}

export function chipsToCents(chips: number): number {
  if (chips) {
    return chips * 100;
  }
  return chips;
}

export function centsToChips(cents: number): number {
  if (cents) {
    return cents / 100;
  }
  return cents;
}
