import {initializeSqlLite} from './utils';
import {getLogger} from '../src/utils/log';
import {resetDB} from '@src/resolvers/reset';
import {createPlayer, getPlayerById} from '@src/resolvers/player';
import {createClub, getClubById} from '@src/resolvers/club';
import {createGameServer} from '@src/internal/gameserver';
import {startGame, getGameById} from '@src/resolvers/game';
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

const handData = {
  ClubId: '',
  GameNum: '',
  HandNum: '1',
  Players: [1],
  GameType: 'HOLDEM',
  StartedAt: '2020-06-30T00:02:10',
  EndedAt: '2020-06-30T00:04:00',
  Result: {
    pot_winners: [
      {
        pot: 0,
        amount: 186.0,
        winners: [
          {
            player: 1,
            received: 93.0,
            rank: 'TWO PAIR',
            rank_num: 1203,
            winning_cards: ['Ah', 'As', 'Kh', 'Ks', 'Qh'],
          },
        ],
      },
    ],
    won_at: 'SHOWDOWN',
    showdown: true,
    winning_rank: 'TWO PAIR',
    rank_num: 1023,
    winning_cards: ['Ah', 'As', 'Kh', 'Kc', 'Qh'],
    total_pot: 186.0,
    rake: 2.0,
    summary: [
      {
        player: 1000,
        balance: 85.0,
        change: 0.0,
      },
    ],
  },
};

const handDataHiLo = {
  ClubId: '',
  GameNum: '',
  HandNum: '1',
  Players: [1],
  GameType: 'OMAHA_HILO',
  StartedAt: '2020-06-30T00:02:10',
  EndedAt: '2020-06-30T00:04:00',
  Result: {
    pot_winners: [
      {
        pot: 0,
        amount: 186.0,
        hi_winners: [
          {
            player: 1,
            received: 93.0,
            rank: 'TWO PAIR',
            rank_num: 1203,
            winning_cards: ['Ah', 'As', 'Kh', 'Ks', 'Qh'],
          },
        ],
        lo_winners: [
          {
            player: 1,
            received: 93.0,
            rank: 'TWO PAIR',
            rank_num: 1203,
            winning_cards: ['Ah', 'As', 'Kh', 'Ks', 'Qh'],
          },
        ],
      },
    ],
    won_at: 'SHOWDOWN',
    showdown: true,
    hi_winning_cards: ['Ac', 'Ad', 'Kd', 'Kc', 'Qh'],
    hi_winning_rank: 1203,
    lo_winning_cards: ['8d', '4s', '5d', '2s', 'Ac'],
    lo_winning_rank: 5882,
    total_pot: 255.0,
    rake: 2.0,
    summary: [
      {
        player: 1000,
        balance: 85.0,
        change: 0.0,
      },
    ],
  },
};

beforeAll(async done => {
  await initializeSqlLite();
  done();
});

afterAll(async done => {
  done();
});

