import {gql} from 'apollo-server-express';
import axios from 'axios';
import {getClient, INTERNAL_PORT} from '../utils/utils';

export const configureGameQuery = gql`
  mutation($clubCode: String!, $gameInput: GameCreateInput!) {
    configuredGame: configureGame(clubCode: $clubCode, game: $gameInput) {
      title
      gameCode
      gameType
      smallBlind
      bigBlind
      straddleBet
      buyInMin
      buyInMax
      utgStraddleAllowed
      buttonStraddleAllowed
      maxWaitList
      maxPlayers
      minPlayers
      rakePercentage
      rakeCap
      gameLength
      buyInApproval
      breakLength
      autoKickAfterBreak
      waitForBigBlind
      waitlistAllowed
      maxWaitList
      sitInApproval
      actionTime
      muckLosingHand
    }
  }
`;

const takeSeatMutation = gql`
  mutation($gameCode: String!, $seatNo: Int!, $location: LocationInput) {
    takeSeat(gameCode: $gameCode, seatNo: $seatNo, location: $location) {
      playerId
      name
    }
  }
`;

const joinGameMutation = gql`
  mutation($gameCode: String!, $seatNo: Int!, $location: LocationInput) {
    joinGame(gameCode: $gameCode, seatNo: $seatNo, location: $location) {
      missedBlind
      status
    }
  }
`;

const pauseGameMutation = gql`
  mutation($gameCode: String!) {
    pauseGame(gameCode: $gameCode)
  }
`;

const resumeGameMutation = gql`
  mutation($gameCode: String!) {
    resumeGame(gameCode: $gameCode)
  }
`;

export const resumeGame = async ({ownerId, gameCode}) => {
  const variables = {
    gameCode,
  };
  const client = getClient(ownerId);
  const resp = await client.mutate({
    variables: variables,
    mutation: resumeGameMutation,
  });
  return resp.data;
};

export const pauseGame = async ({ownerId, gameCode}) => {
  const variables = {
    gameCode,
  };
  const client = getClient(ownerId);
  const resp = await client.mutate({
    variables: variables,
    mutation: pauseGameMutation,
  });
  return resp.data;
};

export const takeSeat = async ({ownerId, gameCode, seatNo, location}) => {
  const variables = {
    gameCode,
    seatNo,
    location,
  };
  const client = getClient(ownerId);
  const resp = await client.mutate({
    variables: variables,
    mutation: takeSeatMutation,
  });
  return resp.data;
};

export const joinGame = async ({ownerId, gameCode, seatNo, location}) => {
  const variables = {
    gameCode,
    seatNo,
    location,
  };
  const client = getClient(ownerId);
  const resp = await client.mutate({
    variables: variables,
    mutation: joinGameMutation,
  });
  return resp.data;
};

export const configureGame = async ({playerId, clubCode}) => {
  const resp = await getClient(playerId).mutate({
    variables: {
      clubCode: clubCode,
      gameInput: holdemGameInput,
    },
    mutation: configureGameQuery,
  });

  return resp;
};

const GAMESERVER_API = `http://localhost:${INTERNAL_PORT}/internal`;

export async function createGameServer(ipAddress: string) {
  const gameServer1 = {
    ipAddress: ipAddress,
    currentMemory: 100,
    status: 'ACTIVE',
    url: `http://${ipAddress}:8080/`,
  };
  try {
    await axios.post(`${GAMESERVER_API}/register-game-server`, gameServer1);
  } catch (err) {
    console.error(JSON.stringify(err));
    expect(true).toBeFalsy();
  }
}

export const holdemGameInput = {
  gameType: 'HOLDEM',
  title: 'Friday game',
  smallBlind: 1.0,
  bigBlind: 2.0,
  straddleBet: 4.0,
  utgStraddleAllowed: true,
  buttonStraddleAllowed: false,
  minPlayers: 3,
  maxPlayers: 9,
  gameLength: 60,
  buyInApproval: false,
  breakLength: 20,
  autoKickAfterBreak: true,
  waitForBigBlind: true,
  waitlistAllowed: true,
  maxWaitList: 10,
  sitInApproval: true,
  rakePercentage: 5.0,
  rakeCap: 5.0,
  buyInMin: 100,
  buyInMax: 600,
  actionTime: 30,
  muckLosingHand: true,
  waitlistSittingTimeout: 5,
  rewardIds: [] as any,
};
