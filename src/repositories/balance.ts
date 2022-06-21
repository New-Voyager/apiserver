import {GameType} from '@src/entity/types';
import {errToStr, getLogger} from '@src/utils/log';

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
        currentTablePlayers,
        playersPerTable,
        data,
        currentTableNo,
        currentTable
      );
      let playerNames = new Array<string>();
      for (const player of playersBeingMoved) {
        if (player) {
          playerNames.push(`${player.playerName}:${player.playerId}`);
        }
      }
      logger.info(`Players being moved: ${playerNames.join(',')}`);

      // move players to other tables
      movedPlayers = movePlayers(
        data.tables,
        currentTableNo,
        playersPerTable,
        data.maxPlayersInTable,
        playersBeingMoved
      );

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
  currentTablePlayers: TournamentPlayer[],
  playersPerTable: number,
  data: TournamentData,
  currentTableNo: number,
  currentTable: Table
): Array<TournamentPlayer | undefined> {
  let playersBeingMoved = new Array<TournamentPlayer | undefined>();
  let playersToMove = 0;
  if (currentTablePlayers.length > playersPerTable) {
    // we may need to move some players to other tables
    playersToMove = currentTablePlayers.length - playersPerTable;
  } else {
    // can you move all the players to other tables
    let availableOpenSeats = 0;
    for (const table of data.tables) {
      // skip inactive tables
      if (!table.isActive) {
        continue;
      }
      if (table.tableNo !== currentTableNo) {
        availableOpenSeats += data.maxPlayersInTable - table.players.length;
      }
    }

    if (availableOpenSeats >= currentTablePlayers.length) {
      logger.info(`Table: ${currentTableNo} can be removed`);
      // all the players can be moved to other tables
      playersToMove = currentTablePlayers.length;
    }
  }

  // move the players to other tables
  while (playersToMove > 0) {
    playersToMove--;
    playersBeingMoved.push(currentTablePlayers.pop());
  }
  // these players are staying
  currentTable.players = currentTablePlayers;
  return playersBeingMoved;
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

function movePlayers(
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
  let bigBlind = 500;
  let bigBlindIncrement = 10;
  let ante = 0;
  let anteIncrement = 10;
  for (let level = 1; level <= 80; level++) {
    if (level == 5) {
      ante = 5;
      anteIncrement = 5;
      bigBlindIncrement = 20;
    }

    if (level == 7) {
      anteIncrement = 10;
      bigBlindIncrement = 25;
    }

    if (level == 10) {
      anteIncrement = 20;
      bigBlindIncrement = 50;
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
