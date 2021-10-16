import {gql} from 'apollo-boost';
import {PlayerRepository} from '../../src/repositories/player';
import {getLogger} from '../../src/utils/log';
import { getClient } from './utils';

const logger = getLogger('Player unit-test');

export async function createPlayer(args: any) {
  const errors = validate();
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
  try {
    // I should see this in the console.log
    console.log('**** CODE COV *** In CreatePlayer implementaion');
    logger.info('**** CODE COV *** In CreatePlayer implementaion');

    const playerInput = args.player;
    return PlayerRepository.createPlayer(
      playerInput.name,
      playerInput.email,
      playerInput.password,
      playerInput.deviceId,
      playerInput.isBot
    );
  } catch (err) {
    logger.error(err);
    throw new Error('Failed to register Player');
  }

  function validate() {
    const errors = new Array<string>();
    if (!args.player) {
      errors.push('player object not found');
    }
    if (isEmpty(args.player.name)) {
      errors.push('name is a required field');
    }
    if (isEmpty(args.player.deviceId) && isEmpty(args.player.email)) {
      errors.push('deviceId or email should be specified');
    }
    if (!isEmpty(args.player.email) && isEmpty(args.player.password)) {
      errors.push('password should be specified');
    }

    return errors;

    function isEmpty(value: any) {
      return value === undefined || value === '';
    }
  }
}

export const buyDiamondsQuery = gql`
  mutation($coinsUsed: Int!, $diamonds: Int!) {
    status: buyDiamonds(coinsUsed: $coinsUsed, diamonds: $diamonds)
  }
`;
export async function buyDiamonds(
  playerId: string,
  diamonds: number,
  coinsUsed: number
): Promise<any> {
  const resp = await getClient(playerId).mutate({
    variables: {
      diamonds: diamonds,
      coinsUsed: coinsUsed,
    },
    mutation: buyDiamondsQuery,
  });
  expect(resp.errors).toBeUndefined();
  expect(resp.data).not.toBeNull();
  return resp.data.status;
}


export const availableCoinsQuery = gql`
  query {
    coins: availableCoins
  }
`;
export async function availableCoins(
  playerId: string,
): Promise<any> {
  const resp = await getClient(playerId).query({
    variables: {
    },
    query: availableCoinsQuery,
  });
  expect(resp.errors).toBeUndefined();
  expect(resp.data).not.toBeNull();
  return resp.data.coins;
}