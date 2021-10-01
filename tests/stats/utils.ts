import {gql} from 'apollo-server-express';
import {getClient} from '../utils/utils';

const clubStatsQuery = gql`
  query($gameType: GameType!, $clubCode: String!) {
    clubStats(gameType: $gameType, clubCode: $clubCode) {
      straight5Flush
    }
  }
`;

const systemStatsQuery = gql`
  query($gameType: GameType!) {
    systemStats(gameType: $gameType) {
      straight5Flush
    }
  }
`;

const playerHandStatsQuery = gql`
  query {
    playerHandStats {
      inPreflop
    }
  }
`;

const playerGameStatsQuery = gql`
  query($gameCode: String!) {
    playerGameStats(gameCode: $gameCode) {
      inPreflop
    }
  }
`;

const playerRecentPerformanceQuery = gql`
  query {
    playerRecentPerformance
  }
`;

export const playerRecentPerformance = async ({ownerId}) => {
  const variables = {};
  const client = getClient(ownerId);
  const resp = await client.query({
    variables: variables,
    query: playerRecentPerformanceQuery,
  });
  return resp.data;
};

export const playerGameStats = async ({ownerId, gameCode}) => {
  const variables = {
    gameCode,
  };
  const client = getClient(ownerId);
  const resp = await client.query({
    variables: variables,
    query: playerGameStatsQuery,
  });
  return resp.data;
};

export const playerHandStats = async ({ownerId}) => {
  const variables = {};
  const client = getClient(ownerId);
  const resp = await client.query({
    variables: variables,
    query: playerHandStatsQuery,
  });
  return resp.data;
};

export const systemStats = async ({ownerId, gameType}) => {
  const variables = {
    gameType,
  };
  const client = getClient(ownerId);
  const resp = await client.query({
    variables: variables,
    query: systemStatsQuery,
  });
  return resp.data;
};

export const clubStats = async ({ownerId, clubCode, gameType}) => {
  const variables = {
    clubCode,
    gameType,
  };
  const client = getClient(ownerId);
  const resp = await client.query({
    variables: variables,
    query: clubStatsQuery,
  });
  return resp.data;
};
