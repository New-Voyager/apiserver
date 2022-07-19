import { GameType } from '@src/entity/types';
import { errToStr, getLogger } from '@src/utils/log';
import { bool } from 'aws-sdk/clients/signer';
import _ from 'lodash';

const logger = getLogger('balance');

export interface TableMove {
  newTableNo: number;
  oldTableNo: number;
  oldSeatNo: number;
  playerId: number;
  playerUuid: string;
  playerName: string;
  stack: number;
  seatNo: number;
}

export interface Table {
  tableNo: number;
  players: Array<TournamentPlayer>;
  tableServer: string;
  handNum: number;
  isActive: boolean;
  chipsOnTheTable: number;
  paused: boolean; // table may be paused if there are not enough players

  // this array is maxPlayersPerTable + 1 (Dealer seat)
  // this is used for tracking which players were sitting on the table in the last hand
  // used for determining small blind, big blind and button pos
  prevHandSeats: Array<number>;
  buttonPos: number;
  smallBlindPos: number;
  bigBlindPos: number;

  lastHandStartTime: Date | null;
  lastHandSaveTime: Date | null;
}

export enum TournamentPlayingStatus {
  REGISTERED,
  JOINED,
  PLAYING,
  BUSTED_OUT,
  SITTING_OUT,
}

// # tournament stats (player: rank, busted_order, how many hands played, how many times moved, duration, chipsBeforeBusted, largestStack, lowStack)
// # busted_order: 1, 2, 3 as the player goes out of the tournament
// # rank order: active players are ranked by their chips, busted players are ranked by reverse busted_order
export interface TournamentPlayer {
  playerId: number;
  playerName: string;
  playerUuid: string;
  stack: number;
  isSittingOut: boolean;
  isBot: boolean;
  tableNo: number;
  seatNo: number;
  status: TournamentPlayingStatus;
  startTime: Date;
  timesMoved: 0;
  stackBeforeHand: number;
  bustedOrder: number; //1 is the first player to burst out, 2 is the second, 3 is the third, and so on
  stackBeforeBusted: number;
  bustedTime: Date | null;
  handsPlayed: number;
  duration: number;
  largestStack: number;
  lowStack: number;
  bustedLevel: number;
}

export interface TournamentPlayerRank {
  playerId: number;
  playerName: string;
  playerUuid: string;
  stackBeforeBusted: number;
  handsPlayed: number;
  duration: number;
  largestStack: number;
  lowStack: number;
  rank: number;
  bustedLevel: number;
  bustedTime: Date | null;
}

export interface TournamentResult {
  ranks: Array<TournamentPlayerRank>;
}

export interface TournamentData {
  id: number;
  startingChips: number;
  name: string;
  currentLevel: number; // -1 = not started
  levelTime: number;
  activePlayers: number;
  levels: Array<TournamentLevel>;
  scheduledStartTime: Date;
  minPlayers: number;
  maxPlayers: number;
  maxPlayersInTable: number;
  tables: Array<Table>;
  registeredPlayers: Array<TournamentPlayer>;
  playersInTournament: Array<TournamentPlayer>;
  bustedPlayers: Array<TournamentPlayer>;
  tableServerId: number; // all the tournament tables are on this server
  balanced: boolean;
  totalChips: number;
  status: TournamentStatus;
  startTime: Date | null;
  endTime: Date | null;
  timeTakenToBalance: number;
  result: TournamentResult;
  bustedOrder: number;
  fillWithBots: boolean;
}

export interface TournamentLevel {
  level: number;
  smallBlind: number;
  bigBlind: number;
  ante: number;
}

