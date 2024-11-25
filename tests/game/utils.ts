import {gql} from 'apollo-server-express';
import axios from 'axios';
import { errToStr } from '../../src/utils/log';
import {getClient} from '../utils/utils';
const INTERNAL_PORT = 9502;

const sitBackMutation = gql`
  mutation($gameCode: String!, $location: LocationInput!) {
    sitBack(gameCode: $gameCode, location: $location) {
      missedBlind
      status
    }
  }
`

const updateLocationMutation = gql`
  mutation($location: LocationInput!) {
    updateLocation(location: $location)
  }
`

const seatChangeSwapSeatsMutation = gql`
mutation seatChangeSwapSeats($gameCode: String!, $seatNo1: Int!, $seatNo2: Int!) {
  seatChangeSwapSeats(gameCode: $gameCode, seatNo1: $seatNo1, seatNo2: $seatNo2)
}
`

const playerById = gql`
  query {
    playerById {
      id
    }
  }
`

const seatPositions = gql`
  query($gameCode: String!, $seatChange: Boolean) {
    seatPositions(gameCode: $gameCode, seatChange: $seatChange) {
      seatNo
  playerUuid
  playerId
  name
  buyIn
  stack
  missedBlind
  status
  seatStatus
  buyInExpTime
  breakStartedTime
  breakExpTime
  gameToken
  agoraToken
  isBot

    }
  }
`

const completedGame = gql`
query completedGame($gameCode: String!) {
  completedGame(gameCode: $gameCode) {
    title
  gameType
  gameCode
  gameNum
  smallBlind
  bigBlind
  startedBy
  startedAt
  endedBy
  endedAt
  runTime
  runTimeStr
  sessionTime
  sessionTimeStr
  handsDealt
  handsPlayed
  dataAggregated
  buyIn
  profit
  stack
  highHandTracked
  stackStat {
    handNum
    before
    after
  }
  isHost
  isOwner
  isManager
  preflopHands
  flopHands
  turnHands
  riverHands
  showdownHands
  }
}
`

const buyinQuery = gql`
  mutation($gameCode: String!, $amount: Float!) {
    status: buyIn(gameCode: $gameCode, amount: $amount) {
      expireSeconds
      approved
      missedBlind
      status
      availableCredits
      insufficientCredits
    }
  }
`;

export const configureGameQuery = gql`
  mutation($clubCode: String!, $gameInput: GameCreateInput!) {
    configuredGame: configureGame(clubCode: $clubCode, game: $gameInput) {
      gameID
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

const reloadQuery = gql`
  mutation($gameCode: String!, $amount: Float!) {
    status: reload(gameCode: $gameCode, amount: $amount) {
      expireSeconds
      approved
      status
      availableCredits
      insufficientCredits
      appliedNextHand
    }
  }
`;


const autoReloadQuery = gql`
  mutation($gameCode: String!, $lowThreshold: Float!, $reloadTo: Float!) {
    status: autoReload(gameCode: $gameCode, reloadThreshold: $lowThreshold, reloadTo: $reloadTo)
  }
`;

const approveQuery = gql`
  mutation(
    $gameCode: String!
    $playerUuid: String!
    $type: ApprovalType!
    $status: ApprovalStatus!
  ) {
    status: approveRequest(
      gameCode: $gameCode
      playerUuid: $playerUuid
      type: $type
      status: $status
    )
  }
`;

const startGameQuery = gql`
  mutation($gameCode: String!) {
    status: startGame(gameCode: $gameCode)
  }
`;

const kickOutMutation = gql`
  mutation($gameCode: String!, $playerUuid: String!) {
    kickOut(gameCode: $gameCode, playerUuid: $playerUuid)
  }
`;

const setBuyInLimitMutation = gql`
  mutation($gameCode: String!, $playerUuid: String!, $limit: Float!) {
    setBuyInLimit(gameCode: $gameCode, playerUuid: $playerUuid, limit: $limit)
  }
`;

const applyWaitlistOrderMutation = gql`
  mutation($gameCode: String!, $playerUuid: [String!]) {
    applyWaitlistOrder(gameCode: $gameCode, playerUuid: $playerUuid)
  }
`;

const declineWaitlistSeatMutation = gql`
  mutation($gameCode: String!) {
    declineWaitlistSeat(gameCode: $gameCode)
  }