describe('Hand server APIs', () => {
  beforeEach(async done => {
    await resetDB();
    done();
  });

  afterEach(async done => {
    done();
  });

  test('Save hand data', async () => {
    try {
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
      const gameId = (await getGameById(owner, game.gameId)).id;
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
      handData.HandNum = '1';
      handData.GameNum = game.gameId;
      handData.ClubId = club;
      handData.Result.pot_winners[0].winners[0].player = playerId;
      handData.Result.summary[0].player = playerId;
      handData.Result.showdown = false;
      const resp = await saveHandData(handData);
      expect(resp).toBe(true);
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('Save hand data HiLo', async () => {
    // try {
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
    const gameId = (await getGameById(owner, game.gameId)).id;
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
    handDataHiLo.HandNum = '1';
    handDataHiLo.GameNum = game.gameId;
    handDataHiLo.ClubId = club;
    handDataHiLo.Result.pot_winners[0].hi_winners[0].player = playerId;
    handDataHiLo.Result.pot_winners[0].lo_winners[0].player = playerId;
    handDataHiLo.Result.summary[0].player = playerId;
    const resp = await saveHandData(handDataHiLo);
    expect(resp).toBe(true);
    // } catch (err) {
    //   logger.error(JSON.stringify(err));
    //   expect(true).toBeFalsy();
    // }
  });

  test('Get specific hand history', async () => {
    try {
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
      const gameId = (await getGameById(owner, game.gameId)).id;
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
      handData.HandNum = '1';
      handData.GameNum = game.gameId;
      handData.ClubId = club;
      handData.Result.pot_winners[0].winners[0].player = playerId;
      handData.Result.summary[0].player = playerId;
      handData.Result.showdown = true;
      const resp = await saveHandData(handData);
      expect(resp).toBe(true);
      const handHistory = await getSpecificHandHistory(owner, {
        clubId: club,
        gameNum: game.gameId,
        handNum: '1',
      });
      expect(handHistory.gameType).toBe('HOLDEM');
      expect(handHistory.wonAt).toBe('SHOWDOWN');
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('Get latest hand history', async () => {
    try {
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
      const gameId = (await getGameById(owner, game.gameId)).id;
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
      handData.GameNum = game.gameId;
      handData.ClubId = club;
      handData.Result.pot_winners[0].winners[0].player = playerId;
      handData.Result.summary[0].player = playerId;
      for (let i = 1; i < 5; i++) {
        handData.HandNum = i.toString();
        await saveHandData(handData);
      }
      const handHistory = await getLastHandHistory(owner, {
        clubId: club,
        gameNum: game.gameId,
      });
      expect(handHistory.gameType).toBe('HOLDEM');
      expect(handHistory.wonAt).toBe('SHOWDOWN');
      expect(handHistory.handNum).toBe('4');
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('Get all hand history', async () => {
    try {
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
      const gameId = (await getGameById(owner, game.gameId)).id;
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
      handData.GameNum = game.gameId;
      handData.ClubId = club;
      handData.Result.pot_winners[0].winners[0].player = playerId;
      handData.Result.summary[0].player = playerId;
      for (let i = 1; i < 5; i++) {
        handData.HandNum = i.toString();
        await saveHandData(handData);
      }
      const handHistory = await getAllHandHistory(owner, {
        clubId: club,
        gameNum: game.gameId,
      });
      expect(handHistory).toHaveLength(4);
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('Get all hand history pagination', async () => {
    try {
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
      const gameId = (await getGameById(owner, game.gameId)).id;
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
      handData.GameNum = game.gameId;
      handData.ClubId = club;
      handData.Result.pot_winners[0].winners[0].player = playerId;
      handData.Result.summary[0].player = playerId;
      for (let i = 1; i < 17; i++) {
        handData.HandNum = i.toString();
        await saveHandData(handData);
      }
      const handHistory = await getAllHandHistory(owner, {
        clubId: club,
        gameNum: game.gameId,
      });
      expect(handHistory).toHaveLength(10);
      const lastHand = handHistory[9];
      const handHistory1 = await getAllHandHistory(owner, {
        clubId: club,
        gameNum: game.gameId,
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
      const gameId = (await getGameById(owner, game.gameId)).id;
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
      handData.GameNum = game.gameId;
      handData.ClubId = club;
      handData.Result.pot_winners[0].winners[0].player = playerId;
      handData.Result.summary[0].player = playerId;
      for (let i = 1; i < 5; i++) {
        handData.HandNum = i.toString();
        await saveHandData(handData);
      }
      const winningHands = await getMyWinningHands(owner, {
        clubId: club,
        gameNum: game.gameId,
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
      const gameId = (await getGameById(owner, game.gameId)).id;
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
      handData.GameNum = game.gameId;
      handData.ClubId = club;
      handData.Result.pot_winners[0].winners[0].player = playerId;
      handData.Result.summary[0].player = playerId;
      for (let i = 1; i < 17; i++) {
        handData.HandNum = i.toString();
        await saveHandData(handData);
      }
      const winningHands = await getMyWinningHands(owner, {
        clubId: club,
        gameNum: game.gameId,
      });
      expect(winningHands).toHaveLength(10);
      winningHands.forEach(element => {
        expect(element.playerId).toBe(playerId);
      });
      const lastHand = winningHands[9];
      const winningHands1 = await getMyWinningHands(owner, {
        clubId: club,
        gameNum: game.gameId,
        page: {
          prev: lastHand.pageId,
          count: 5,
        },
      });
      expect(winningHands1).toHaveLength(5);
      winningHands1.forEach(element => {
        expect(element.playerId).toBe(playerId);
      });
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('Save starred hand', async () => {
    try {
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
      const gameId = (await getGameById(owner, game.gameId)).id;
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
      handData.HandNum = '1';
      handData.GameNum = game.gameId;
      handData.ClubId = club;
      handData.Result.pot_winners[0].winners[0].player = playerId;
      handData.Result.summary[0].player = playerId;
      const resp = await saveHandData(handData);
      expect(resp).toBe(true);

      const starredHand = await saveStarredHand(owner, {
        clubId: club,
        gameNum: game.gameId,
        handNum: '1',
      });
      expect(starredHand).toBe(true);
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('Get starred hands', async () => {
    try {
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
      const gameId = (await getGameById(owner, game.gameId)).id;
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
      handData.GameNum = game.gameId;
      handData.ClubId = club;
      handData.Result.pot_winners[0].winners[0].player = playerId;
      handData.Result.summary[0].player = playerId;
      for (let i = 1; i < 30; i++) {
        handData.HandNum = i.toString();
        await saveHandData(handData);
        await saveStarredHand(owner, {
          clubId: club,
          gameNum: game.gameId,
          handNum: i.toString(),
        });
      }
      const starredHands = await getAllStarredHands(owner, {});
      expect(starredHands).toHaveLength(25);
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });
});