export interface TournamentTableInfo {
  gameCode: string;
  gameType: GameType;
  smallBlind: number;
  bigBlind: number;
  ante: number;
  players: Array<TournamentPlayer>;
  level: number;
  nextLevel: number;
  nextLevelTimeInSecs: number;
  chipsOnTheTable: number;
}
export function balanceTable(
  data: TournamentData,
  currentTableNo: number
): [TournamentData, Array<TableMove>] {
  const tournamentId = data.id;
  let movedPlayers = new Array<TableMove>();
  try {
    let currentTable = data.tables.find(t => t.tableNo === currentTableNo);

    // check whether we can remove the current table
    let currentTablePlayers: Array<TournamentPlayer> = [];
    if (currentTable && currentTable.players) {
      currentTablePlayers = currentTable.players;
    }

    if (!currentTable) {
      return [data, movedPlayers];
    }
    // get active tables
    let activeTables = 0;
    for (const table of data.tables) {
      if (table.isActive) {
        activeTables++;
      }
    }
    // get total active players
    let totalActivePlayers = 0;
    for (const table of data.tables) {
      totalActivePlayers += table.players.length;
    }
    let tablesRequired = Math.floor(
      totalActivePlayers / data.maxPlayersInTable
    );
    if (totalActivePlayers % data.maxPlayersInTable !== 0) {
      tablesRequired++;
    }
    let totalChipsOnTheTournament = 0;
    for (const table of data.tables) {
      for (const player of table.players) {
        totalChipsOnTheTournament += player.stack;
      }
    }

    totalChipsOnTheTournament = 0;
    for (const table of data.tables) {
      for (const player of table.players) {
        totalChipsOnTheTournament += player.stack;
      }
    }
    logger.info(
      `  ---------- Balance table started: Tournament: ${tournamentId} tableNo: ${currentTableNo} ----------`
    );

    if (activeTables === 1) {
      logger.info(`Only one final table is active. No need to balance`);
      // balanced
      data.balanced = true;
      return [data, movedPlayers];
    }

    let playersPerTable = Math.floor(totalActivePlayers / tablesRequired);
    if (totalActivePlayers % tablesRequired !== 0) {
      playersPerTable++;
    }

    let currentTableBalanced = false;
    // first check whether the current table is balanced with players
    if (
      currentTablePlayers.length == playersPerTable ||
      currentTablePlayers.length == playersPerTable + 1 ||
      currentTablePlayers.length == playersPerTable - 1
    ) {
      currentTableBalanced = true;
      // OK, current table is balanced. So we don't need to move the players from this table to other table
    }
    if (!currentTableBalanced) {
      // current table is not balanced, so we need to remove this table or
      // move some players to another table
      // choose the players to move
      let playersBeingMoved = determinePlayersToMove(
        playersPerTable,
        data,
        currentTable,
      );
      let playerNames = new Array<string>();
      for (const player of playersBeingMoved) {
        if (player) {
          playerNames.push(`${player.playerName}:${player.playerId}`);
        }
      }
      logger.info(`1 Players being moved: ${playerNames.join(',')}`);

      // move players to other tables
      movedPlayers = movePlayers(
        data,
        currentTableNo,
        playersPerTable,
        playersBeingMoved
      );

      if (currentTablePlayers.length) {
      } else {
        logger.info(
          `Table ${currentTableNo} has ${currentTablePlayers.length} players and table is inactive`
        );
        currentTable.isActive = false;
      }
    } else {
      // current table is not balanced, so we need to remove this table or
      // move some players to another table
      // choose the players to move
      let playersBeingMoved = determinePlayersToMove2(
        playersPerTable,
        data,
        currentTable
      );
      if (playersBeingMoved.length >= 1) {
        let playerNames = new Array<string>();
        for (const player of playersBeingMoved) {
          if (player) {
            playerNames.push(`${player.playerName}:${player.playerId}`);
          }
        }
        logger.info(`2 Players being moved: ${playerNames.join(',')}`);

        // move players to other tables
        movedPlayers = movePlayers(
          data,
          currentTableNo,
          playersPerTable,
          playersBeingMoved
        );
      }

      if (currentTablePlayers.length) {
      } else {
        logger.info(
          `Table ${currentTableNo} has ${currentTablePlayers.length} players and table is inactive`
        );
        currentTable.isActive = false;
      }
    }

    // check to see whether we balanced all the tables in the tournament
    data.balanced = true;
    let activeTablesAfter = 0;
    totalChipsOnTheTournament = 0;
    for (const table of data.tables) {
      for (const player of table.players) {
        totalChipsOnTheTournament += player.stack;
      }
      if (table.isActive) {
        activeTablesAfter++;
        if (
          table.players.length == playersPerTable ||
          table.players.length == playersPerTable + 1 ||
          table.players.length == playersPerTable - 1
        ) {
          // nothing to do
        } else {
          data.balanced = false;
          break;
        }
      } else {
      }
    }

    return [data, movedPlayers];
  } catch (err) {
    logger.error(`Failed to balance table ${currentTableNo}`);
    return [data, movedPlayers];
  } finally {
    logger.info(
      `  ---------- Balance table started: Tournament: ${tournamentId} tableNo: ${currentTableNo} ENDED ----------`
    );
  }
}