`;

export const sitBack = async ({ ownerId, gameCode, location}) => {
  const resp = await getClient(ownerId).mutate({
    variables: {
      location,
      gameCode,
    },
    mutation: sitBackMutation,
  });

  return resp.data;
}

export const updateLocation = async ({ ownerId, location}) => {
  const resp = await getClient(ownerId).mutate({
    variables: {
      location,
    },
    mutation: updateLocationMutation,
  });

  return resp.data
};

export const seatChangeSwapSeats = async ({ ownerId, gameCode, seatNo1, seatNo2}) => {
  const resp = await getClient(ownerId).mutate({
    variables: {
      gameCode: gameCode,
      seatNo1,
      seatNo2,
    },
    mutation: seatChangeSwapSeatsMutation,
  });

  return resp.data;
}

export const getSeatPositions = async ({ ownerId, gameCode }) => {
  const resp = await getClient(ownerId).query({
    variables: {
      gameCode: gameCode,
      seatChange: true,
    },
    query: seatPositions,
  });

  return resp.data;
}
export const getCompletedGame = async ({ ownerId, gameCode } ) => {
  const resp = await getClient(ownerId).mutate({
    variables: {
      gameCode: gameCode,
    },
    mutation: completedGame,
  });

  return resp.data;
}

export const declineWaitlistSeat = async ({ownerId, gameCode}: any) => {
  const resp = await getClient(ownerId).mutate({
    variables: {
      gameCode: gameCode,
    },
    mutation: declineWaitlistSeatMutation,
  });

  return resp.data;
};

export const applyWaitlistOrder = async ({
  ownerId,
  gameCode,
  playerIds,
}: any) => {
  const resp = await getClient(ownerId).mutate({
    variables: {
      gameCode: gameCode,
      playerUuid: playerIds,
    },
    mutation: applyWaitlistOrderMutation,
  });

  return resp.data;
};

export const getPlayerById = async (playerId: string) => {
  const resp = await getClient(playerId).query({
    query: playerById,
  });

  return resp.data.playerById.id;
}

export const setBuyInLimit = async ({ownerId, gameCode, playerId, limit}) => {
  const resp = await getClient(ownerId).mutate({
    variables: {
      limit,
      gameCode: gameCode,
      playerUuid: playerId,
    },
    mutation: setBuyInLimitMutation,
  });

  return resp.data;
};

export const kickOut = async ({ownerId, gameCode, playerId}) => {
  const resp = await getClient(ownerId).mutate({
    variables: {
      gameCode: gameCode,
      playerUuid: playerId,
    },
    mutation: kickOutMutation,
  });

  return resp.data;
};

export const startGame = async ({ownerId, gameCode}): Promise<any> => {
  const resp = await getClient(ownerId).mutate({
    variables: {
      gameCode: gameCode,
    },
    mutation: startGameQuery,
  });

  return resp.data;
};

export const approveRequest = async ({
  ownerId,
  playerId,
  gameCode,
  type,
  status,
}): Promise<any> => {
  const resp = await getClient(ownerId).mutate({
    variables: {
      gameCode: gameCode,
      playerUuid: playerId,
      type: type,
      status: status,
    },
    mutation: approveQuery,
  });
  return resp.data;
};

export async function reload({playerId, gameCode, amount}): Promise<any> {
  const resp = await getClient(playerId).mutate({
    variables: {
      gameCode: gameCode,
      amount: amount,
    },
    mutation: reloadQuery,
  });
  return resp.data;
}

export async function autoReload({playerId, gameCode, lowThreshold, reloadTo}): Promise<any> {
  try {
    const resp = await getClient(playerId).mutate({
      variables: {
        gameCode: gameCode,
        lowThreshold: lowThreshold,
        reloadTo: reloadTo,
      },
      mutation: autoReloadQuery,
    });
    return resp.data;
  } catch(err) {
    console.error(errToStr(err));
    throw err;
  }
}

export const buyIn = async ({ownerId, gameCode, amount}): Promise<any> => {
  const resp = await getClient(ownerId).mutate({
    variables: {
      gameCode: gameCode,
      amount: amount,
    },
    mutation: buyinQuery,
  });
  return resp.data;
};

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

export const joinGame = async ({ownerId, gameCode, seatNo, location, ip}:any) => {
  const variables = {
    gameCode,
    seatNo,
    location,
  };
  const client = getClient(ownerId);
  const resp = await client.mutate({
    context: {
      ip,
    },
    variables: variables,
    mutation: joinGameMutation,
  });
  return resp.data;
};

export const configureGame = async ({gameInput, playerId, clubCode, highHandTracked, gpsCheck, ipCheck}: any) => {

  if (gameInput == null) {
    gameInput = {...holdemGameInput};
  }
  const resp = await getClient(playerId).mutate({
    variables: {
      clubCode: clubCode,
      gameInput: { ...gameInput, highHandTracked, gpsCheck, ipCheck },
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
  buyInLimit: 'BUYIN_NO_LIMIT',
  breakLength: 20,
  autoKickAfterBreak: true,
  waitForBigBlind: true,
  waitlistAllowed: true,
  maxWaitList: 10,
  sitInApproval: true,
  rakePercentage: 5.0,
  rakeCap: 5.0,
  buyInMin: 100,
  buyInMax: 1000,
  actionTime: 30,
  muckLosingHand: true,
  waitlistSittingTimeout: 5,
  rewardIds: [] as any,
};

