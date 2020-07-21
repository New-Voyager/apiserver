import {initializeSqlLite} from './utils';
import {getLogger} from '../src/utils/log';
import {resetDB} from '@src/resolvers/reset';
import {createPlayer, getPlayerById} from '@src/resolvers/player';
import {createClub, getClubById} from '@src/resolvers/club';
import {createGameServer} from '@src/internal/gameserver';
import {startGame, getGameById} from '@src/resolvers/game';
import {saveChipsData} from '@src/internal/chipstrack';

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
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });
});