function determinePlayersToMove(
  playersPerTable: number,
  data: TournamentData,
  currentTable: Table
): Array<TournamentPlayer | undefined> {
  let playersBeingMoved = new Array<TournamentPlayer | undefined>();
  let playersToMove = 0;
  if (currentTable.players.length > playersPerTable) {
    // we may need to move some players to other tables
    playersToMove = currentTable.players.length - playersPerTable;
  } else {
    // can you move all the players to other tables
    let availableOpenSeats = 0;
    for (const table of data.tables) {
      // skip inactive tables
      if (!table.isActive) {
        continue;
      }
      if (table.tableNo !== currentTable.tableNo) {
        availableOpenSeats += data.maxPlayersInTable - table.players.length;
      }
    }

    if (availableOpenSeats >= currentTable.players.length) {
      logger.info(`Table: ${currentTable.tableNo} can be removed`);
      // all the players can be moved to other tables
      playersToMove = currentTable.players.length;
    }
  }

  // move the players to other tables
  if (playersToMove > 0) {
    // start from the player who would be big blind next hand
    let occupiedSeats = getOccupiedSeats(data, currentTable);
    let moveSeat = currentTable.bigBlindPos;
    while (playersToMove > 0) {
      playersToMove--;
      moveSeat = getNextActiveSeat(data, occupiedSeats, moveSeat);
      for (const player of currentTable.players) {
        if (player.seatNo == moveSeat) {
          playersBeingMoved.push(player);
          currentTable.players = _.filter(currentTable.players, e => e.seatNo != moveSeat);
          break;
        }
      }
    }
    if (currentTable.players.length === 0) {
      currentTable.isActive = false;
    }
  }
  return playersBeingMoved;
}

/**
 * determinePlayersToMove2: Used when current table has balance number of players, but other tables may have less players
 * For example, 6, 6, 4 scenario
 * The current table is 2, and we can move one player from this table to table 3
 *
 * @param playersPerTable
 * @param data
 * @param currentTable
 * @returns
 */
function determinePlayersToMove2(
  playersPerTable: number,
  data: TournamentData,
  currentTable: Table
): Array<TournamentPlayer | undefined> {
  let playersBeingMoved = new Array<TournamentPlayer | undefined>();
  let playersToMove = 0;

  // check another table that has less than optimal number of players
  let chosenTable: Table | undefined;
  for (const table of data.tables) {
    if (table.tableNo == currentTable.tableNo) {
      continue;
    }
    // skip inactive tables
    if (!table.isActive) {
      continue;
    }

    if (table.players.length <= playersPerTable - 2) {
      chosenTable = table;
    }
  }
  if (chosenTable) {
    // we chose a table
    const openSeatsInCurrentTable =
      data.maxPlayersInTable - currentTable.players.length;
    const openSeatsInOtherTable =
      data.maxPlayersInTable - chosenTable.players.length;
    logger.info(
      `Chosen table to move players: ${chosenTable.tableNo} currentTableNo: ${currentTable.tableNo} openSeatsInCurrentTable: ${openSeatsInCurrentTable} openSeatsInOtherTable: ${openSeatsInOtherTable}`
    );

    if (openSeatsInOtherTable - openSeatsInCurrentTable >= 2) {
      // we can move players from current table to other table
      // how many players?
      playersToMove = Math.floor(
        (openSeatsInOtherTable - openSeatsInCurrentTable) / 2
      );
    }
  }

  // move the players to other tables
  while (playersToMove > 0) {
    playersToMove--;
    playersBeingMoved.push(currentTable.players.pop());
  }
  // these players are staying
  return playersBeingMoved;
}

/*
Available seat in another table to move a player
The rank is 1 if the seat is the next blind, rank increases in that order in each table
We will try to sit the players based on the rank.
*/
interface AvailableSeatRank {
  tableNo: number;
  seatNo: number;
  rank: number;
  taken: bool;
}

function getTablesWithSeats(
  tables: Table[],
  skipTableNo: number,
  playersPerTable: number
): Array<number> {
  // find the tables with seats available
  let tablesWithSeats = new Array<number>();
  for (const table of tables) {
    if (table.tableNo !== skipTableNo) {
      if (!table.isActive) {
        continue;
      }
      if (table.players.length < playersPerTable) {
        tablesWithSeats.push(table.tableNo);
      }
    }
  }
  tablesWithSeats.sort();
  return tablesWithSeats;
}


function getTablesWithSeatsRank(
  data: TournamentData,
  tables: Table[],
  skipTableNo: number,
  playersPerTable: number
): Array<AvailableSeatRank> {
  // find the tables with seats available
  let tablesWithSeats = new Array<AvailableSeatRank>();
  for (const table of tables) {
    if (table.tableNo !== skipTableNo) {
      if (!table.isActive) {
        continue;
      }
      if (table.players.length < playersPerTable) {
        // there are seats available in this table
        let occupiedSeats = getOccupiedSeats(data, table);

        // find the next bigblind seat pos
        let nextSeatPos: number = table.bigBlindPos;
        let availableSeats = playersPerTable - table.players.length;
        let rank = 1;
        while (availableSeats > 0) {
          nextSeatPos = getNextActiveSeat(data, occupiedSeats, nextSeatPos);
          tablesWithSeats.push({
            tableNo: table.tableNo,
            seatNo: nextSeatPos,
            rank: rank,
            taken: false,
          });
          rank++
          availableSeats--;
        }
      }
    }
  }
  tablesWithSeats.sort();
  return tablesWithSeats;
}

