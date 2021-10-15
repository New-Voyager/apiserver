import {resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import * as gameutils from '../utils/game.testutils'
import {
  configureGame,
  createGameServer,
  holdemGameInput,
  joinGame,
} from '../game/utils';

describe('approve and deny club member APIs', () => {
  beforeAll(async done => {
    await resetDatabase();
    done();
  });

  afterAll(async done => {
    done();
  });
  test('Club member approval/deny', async () => {
    const [clubCode, playerId] = await clubutils.createClub('brady', 'yatzee');
    const playerId2 = await clubutils.createPlayer('adam', '1243ABC');
    const playerId3 = await clubutils.createPlayer('adam1', '1243ABCD');
    await clubutils.playerJoinsClub(clubCode, playerId2);
    await createGameServer('1.99.0.1');
    await clubutils.playerJoinsClub(clubCode,playerId2)
    await clubutils.playerJoinsClub(clubCode,playerId3)
    await configureGame({clubCode, playerId});

    await clubutils.approvePlayer(clubCode,playerId, playerId2)
    const data1 = await clubutils.rejectMember({
        clubCode:clubCode,
        ownerId:playerId,
        playerUuid:playerId3
    })
    const player1Info = await clubutils.getClubMember(playerId2,clubCode)
    const player2Info = await clubutils.getClubMember(playerId3,clubCode)

    expect(data1.status).toEqual('DENIED');
    expect(player1Info.status).toEqual('ACTIVE')
    expect(player2Info.status).toEqual('DENIED')
})
})