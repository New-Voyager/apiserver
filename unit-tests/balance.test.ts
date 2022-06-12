import {getLogger} from '../src/utils/log';
import {balanceTable, TournamentData} from '../src/repositories/balance'

const logger = getLogger('balance unit-test');

beforeAll(async done => {
  done();
});

afterAll(async done => {
  done();
});

describe('Table Balancing', () => {
  beforeEach(async done => {
    done();
  });

  afterEach(async done => {
    done();
  });

  test('balance 2 tables', async () => {

    const tournament = `
    {
      "id": 2,
      "name": "Sunday tournament",
      "minPlayers": 2,
      "maxPlayers": 100,
      "activePlayers": 12,
      "maxPlayersInTable": 6,
      "levelTime": 10,
      "currentLevel": 1,
      "levels": [
        {
          "level": 1,
          "smallBlind": 200,
          "bigBlind": 400,
          "ante": 0
        },
        {
          "level": 2,
          "smallBlind": 400,
          "bigBlind": 800,
          "ante": 0
        },
        {
          "level": 3,
          "smallBlind": 800,
          "bigBlind": 1600,
          "ante": 0
        },
        {
          "level": 4,
          "smallBlind": 1600,
          "bigBlind": 3200,
          "ante": 0
        },
        {
          "level": 5,
          "smallBlind": 3200,
          "bigBlind": 6400,
          "ante": 0
        },
        {
          "level": 6,
          "smallBlind": 6400,
          "bigBlind": 12800,
          "ante": 200
        },
        {
          "level": 7,
          "smallBlind": 12800,
          "bigBlind": 25600,
          "ante": 400
        },
        {
          "level": 8,
          "smallBlind": 25600,
          "bigBlind": 51200,
          "ante": 600
        },
        {
          "level": 9,
          "smallBlind": 51200,
          "bigBlind": 102400,
          "ante": 800
        },
        {
          "level": 10,
          "smallBlind": 102400,
          "bigBlind": 204800,
          "ante": 1000
        },
        {
          "level": 11,
          "smallBlind": 204800,
          "bigBlind": 409600,
          "ante": 1200
        },
        {
          "level": 12,
          "smallBlind": 409600,
          "bigBlind": 819200,
          "ante": 1400
        },
        {
          "level": 13,
          "smallBlind": 819200,
          "bigBlind": 1638400,
          "ante": 1600
        },
        {
          "level": 14,
          "smallBlind": 1638400,
          "bigBlind": 3276800,
          "ante": 1800
        },
        {
          "level": 15,
          "smallBlind": 3276800,
          "bigBlind": 6553600,
          "ante": 2000
        },
        {
          "level": 16,
          "smallBlind": 6553600,
          "bigBlind": 13107200,
          "ante": 2200
        },
        {
          "level": 17,
          "smallBlind": 13107200,
          "bigBlind": 26214400,
          "ante": 2400
        },
        {
          "level": 18,
          "smallBlind": 26214400,
          "bigBlind": 52428800,
          "ante": 2600
        },
        {
          "level": 19,
          "smallBlind": 52428800,
          "bigBlind": 104857600,
          "ante": 2800
        },
        {
          "level": 20,
          "smallBlind": 104857600,
          "bigBlind": 209715200,
          "ante": 3000
        }
      ],
      "tables": [
        {
          "tableNo": 1,
          "players": [
            {
              "playerId": 2,
              "playerName": "Cason",
              "playerUuid": "f0a675ef-0000-4963-0000-75a7d1735665",
              "stack": 100000,
              "isSittingOut": false,
              "isBot": true,
              "tableNo": 1,
              "seatNo": 1,
              "status": 2,
              "timesMoved": 0,
              "stackBeforeHand": 100000
            },
            {
              "playerId": 5,
              "playerName": "Alfred",
              "playerUuid": "f0a675ef-0000-4963-0003-75a7d1735665",
              "stack": 300000,
              "isSittingOut": false,
              "isBot": true,
              "tableNo": 1,
              "seatNo": 4,
              "status": 2,
              "timesMoved": 0,
              "stackBeforeHand": 300000
            },
            {
              "playerId": 6,
              "playerName": "Elsa",
              "playerUuid": "f0a675ef-0000-4963-0004-75a7d1735665",
              "stack": 100000,
              "isSittingOut": false,
              "isBot": true,
              "tableNo": 1,
              "seatNo": 5,
              "status": 2,
              "timesMoved": 0,
              "stackBeforeHand": 100000
            },
            {
              "playerId": 7,
              "playerName": "Raymond",
              "playerUuid": "f0a675ef-0000-4963-0005-75a7d1735665",
              "stack": 100000,
              "isSittingOut": false,
              "isBot": true,
              "tableNo": 1,
              "seatNo": 6,
              "status": 2,
              "timesMoved": 0,
              "stackBeforeHand": 100000
            }
          ],
          "handNum": 10,
          "tableServer": "",
          "isActive": true,
          "chipsOnTheTable": 600000,
          "paused": false
        },
        {
          "tableNo": 2,
          "players": [
            {
              "playerId": 8,
              "playerName": "Maryjane",
              "playerUuid": "f0a675ef-0000-4963-0006-75a7d1735665",
              "stack": 100000,
              "isSittingOut": false,
              "isBot": true,
              "tableNo": 2,
              "seatNo": 1,
              "status": 2,
              "timesMoved": 0,
              "stackBeforeHand": 100000
            },
            {
              "playerId": 13,
              "playerName": "Reyna",
              "playerUuid": "f0a675ef-0000-4963-000b-75a7d1735665",
              "stack": 500000,
              "isSittingOut": false,
              "isBot": true,
              "tableNo": 2,
              "seatNo": 6,
              "status": 2,
              "timesMoved": 0,
              "stackBeforeHand": 500000
            }
          ],
          "handNum": 13,
          "tableServer": "",
          "isActive": true,
          "chipsOnTheTable": 600000,
          "paused": false
        }
      ],
      "registeredPlayers": [
        {
          "playerId": 2,
          "playerName": "Cason",
          "playerUuid": "f0a675ef-0000-4963-0000-75a7d1735665",
          "stack": null,
          "isSittingOut": false,
          "isBot": true,
          "tableNo": 1
        },
        {
          "playerId": 3,
          "playerName": "Julius",
          "playerUuid": "f0a675ef-0000-4963-0001-75a7d1735665",
          "stack": null,
          "isSittingOut": false,
          "isBot": true,
          "tableNo": 1
        },
        {
          "playerId": 4,
          "playerName": "Alexandra",
          "playerUuid": "f0a675ef-0000-4963-0002-75a7d1735665",
          "stack": null,
          "isSittingOut": false,
          "isBot": true,
          "tableNo": 1
        },
        {
          "playerId": 5,
          "playerName": "Alfred",
          "playerUuid": "f0a675ef-0000-4963-0003-75a7d1735665",
          "stack": null,
          "isSittingOut": false,
          "isBot": true,
          "tableNo": 1
        },
        {
          "playerId": 6,
          "playerName": "Elsa",
          "playerUuid": "f0a675ef-0000-4963-0004-75a7d1735665",
          "stack": null,
          "isSittingOut": false,
          "isBot": true,
          "tableNo": 1
        },
        {
          "playerId": 7,
          "playerName": "Raymond",
          "playerUuid": "f0a675ef-0000-4963-0005-75a7d1735665",
          "stack": null,
          "isSittingOut": false,
          "isBot": true,
          "tableNo": 1
        },
        {
          "playerId": 8,
          "playerName": "Maryjane",
          "playerUuid": "f0a675ef-0000-4963-0006-75a7d1735665",
          "stack": null,
          "isSittingOut": false,
          "isBot": true,
          "tableNo": 2
        },
        {
          "playerId": 9,
          "playerName": "Kameron",
          "playerUuid": "f0a675ef-0000-4963-0007-75a7d1735665",
          "stack": null,
          "isSittingOut": false,
          "isBot": true,
          "tableNo": 2
        },
        {
          "playerId": 10,
          "playerName": "Trevin",
          "playerUuid": "f0a675ef-0000-4963-0008-75a7d1735665",
          "stack": null,
          "isSittingOut": false,
          "isBot": true,
          "tableNo": 2
        },
        {
          "playerId": 11,
          "playerName": "Santos",
          "playerUuid": "f0a675ef-0000-4963-0009-75a7d1735665",
          "stack": null,
          "isSittingOut": false,
          "isBot": true,
          "tableNo": 2
        },
        {
          "playerId": 12,
          "playerName": "Adison",
          "playerUuid": "f0a675ef-0000-4963-000a-75a7d1735665",
          "stack": null,
          "isSittingOut": false,
          "isBot": true,
          "tableNo": 2
        },
        {
          "playerId": 13,
          "playerName": "Reyna",
          "playerUuid": "f0a675ef-0000-4963-000b-75a7d1735665",
          "stack": null,
          "isSittingOut": false,
          "isBot": true,
          "tableNo": 2
        }
      ],
      "playersInTournament": [],
      "startingChips": 100000,
      "tableServerId": 1,
      "balanced": false,
      "totalChips": 1200000
    }
    `
    const data: TournamentData = JSON.parse(tournament);

    const [table1Before, table2Before] = data.tables;
    expect(table1Before.players.length).toBe(4);
    expect(table2Before.players.length).toBe(2);

    const currentTableNo = 2;
    const [resultData, movedPlayers] = balanceTable(data, currentTableNo);

    const [table1After, table2After] = resultData.tables;
    expect(table1After.players.length).toBe(6);
    expect(table2After.players.length).toBe(0);

    expect(movedPlayers.length).toBe(2);
    movedPlayers.sort((p1, p2) => (p1.playerName > p2.playerName) ? 1 : -1);
    expect(movedPlayers[0]).toMatchObject({playerName: "Maryjane", oldTableNo: 2, newTableNo: 1, stack: 100000});
    expect(movedPlayers[1]).toMatchObject({playerName: "Reyna", oldTableNo: 2, newTableNo: 1, stack: 500000});
  });
});