function getOpenSeat(seatWithRank: AvailableSeatRank[], rank: number, options?: { lower?: bool, greater?: bool }): AvailableSeatRank | undefined {
  let ret: AvailableSeatRank | undefined;
  if (!options) {
    // find a seat with same rank
    for (const seat of seatWithRank) {
      if (seat.taken) {
        continue;
      }
      if (rank == 0) {
        ret = seat;
        break;
      }
      if (seat.rank == rank) {
        ret = seat;
        break;
      }
    }
  } else {
    for (const seat of seatWithRank) {
      if (seat.taken) {
        continue;
      }
      if (options.lower && seat.rank < rank) {
        ret = seat;
        break;
      } else if (options.greater && seat.rank > rank) {
        ret = seat;
        break;
      }
    }
  }
  return ret;
}

function movePlayers(
  data: TournamentData,
  currentTableNo: number,
  playersPerTable: number,
  playersBeingMoved: Array<TournamentPlayer | undefined>
): Array<TableMove> {
  const ret = new Array<TableMove>();
  let lastUsedTable: number = -1;
  let rank = 1;
  while (playersBeingMoved.length > 0) {
    const player = playersBeingMoved.pop();
    const seatsWithPlayers = getTablesWithSeatsRank(data, data.tables, currentTableNo, playersPerTable);
    if (player) {
      // find a seat with the same rank
      let openSeat = getOpenSeat(seatsWithPlayers, rank);
      if (!openSeat) {
        openSeat = getOpenSeat(seatsWithPlayers, rank, { lower: true });
      }
      if (!openSeat) {
        openSeat = getOpenSeat(seatsWithPlayers, rank, { greater: true });
      }
      if (!openSeat) {
        // get next available seat
        openSeat = getOpenSeat(seatsWithPlayers, 0);
      }
      if (openSeat) {
        openSeat.taken = true;
      }
      rank++;

      if (openSeat) {
        // pick the next table after the lastone used
        logger.info(`Moving player ${player.playerName} [${player.tableNo}: ${player.seatNo}] to a new table: [${openSeat.tableNo}:${openSeat.seatNo}]`);
        let oldSeatNo = player.seatNo;
        let oldTableNo = player.tableNo;
        player.tableNo = openSeat.tableNo;
        player.seatNo = openSeat.seatNo;
        openSeat.taken = true;
        let tableToMove = _.find(data.tables, e => e.tableNo == openSeat?.tableNo);
        if (tableToMove) {
          logger.info(`******* Moving player ${player.playerName} [${player.tableNo}: ${player.seatNo}] to a new table: [${openSeat.tableNo}:${openSeat.seatNo}]`);
          tableToMove.players.push(player);
          // player is moved
          ret.push({
            playerId: player.playerId,
            oldSeatNo: oldSeatNo,
            oldTableNo: oldTableNo,
            newTableNo: tableToMove.tableNo,
            seatNo: openSeat.seatNo,
            playerName: player.playerName,
            stack: player.stack,
            playerUuid: player.playerUuid,
          });
        }
      }
    }
  }
  return ret;
}


