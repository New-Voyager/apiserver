import {initializeSqlLite} from './utils';
import {getLogger} from '../src/utils/log';
import {resetDB} from '@src/resolvers/reset';
import {createPlayer, getPlayerById} from '@src/resolvers/player';
import {createClub, getClubById} from '@src/resolvers/club';
import {createGameServer} from '@src/internal/gameserver';
import {startGame, getGameById, startGameByPlayer} from '@src/resolvers/game';
import {saveChipsData} from '@src/internal/chipstrack';
import {saveHandData} from '@src/internal/hand';
import {
  getLastHandHistory,
  getSpecificHandHistory,
  getAllHandHistory,
  getMyWinningHands,
  getAllStarredHands,
  saveStarredHand,
} from '@src/resolvers/hand';

const logger = getLogger('Hand server unit-test');

const holdemGameInput = {
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
  buyInApproval: true,
  breakLength: 20,
  autoKickAfterBreak: true,
  waitForBigBlind: true,
  waitlistSupported: true,
  maxWaitList: 10,
  sitInApproval: true,
  rakePercentage: 5.0,
  rakeCap: 5.0,
  buyInMin: 100,
  buyInMax: 600,
  actionTime: 30,
  muckLosingHand: true,
};

const allInHand = {
  clubId: 1,
  gameNum: 1,
  handNum: 1,
  messageType: 'RESULT',
  handStatus: 'RESULT',
  handResult: {
    preflopActions: {
      pot: 3,
      actions: [
        {
          seatNo: 5,
          amount: 1,
        },
        {
          seatNo: 8,
          action: 'BB',
          amount: 2,
        },
        {
          seatNo: 1,
          action: 'ALLIN',
        },
        {
          seatNo: 5,
          action: 'ALLIN',
        },
        {
          seatNo: 8,
          action: 'ALLIN',
        },
      ],
    },
    flopActions: {},
    turnActions: {},
    riverActions: {},
    potWinners: {
      '0': {
        hiWinners: [
          {
            seatNo: 1,
            amount: 150,
            winningCards: [200, 196, 8, 132, 1],
            winningCardsStr: '[ A♣  A♦  2♣  T♦  2♠ ]',
            rankStr: 'Two Pair',
            rank: 1000,
          },
        ],
        loWinners: [
          {
            seatNo: 1,
            amount: 150,
            winningCards: [200, 196, 8, 132, 1],
            winningCardsStr: '[ A♣  A♦  2♣  T♦  2♠ ]',
            rankStr: 'Two Pair',
            rank: 1000,
          },
        ],
      },
    },
    wonAt: 'SHOW_DOWN',
    rank: 1000,
    tips: 2.0,
    totalPot: 150,
    balanceAfterHand: [
      {
        seatNo: 1,
        playerId: 1,
        balance: 150,
      },
    ],
    handStartedAt: '1595385733',
    balanceBeforeHand: [
      {
        seatNo: 1,
        playerId: 1,
        balance: 50,
      },
    ],
    handEndedAt: '1595385735',
    playersInSeats: [1, 0, 0, 0, 2, 0, 0, 3, 0],
  },
};

const flopHand = {
  clubId: 1,
  gameNum: 2,
  handNum: 1,
  messageType: 'RESULT',
  handStatus: 'RESULT',
  handResult: {
    preflopActions: {
      pot: 7,
      actions: [
        {
          seatNo: 5,
          amount: 1,
        },
        {
          seatNo: 8,
          action: 'BB',
          amount: 2,
        },
        {
          seatNo: 1,
          action: 'CALL',
          amount: 2,
        },
        {
          seatNo: 5,
          action: 'CALL',
          amount: 2,
        },
        {
          seatNo: 8,
          action: 'CHECK',
        },
      ],
    },
    flopActions: {
      pot: 8,
      actions: [
        {
          seatNo: 5,
          action: 'CHECK',
        },
        {
          seatNo: 8,
          action: 'BET',
          amount: 2,
        },
        {
          seatNo: 1,
          action: 'CALL',
          amount: 2,
        },
        {
          seatNo: 5,
          action: 'RAISE',
          amount: 4,
        },
        {
          seatNo: 8,
          action: 'FOLD',
        },
        {
          seatNo: 1,
          action: 'FOLD',
        },
      ],
    },
    turnActions: {},
    riverActions: {},
    potWinners: {
      '0': {
        hiWinners: [
          {
            seatNo: 5,
            amount: 14,
          },
        ],
      },
    },
    wonAt: 'FLOP',
    tips: 2.0,
    balanceAfterHand: [
      {
        seatNo: 1,
        playerId: 1,
        balance: 96,
      },
    ],
    handStartedAt: '1595385736',
    balanceBeforeHand: [
      {
        seatNo: 1,
        playerId: 1,
        balance: 100,
      },
    ],
    handEndedAt: '1595385739',
    playersInSeats: [1, 0, 0, 0, 2, 0, 0, 3, 0],
  },
};

beforeAll(async done => {
  await initializeSqlLite();
  done();
});

afterAll(async done => {
  done();
});

async function createClubAndStartGame(): Promise<
  [number, number, number, string, string, string]
> {
  const owner = await createPlayer({
    player: {
      name: 'player_name',
      deviceId: 'abc',
    },
  });
  expect(owner).not.toBeNull();
  const club = await createClub(owner, {
    name: 'club_name',
    description: 'poker players gather',
    ownerUuid: owner,
  });
  expect(club).not.toBeNull();
  const gameServer = {
    ipAddress: '10.1.1.1',
    currentMemory: 100,
    status: 'ACTIVE',
  };
  await createGameServer(gameServer);
  const game = await startGame(owner, club, holdemGameInput);
  const playerId = (await getPlayerById(owner)).id;
  const gameId = (await getGameById(owner, game.gameCode)).id;
  const clubId = (await getClubById(owner, club)).id;
  const messageInput = {
    clubId: clubId,
    playerId: playerId,
    gameId: gameId,
    buyIn: 100.0,
    status: 'PLAYING',
    seatNo: 1,
  };
  await saveChipsData(messageInput);
  return [clubId, playerId, gameId, owner, club, game.gameCode];
}

describe('Hand server APIs', () => {
  beforeEach(async done => {
    await resetDB();
    done();
  });

  afterEach(async done => {
    done();
  });

  test('Save hand data HiLo', async () => {
    try {
      const [
        clubId,
        playerId,
        gameId,
        playerUuid,
        clubCode,
        gameCode,
      ] = await createClubAndStartGame();
      allInHand.handNum = 1;
      allInHand.gameNum = gameId;
      allInHand.clubId = clubId;
      allInHand.handResult.potWinners[0].hiWinners[0].seatNo = 1;
      allInHand.handResult.potWinners[0].loWinners[0].seatNo = 1;
      allInHand.handResult.balanceAfterHand[0].playerId = playerId;
      allInHand.handResult.playersInSeats = [playerId];
      const resp = await saveHandData(allInHand);
      expect(resp).toBe(true);
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('Save hand data Flop', async () => {
    try {
      const [
        clubId,
        playerId,
        gameId,
        playerUuid,
        clubCode,
        gameCode,
      ] = await createClubAndStartGame();
      flopHand.handNum = 1;
      flopHand.gameNum = gameId;
      flopHand.clubId = clubId;
      flopHand.handResult.potWinners[0].hiWinners[0].seatNo = 1;
      flopHand.handResult.balanceAfterHand[0].playerId = playerId;
      flopHand.handResult.playersInSeats = [playerId];
      const resp = await saveHandData(flopHand);
      expect(resp).toBe(true);
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('Save hand data HiLo without club', async () => {
    try {
      const ownerId = await createPlayer({
        player: {name: 'player1', deviceId: 'test', page: {count: 20}},
      });
      const gameServer = {
        ipAddress: '10.1.1.1',
        currentMemory: 100,
        status: 'ACTIVE',
      };
      await createGameServer(gameServer);
      const game = await startGameByPlayer(ownerId, holdemGameInput);

      const playerID = await getPlayerById(ownerId);
      const gameID = await getGameById(ownerId, game.gameCode);
      const input = {
        clubId: 0,
        playerId: playerID.id,
        gameId: gameID.id,
        buyIn: 100.0,
        status: 'PLAYING',
        seatNo: 5,
      };
      try {
        const resp = await saveChipsData(input);
        expect(resp).not.toBeNull();
      } catch (e) {
        logger.error(JSON.stringify(e));
        expect(true).toBeFalsy();
      }
      allInHand.handNum = 1;
      allInHand.gameNum = gameID.id;
      allInHand.clubId = 0;
      allInHand.handResult.potWinners[0].hiWinners[0].seatNo = 1;
      allInHand.handResult.potWinners[0].loWinners[0].seatNo = 1;
      allInHand.handResult.balanceAfterHand[0].playerId = playerID.id;
      allInHand.handResult.playersInSeats = [playerID.id];
      const resp = await saveHandData(allInHand);
      expect(resp).toBe(true);
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('Get specific hand history', async () => {
    try {
      const [
        clubId,
        playerId,
        gameId,
        playerUuid,
        clubCode,
        gameCode,
      ] = await createClubAndStartGame();
      flopHand.handNum = 1;
      flopHand.gameNum = gameId;
      flopHand.clubId = clubId;
      flopHand.handResult.potWinners[0].hiWinners[0].seatNo = 1;
      flopHand.handResult.balanceAfterHand[0].playerId = playerId;
      flopHand.handResult.playersInSeats = [playerId];
      const resp = await saveHandData(flopHand);
      const handHistory = await getSpecificHandHistory(playerUuid, {
        clubCode: clubCode,
        gameCode: gameCode,
        handNum: 1,
      });
      expect(handHistory.gameType).toBe('HOLDEM');
      expect(handHistory.wonAt).toBe('FLOP');
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('Get latest hand history', async () => {
    try {
      const [
        clubId,
        playerId,
        gameId,
        playerUuid,
        clubCode,
        gameCode,
      ] = await createClubAndStartGame();
      flopHand.handNum = 1;
      flopHand.gameNum = gameId;
      flopHand.clubId = clubId;
      flopHand.handResult.potWinners[0].hiWinners[0].seatNo = 1;
      flopHand.handResult.balanceAfterHand[0].playerId = playerId;
      flopHand.handResult.playersInSeats = [playerId];
      for (let i = 1; i < 5; i++) {
        flopHand.handNum = i;
        await saveHandData(flopHand);
      }
      const handHistory = await getLastHandHistory(playerUuid, {
        clubCode: clubCode,
        gameCode: gameCode,
      });
      expect(handHistory.gameType).toBe('HOLDEM');
      expect(handHistory.wonAt).toBe('FLOP');
      expect(handHistory.handNum).toBe(4);
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('Get all hand history', async () => {
    try {
      const [
        clubId,
        playerId,
        gameId,
        playerUuid,
        clubCode,
        gameCode,
      ] = await createClubAndStartGame();
      flopHand.handNum = 1;
      flopHand.gameNum = gameId;
      flopHand.clubId = clubId;
      flopHand.handResult.potWinners[0].hiWinners[0].seatNo = 1;
      flopHand.handResult.balanceAfterHand[0].playerId = playerId;
      flopHand.handResult.playersInSeats = [playerId];
      for (let i = 1; i < 5; i++) {
        flopHand.handNum = i;
        await saveHandData(flopHand);
      }
      const handHistory = await getAllHandHistory(playerUuid, {
        clubCode: clubCode,
        gameCode: gameCode,
      });
      expect(handHistory).toHaveLength(4);
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('Get all hand history pagination', async () => {
    try {
      const [
        clubId,
        playerId,
        gameId,
        playerUuid,
        clubCode,
        gameCode,
      ] = await createClubAndStartGame();
      flopHand.handNum = 1;
      flopHand.gameNum = gameId;
      flopHand.clubId = clubId;
      flopHand.handResult.potWinners[0].hiWinners[0].seatNo = 1;
      flopHand.handResult.balanceAfterHand[0].playerId = playerId;
      flopHand.handResult.playersInSeats = [playerId];
      for (let i = 1; i < 17; i++) {
        flopHand.handNum = i;
        await saveHandData(flopHand);
      }
      const handHistory = await getAllHandHistory(playerUuid, {
        clubCode: clubCode,
        gameCode: gameCode,
      });
      expect(handHistory).toHaveLength(10);
      const lastHand = handHistory[9];
      const handHistory1 = await getAllHandHistory(playerUuid, {
        clubCode: clubCode,
        gameCode: gameCode,
        page: {
          prev: lastHand.pageId,
          count: 5,
        },
      });
      expect(handHistory1).toHaveLength(5);
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('Get my winning hands', async () => {
    try {
      const [
        clubId,
        playerId,
        gameId,
        playerUuid,
        clubCode,
        gameCode,
      ] = await createClubAndStartGame();
      flopHand.handNum = 1;
      flopHand.gameNum = gameId;
      flopHand.clubId = clubId;
      flopHand.handResult.potWinners[0].hiWinners[0].seatNo = 1;
      flopHand.handResult.balanceAfterHand[0].playerId = playerId;
      flopHand.handResult.playersInSeats = [playerId];
      for (let i = 1; i < 5; i++) {
        flopHand.handNum = i;
        await saveHandData(flopHand);
      }
      const winningHands = await getMyWinningHands(playerUuid, {
        clubCode: clubCode,
        gameCode: gameCode,
      });
      expect(winningHands).toHaveLength(4);
      winningHands.forEach(element => {
        expect(element.playerId).toBe(playerId);
      });
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('Get my winning hands pagination', async () => {
    try {
      const [
        clubId,
        playerId,
        gameId,
        playerUuid,
        clubCode,
        gameCode,
      ] = await createClubAndStartGame();
      flopHand.handNum = 1;
      flopHand.gameNum = gameId;
      flopHand.clubId = clubId;
      flopHand.handResult.potWinners[0].hiWinners[0].seatNo = 1;
      flopHand.handResult.balanceAfterHand[0].playerId = playerId;
      flopHand.handResult.playersInSeats = [playerId];
      for (let i = 1; i < 17; i++) {
        flopHand.handNum = i;
        await saveHandData(flopHand);
      }
      const winningHands = await getMyWinningHands(playerUuid, {
        clubCode: clubCode,
        gameCode: gameCode,
      });
      expect(winningHands).toHaveLength(10);
      const lastHand = winningHands[9];
      const winningHands1 = await getMyWinningHands(playerUuid, {
        clubCode: clubCode,
        gameCode: gameCode,
        page: {
          prev: lastHand.pageId,
          count: 5,
        },
      });
      expect(winningHands1).toHaveLength(5);
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('Save starred hand', async () => {
    try {
      const [
        clubId,
        playerId,
        gameId,
        playerUuid,
        clubCode,
        gameCode,
      ] = await createClubAndStartGame();
      flopHand.handNum = 1;
      flopHand.gameNum = gameId;
      flopHand.clubId = clubId;
      flopHand.handResult.potWinners[0].hiWinners[0].seatNo = 1;
      flopHand.handResult.balanceAfterHand[0].playerId = playerId;
      flopHand.handResult.playersInSeats = [playerId];
      const resp = await saveHandData(flopHand);
      expect(resp).toBe(true);

      const starredHand = await saveStarredHand(playerUuid, {
        clubCode: clubCode,
        gameCode: gameCode,
        handNum: 1,
      });
      expect(starredHand).toBe(true);
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('Get starred hands', async () => {
    try {
      const [
        clubId,
        playerId,
        gameId,
        playerUuid,
        clubCode,
        gameCode,
      ] = await createClubAndStartGame();
      flopHand.gameNum = gameId;
      flopHand.clubId = clubId;
      flopHand.handResult.potWinners[0].hiWinners[0].seatNo = 1;
      flopHand.handResult.balanceAfterHand[0].playerId = playerId;
      flopHand.handResult.playersInSeats = [playerId];
      for (let i = 1; i < 30; i++) {
        flopHand.handNum = i;
        await saveHandData(flopHand);
        await saveStarredHand(playerUuid, {
          clubCode: clubCode,
          gameCode: gameCode,
          handNum: i,
        });
      }

      const starredHands = await getAllStarredHands(playerUuid, {});
      expect(starredHands).toHaveLength(25);
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });
});