function movePlayers3(
  tables: Table[],
  currentTableNo: number,
  playersPerTable: number,
  maxPlayersInTable: number,
  playersBeingMoved: Array<TournamentPlayer | undefined>
): Array<TableMove> {
  const ret = new Array<TableMove>();
  let lastUsedTable: number = -1;
  while (playersBeingMoved.length > 0) {
    const player = playersBeingMoved.pop();
    if (player) {
      // pick the next table after the lastone used
      logger.info(`Moving player ${player.playerName} to a new table`);
      let nextTabletoMove: number = 0;
      const tablesWithSeats = getTablesWithSeats(
        tables,
        currentTableNo,
        playersPerTable
      );

      if (lastUsedTable === -1 || tablesWithSeats.length === 1) {
        nextTabletoMove = tablesWithSeats[0];
      } else {
        let foundLastTable = false;
        for (let i = 0; i < tablesWithSeats.length; i++) {
          if (foundLastTable) {
            nextTabletoMove = tablesWithSeats[i];
            break;
          }

          if (tablesWithSeats[i] === lastUsedTable) {
            foundLastTable = true;
            continue;
          }
        }
        if (nextTabletoMove === 0) {
          nextTabletoMove = tablesWithSeats[0];
        }
      }
      lastUsedTable = nextTabletoMove;
      for (const table of tables) {
        if (table.tableNo === nextTabletoMove) {
          // move to open seat in this table
          const takenSeats = table.players.map(e => e.seatNo);
          for (let seatNo = 1; seatNo <= maxPlayersInTable; seatNo++) {
            if (!takenSeats.includes(seatNo)) {
              player.seatNo = seatNo;
              table.players.push(player);
              logger.info(
                `Player ${player.playerName} (id: ${player.playerId}) is being moved table ${player.tableNo} => ${table.tableNo}`
              );
              player.timesMoved++;
              // player is moved
              ret.push({
                playerId: player.playerId,
                oldSeatNo: player.seatNo,
                oldTableNo: currentTableNo,
                newTableNo: table.tableNo,
                seatNo: seatNo,
                playerName: player.playerName,
                stack: player.stack,
                playerUuid: player.playerUuid,
              });
              break;
            }
          }
          break;
        }
      }
    }
  }
  return ret;
}

export enum TournamentLevelType {
  STANDARD,
  TURBO,
  SUPER_TURBO,
}

export enum TournamentStatus {
  UNKNOWN,
  SCHEDULED,
  ABOUT_TO_START,
  RUNNING,
  ENDED,
  CANCELLED,
}

export interface TournamentListItem {
  tournamentId: number;
  name: string;
  startTime: Date | null;
  startingChips: number;
  minPlayers: number;
  maxPlayers: number;
  maxPlayersInTable: number;
  levelType: TournamentLevelType;
  fillWithBots: boolean;
  status: TournamentStatus;
  registeredPlayersCount: number;
  botsCount: number;
  activePlayersCount: number;
  createdBy: string;
}

export function getLevelData(
  levelType: TournamentLevelType
): Array<TournamentLevel> {
  let standardLevels = new Array<TournamentLevel>();
  let bigBlind = 300;
  let bigBlindIncrement = 100;
  let ante = 0;
  let anteIncrement = 10;
  for (let level = 1; level <= 80; level++) {
    if (level == 5) {
      ante = 200;
      anteIncrement = 100;
      bigBlind = 1000;
      //bigBlindIncrement = 20;
    }

    if (level == 7) {
      ante = 500;
      anteIncrement = 200;
      bigBlind = 2000;
      bigBlindIncrement = 500;
    }

    if (level == 10) {
      ante = 500;
      anteIncrement = 500;
      bigBlind = 5000;
      bigBlindIncrement = 1000;
    }

    // if (level == 15) {
    //   anteIncrement = 400;
    //   bigBlindIncrement = 5000;
    // }

    // if (level == 20) {
    //   anteIncrement = 600;
    //   bigBlindIncrement = 10000;
    // }

    // if (level == 25) {
    //   anteIncrement = 1000;
    //   bigBlindIncrement = 20000;
    // }

    // if (level == 30) {
    //   anteIncrement = 5000;
    //   bigBlindIncrement = 50000;
    // }

    // if (level > 30) {
    //   anteIncrement *= 2;
    //   bigBlindIncrement *= 2;
    // }
    standardLevels.push({
      level: level,
      ante: ante,
      smallBlind: bigBlind / 2,
      bigBlind: bigBlind,
    });
    ante += anteIncrement;
    bigBlind += bigBlindIncrement;
  }
  return standardLevels;
}

export function getNextActiveSeat(
  data: TournamentData,
  occupiedSeats: Array<number>,
  startingSeatNo: number
) {
  let found = false;
  let seatNo = startingSeatNo;
  seatNo++;

  for (let i = 0; i <= data.maxPlayersInTable; i++) {
    if (seatNo > data.maxPlayersInTable) {
      seatNo = 1;
    }
    if (occupiedSeats[seatNo]) {
      return seatNo;
    }
    seatNo++;
  }
  return -1;
}

function getOccupiedSeats(data: TournamentData, table: Table): Array<number> {
  let occupiedSeats = new Array<number>();
  for (let seatNo = 0; seatNo <= data.maxPlayersInTable; seatNo++) {
    let found = false;
    for (const player of table.players) {
      if (player.seatNo === seatNo) {
        occupiedSeats.push(player.playerId);
        found = true;
        break;
      }
    }
    if (!found) {
      occupiedSeats.push(0);
    }
  }
  return occupiedSeats;
}