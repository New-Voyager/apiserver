import { Tournament } from '@src/entity/game/tournament';
import { errToStr, getLogger } from '@src/utils/log';
import { EntityManager, Repository } from 'typeorm';
import { Cache } from '@src/cache';
import { getGameRepository } from '.';
import { sleep, startTimerWithPayload } from '@src/timer';
import { Nats } from '@src/nats';
import { GameServerRepository } from './gameserver';
import { GameType } from '@src/entity/types';

const logger = getLogger('tournaments');
const apiCallbackHost = 'localhost:9001';

const grpc = require('@grpc/grpc-js');
var protoLoader = require('@grpc/proto-loader');
const PROTO_PATH = __dirname + '/./rpc.proto';

logger.info('Loading proto file: ' + PROTO_PATH);
interface QueueItem {
  type: string;
  payload: any;
}

/****
 * Tournament messages
 * TOURNAMENT_SCHEDULED
 *  When a tournament is scheduled, this message is sent in the tournament channel.
 * TOURNAMENT_WILL_START
 *  When the tournament starts in 5 minutes, this message is sent in the tournament channel.
 * TOURNAMENT_STARTED
 *  When the tournament is kicked off, this message is sent in the tournament channel.
 * TOURNAMENT_TABLE_READY
 *  When a table is ready and setup, this message is sent in the tournament channel.
 *  The client will getTournamentTableInfo() and QUERY_CURRENT_HAND to get the current hand info
 * TOURNAMENT_PLAYER_MOVED
 *  When a player is moved from one table to another, this message is sent in the tournament channel.
 *  The affected player will call getTournamentTableInfo() and QUERY_CURRENT_HAND to display the current hand in the table.
 * TOURNAMENT_PLAYER_LEFT
 *  When a player leaves the tournament (busted), this message is sent in the tournament channel.
 * TOURNAMENT_LEVEL_CHANGED
 *  Whne a tournament level is changed, this message is sent in the tournament channel.
 */

const options = {
  keepCase: true,
  enums: String,
  defaults: true,
  oneofs: true,
};

var packageDefinition = protoLoader.loadSync(PROTO_PATH, options);
var packageDef = grpc.loadPackageDefinition(packageDefinition);
const tableService = packageDef.rpc.TableService;

interface Table {
  tableNo: number;
  players: Array<TournamentPlayer>;
  tableServer: string;
  handNum: number;
}
export enum TournamentPlayingStatus {
  REGISTERED,
  JOINED,
  PLAYING,
  BUSTED_OUT,
  SITTING_OUT,
}

interface TournamentPlayer {
  playerId: number;
  playerName: string;
  playerUuid: string;
  stack: number;
  isSittingOut: boolean;
  isBot: boolean;
  tableNo: number;
  seatNo: number;
  status: TournamentPlayingStatus;
}

/*

type TournamentInfo {
  id: ID!
  name: String!
  startTime: DateTime!
  startingChips: Float!
  minPlayers: Int
  maxPlayers: Int
  maxPlayersInTable: Int!
  players: [TournamentPlayer!]
  tables: [TournamentTable!]
  tournamentChannel: String!
}
*/
interface TournamentData {
  id: number;
  startingChips: number;
  name: string;
  currentLevel: number; // -1 = not started
  levelTime: number;
  activePlayers: number;
  levels: Array<TournamentLevel>;
  startTime: Date;
  minPlayers: number;
  maxPlayers: number;
  maxPlayersInTable: number;
  tables: Array<Table>;
  registeredPlayers: Array<TournamentPlayer>;
  playersInTournament: Array<TournamentPlayer>;
  tableServerId: number; // all the tournament tables are on this server
}

interface TournamentLevel {
  level: number;
  smallBlind: number;
  bigBlind: number;
  ante: number;
}

interface TournamentTableInfo {
  gameCode: string;
  gameType: GameType;
  smallBlind: number;
  bigBlind: number;
  ante: number;
  players: Array<TournamentPlayer>;
  level: number;
  nextLevel: number;
  nextLevelTimeInSecs: number;
}

let gameServerRpc: any;
interface Queue {
  processing: boolean;
  items: Array<QueueItem>;
}
class TournamentRepositoryImpl {
  private initialized: boolean = false;
  private cachedEncryptionKeys: { [key: string]: string } = {};
  private currentTournamentLevel: { [key: number]: number } = {};
  private tournamentLevelData: { [key: number]: Array<TournamentLevel> } = {};
  private processQueue: { [key: number]: Queue } = {};

  public async initialize(serverHost?: string) {
    if (this.initialized) {
      return;
    }

    if (!serverHost) {
      const gameServer = await GameServerRepository.getNextGameServer();
      if (!gameServer) {
        throw new Error(`No game server is available`);
      }
      const url = new URL(gameServer.url);
      serverHost = url.host;
      serverHost = 'localhost';
    }
    const rpcPort = 9000;
    const server = `${serverHost}:${rpcPort}`;
    const client = new tableService(server, grpc.credentials.createInsecure());
    gameServerRpc = client;
    //gameServerRpc = new TableServiceClient(server, {});
  }

  public getTournamentChannel(tournamentId: number): string {
    return `tournament-${tournamentId}`;
  }

  public getTableGameCode(tournamentId: number, tableNo: number): string {
    return `t-${tournamentId}-${tableNo}`;
  }

  public getTableGameId(tournamentId: number, tableNo: number): number {
    return (tournamentId << 16) | tableNo;
  }

  public getTurboLevels(): Array<TournamentLevel> {
    let levels = new Array<TournamentLevel>();
    let smallBlind = 10;
    let anteStart = 25;
    for (let i = 1; i <= 5; i++) {
      let ante = 0;
      let bigBlind = smallBlind * 2;
      if (i <= 5) {
        ante = 0;
      } else {
        ante = (i - 5) * anteStart;
      }
      levels.push({
        level: i,
        smallBlind: smallBlind,
        bigBlind: bigBlind,
        ante: 0, // ante,
      });
      smallBlind = bigBlind;
    }
    return levels;
  }

  public async getTournamentTableInfo(
    tournamentId: number,
    tableNo: number
  ): Promise<TournamentTableInfo> {
    let ret: TournamentTableInfo = {
      gameCode: '',
      gameType: GameType.HOLDEM,
      smallBlind: 0,
      bigBlind: 0,
      ante: 0,
      players: [],
      level: 1,
      nextLevel: 2,
      nextLevelTimeInSecs: 30,
    };
    const data = await this.getTournamentData(tournamentId);
    if (!data) {
      throw new Error(`Tournament ${tournamentId} is not found`);
    }
    const table = data.tables.find(t => t.tableNo === tableNo);
    if (!table) {
      throw new Error(
        `Table ${tableNo} is not found in tournament ${tournamentId}`
      );
    }
    ret.gameCode = this.getTableGameCode(tournamentId, tableNo);
    ret.gameType = GameType.HOLDEM;
    if (data.currentLevel > 0) {
      const level = data.levels[data.currentLevel];
      ret.smallBlind = level.smallBlind;
      ret.bigBlind = level.bigBlind;
      ret.ante = level.ante;
      ret.nextLevel = level.level + 1;
    } else {
    }

    // get the players in the table
    for (const player of table.players) {
      ret.players.push({
        playerId: player.playerId,
        playerName: player.playerName,
        playerUuid: player.playerUuid,
        stack: player.stack,
        isSittingOut: false,
        seatNo: player.seatNo,
        tableNo: player.tableNo,
        isBot: player.isBot,
        status: player.status,
      });
    }
    return ret;
  }

  public async scheduleTournament(
    tournamentName: string,
    clubCode: string,
    startTime: Date,
    transactionManager?: EntityManager
  ): Promise<number> {
    try {
      const tableServer = await GameServerRepository.getNextGameServer();
      const startingChips = 5000;
      const data: TournamentData = {
        id: 0,
        name: tournamentName,
        minPlayers: 2,
        maxPlayers: 100,
        activePlayers: 0,
        maxPlayersInTable: 6,
        levelTime: 10, // seconds
        currentLevel: -1,
        levels: this.getTurboLevels(),
        tables: [],
        registeredPlayers: [],
        playersInTournament: [],
        startTime: startTime,
        startingChips: startingChips * 100,
        tableServerId: tableServer.id,
      };
      let tournamentRepo: Repository<Tournament>;
      if (transactionManager) {
        tournamentRepo = transactionManager.getRepository(Tournament);
      } else {
        tournamentRepo = getGameRepository(Tournament);
      }
      let tournament = new Tournament();
      tournament.data = JSON.stringify(data);
      tournament.maxPlayersInTable = 6;
      tournament = await tournamentRepo.save(tournament);
      data.id = tournament.id;
      tournament.data = JSON.stringify(data);
      tournament.tableServer = ''; // assign table server here
      tournament = await tournamentRepo.save(tournament);

      this.processQueue[tournament.id] = {
        processing: false,
        items: [],
      };

      // host the table in the game server
      return tournament.id;
    } catch (err) {
      logger.error('Failed to save tournament data: ${errToStr(err)}');
      throw err;
    }
  }

  public async registerTournament(playerUuid: string, tournamentId: number) {
    try {
      const player = await Cache.getPlayer(playerUuid);
      let tournamentRepo: Repository<Tournament>;
      tournamentRepo = getGameRepository(Tournament);
      const tournament = await tournamentRepo.findOne({ id: tournamentId });
      if (tournament) {
        const data = JSON.parse(tournament.data);
        const playerData = data.registeredPlayers.find(
          p => p.playerUuid === playerUuid
        );
        if (!playerData) {
          data.registeredPlayers.push({
            playerId: player.id,
            playerName: player.name,
            playerUuid: player.uuid,
            stack: data.startingStack * 100,
            isSittingOut: false,
            isBot: player.bot,
            tableNo: 0,
          });
          tournament.data = JSON.stringify(data);
          await tournamentRepo.save(tournament);
          // publish new player information to tournament channel
        }
      } else {
        throw new Error(`Tournament ${tournamentId} is not found`);
      }
    } catch (err) {
      logger.error(
        `Failed to register for tournement: ${tournamentId}: ${errToStr(err)}`
      );
      throw err;
    }
  }

  public async getTournamentData(tournamentId: number): Promise<any | null> {
    try {
      let tournamentRepo: Repository<Tournament>;
      tournamentRepo = getGameRepository(Tournament);
      const tournament = await tournamentRepo.findOne({ id: tournamentId });
      if (tournament) {
      } else {
        throw new Error(`Tournament ${tournamentId} is not found`);
      }
      return JSON.parse(tournament.data);
    } catch (err) {
      logger.error(
        `Failed to get tournement info: ${tournamentId}: ${errToStr(err)}`
      );
      throw err;
    }
  }

  private async hostTable(
    tournamentData: TournamentData,
    tableNo: number,
    tableServer: string
  ) {
    const gameServer = await GameServerRepository.getUsingId(
      tournamentData.tableServerId
    );
    // host table in this server
    await this.initialize();
    const gameCode = this.getTableGameCode(tournamentData.id, tableNo);
    const gameChannel = Nats.getGameChannel(gameCode);
    const handChannel = Nats.getHandToAllChannel(gameCode);
    const hostTablePayload = {
      tournament_id: tournamentData.id,
      game_code: gameCode,
      table_no: tableNo,
      game_channel: gameChannel,
      hand_channel: handChannel,
      result_host: apiCallbackHost,
    };
    logger.info(`Hosting table: ${JSON.stringify(hostTablePayload)}`);
    gameServerRpc.hostTable(hostTablePayload, (err, value) => {
      if (err) {
        logger.error(
          `hosting table tournament: ${tournamentData.id} table: ${tableNo} failed`
        );
      } else {
        // successfully hosted the table
        logger.info(
          `hosting table tournament: ${tournamentData.id} table: ${tableNo} succeeded`
        );
      }
    });
  }

  public async joinTournament(playerUuid: string, tournamentId: number) {
    const queue = this.processQueue[tournamentId];
    const item: QueueItem = {
      type: 'PLAYER_REG',
      payload: {
        playerUuid: playerUuid,
      },
    };

    queue.items.push(item);
    await this.processQueueItem(tournamentId).catch(err => {
      logger.error(`Failed to process queue item. ${JSON.stringify(item)}`);
    });
  }

  private async kickOffTournament(data: TournamentData) {
    if (data.activePlayers === data.registeredPlayers.length) {
      logger.info('Waiting for bot players to take the seats');
      await sleep(5000);
      // start the level timer
      logger.info('Starting the level timer');
      await this.startLevelTimer(data.id, data.levelTime);
      Nats.tournamentStarted(data.id);

      // start the first hand
      for (const table of data.tables) {
        logger.info('Run a first hand');
        this.runHand(data.id, table.tableNo).catch(err => {
          logger.error(`Running hand failed`);
        });
      }
    }
  }
  private async processQueueItem(tournamentId: number) {
    const queue = this.processQueue[tournamentId];
    if (queue.processing) {
      return;
    }
    queue.processing = true;
    try {
      const item = queue.items.shift();
      if (item) {
        if (item.type === 'PLAYER_REG') {
          await this.joinTournamentQueueItem(
            item.payload.playerUuid,
            tournamentId
          );
        } else if (item.type === 'HAND_RESULT') {
          await this.saveTournamentHandInternal(
            tournamentId,
            item.payload.tableNo,
            item.payload.result
          );
        }
      }
    } catch (err) {
      logger.error(`Processing item from queue failed ${errToStr(err)}`);
    }
    queue.processing = false;
    if (this.processQueue[tournamentId].items.length > 0) {
      // proces the next item in the queue
      await this.processQueueItem(tournamentId);
    }
  }

  public async joinTournamentQueueItem(
    playerUuid: string,
    tournamentId: number
  ) {
    try {
      logger.info(
        `Joining tournament: ${tournamentId} playerUuid: ${playerUuid}`
      );
      let tournamentRepo: Repository<Tournament>;
      tournamentRepo = getGameRepository(Tournament);
      const tournament = await tournamentRepo.findOne({ id: tournamentId });
      if (tournament) {
      } else {
        throw new Error(`Tournament ${tournamentId} is not found`);
      }
      const player = await Cache.getPlayer(playerUuid);

      const data = JSON.parse(tournament.data) as TournamentData;

      // assign the player to a table
      let table = data.tables.find(
        t => t.players.length < tournament.maxPlayersInTable
      );
      if (!table) {
        // add a new table and sit the player there
        table = {
          tableNo: data.tables.length + 1,
          players: [],
          handNum: 1,
          tableServer: '', // set the table server here
        };
        // host the table in the game server
        this.hostTable(data, table.tableNo, table.tableServer);
        data.tables.push(table);
      }
      let seatPlayer: TournamentPlayer = {
        playerId: player.id,
        playerName: player.name,
        playerUuid: player.uuid,
        stack: data.startingChips,
        isSittingOut: false,
        isBot: player.bot,
        tableNo: table.tableNo,
        seatNo: table.players.length + 1,
        status: TournamentPlayingStatus.PLAYING,
      };
      table.players.push(seatPlayer);
      data.activePlayers += 1;

      // set the table number for the player
      const playerData = data.registeredPlayers.find(
        p => p.playerUuid === playerUuid
      );
      if (playerData) {
        playerData.tableNo = table.tableNo;
      }

      tournament.data = JSON.stringify(data);
      await tournamentRepo.save(tournament);
      const gameCode = `t${tournamentId}-${table.tableNo}`;
      // publish that the player has joined to tournament channel, send the table info
      Nats.playerJoinedTournament(
        tournamentId,
        gameCode,
        seatPlayer.tableNo,
        player
      );

      Nats.tournamentSetPlayerTable(
        tournamentId,
        player.id,
        player.uuid,
        seatPlayer.tableNo,
        seatPlayer.seatNo
      );

      await this.kickOffTournament(data);
    } catch (err) {
      logger.error(
        `Failed to get tournement info: ${tournamentId}: ${errToStr(err)}`
      );
      throw err;
    }
  }

  private async runHand(tournamentId: number, tableNo: number) {
    const data: TournamentData = await this.getTournamentData(tournamentId);
    if (!data) {
      throw new Error(`Tournament ${tournamentId} is not found`);
    }

    let table: Table | undefined;
    table = data.tables.find(t => t.tableNo === tableNo);
    if (!table) {
      throw new Error(
        `Table ${tableNo} is not found in tournament ${tournamentId}`
      );
    }

    /*
        uint32 seat_no = 1;
        string player_uuid = 2;
        uint64 player_id = 3;
        double stack = 4;
        bool inhand = 5;
        string encryption_key = 6;
        bool open_seat = 7;
        string name = 8;
    */
    const seats = new Array<any>();
    let openSeat: any = {
      seat_no: 0,
      player_uuid: '',
      player_id: 0,
      stack: 0,
      inhand: false,
      name: '',
      open_seat: true,
      encryption_key: '',
    };
    for (let seatNo = 0; seatNo <= data.maxPlayersInTable; seatNo++) {
      openSeat.seat_no = seatNo;
      seats.push(openSeat);
    }
    for (const player of table.players) {
      let encryptionKey = this.cachedEncryptionKeys[player.playerUuid];
      if (!encryptionKey) {
        const cachedPlayer = await Cache.getPlayer(player.playerUuid);
        encryptionKey = cachedPlayer.encryptionKey;
        this.cachedEncryptionKeys[player.playerUuid] = encryptionKey;
      }

      let seat: any = {
        seat_no: player.seatNo,
        player_uuid: player.playerUuid,
        player_id: player.playerId,
        stack: player.stack,
        inhand: true,
        name: player.playerName,
        open_seat: false,
        encryption_key: encryptionKey,
      };
      seats[player.seatNo] = seat;
    }

    /*
      message HandDetails {
          uint32 button_pos = 1;
          uint32 sb_pos = 2;
          uint32 bb_pos = 3;
          double sb = 4;
          double bb = 5;
          double ante = 6;
          bool bomb_pot = 7;
          double bomb_pot_bet = 8;
          uint32 game_type = 9;
          uint32 hand_num = 10;
          uint32 result_pause_time = 11;
          uint32 max_players = 12;
          uint32 action_time = 13;
      }
    */
    let sb = 10;
    let bb = 20;
    let ante = 0;
    // get current level from memory
    let currentLevel = this.currentTournamentLevel[tournamentId];
    if (!currentLevel) {
      currentLevel = data.currentLevel;
      this.currentTournamentLevel[tournamentId] = currentLevel;
    }

    let level: any;
    for (let i = 0; i < data.levels.length; i++) {
      level = data.levels[i];
      if (level.level === currentLevel) {
        sb = level.smallBlind;
        bb = level.bigBlind;
        ante = level.ante;
        break;
      }
    }

    let handDetails: any = {
      button_pos: 1,
      sb_pos: 2,
      bb_pos: 3,
      sb: sb * 100,
      bb: bb * 100,
      ante: ante * 100,
      game_type: GameType.HOLDEM,
      hand_num: table.handNum,
      result_pause_time: 3,
      max_players: 6,
      action_time: 15,
    };

    // based on the number of players set up sb and bb
    const numPlayers = table.players.length;
    if (numPlayers <= 2) {
      // only two players left, button is big blind
      handDetails.button_pos = table.players[0].seatNo;
      handDetails.sb_pos = handDetails.button_pos;
      handDetails.bb_pos = table.players[1].seatNo;
    } else {
      handDetails.button_pos = table.players[0].seatNo;
      handDetails.sb_pos = table.players[1].seatNo;
      handDetails.bb_pos = table.players[2].seatNo;
    }

    /*
      message HandInfo {
        uint32 tournament_id = 1;     // 0: cash game, non-zero for tournament
        uint32 table_no = 2;          // 0: cash game
        string game_code = 3;
        uint64 game_id = 4;
        repeated Seat seats = 5;
        HandDetails hand_details = 6;
      } 
    */
    let handInfo: any = {
      tournament_id: tournamentId,
      table_no: table.tableNo,
      game_code: TournamentRepository.getTableGameCode(tournamentId, tableNo),
      game_id: TournamentRepository.getTableGameId(tournamentId, tableNo),
      seats: seats,
      hand_details: handDetails,
    };

    gameServerRpc.runHand(handInfo, (err, value) => {
      if (err) {
        logger.error(
          `Running hand on tournament: ${tournamentId} table: ${tableNo} failed`
        );
      } else {
        // successfully hosted the table
        logger.info(
          `Running hand on tournament: ${tournamentId} table: ${tableNo} succeeded`
        );
      }
    });
  }

  public async seatBotsInTournament(tournamentId: number, botCount: number) {
    try {
      // call bot-runner to register bots to the system and let them register for the tournament
      // now bots are listening on tournament channel
    } catch (err) { }
  }

  public async startTournament(tournamentId: number) {
    try {
      // bots will join the tournament here
      let tournamentRepo: Repository<Tournament>;
      tournamentRepo = getGameRepository(Tournament);
      let tournament = await tournamentRepo.findOne({ id: tournamentId });
      if (tournament) {
      } else {
        throw new Error(`Tournament ${tournamentId} is not found`);
      }
      let data = JSON.parse(tournament.data) as TournamentData;
      data.tables = [];
      data.playersInTournament = [];
      tournament.data = JSON.stringify(data);
      await tournamentRepo.save(tournament);

      for (const registeredPlayer of data.registeredPlayers) {
        if (registeredPlayer.isBot) {
          // call bot-runner to start the bot
          await this.joinTournament(registeredPlayer.playerUuid, tournamentId);
        }
      }

      // get data again from the db
      tournament = await tournamentRepo.findOne({ id: tournamentId });
      if (!tournament) {
        throw new Error(`Tournament ${tournamentId} is not found`);
      }
      data = JSON.parse(tournament.data) as TournamentData;
      data.currentLevel = 1;
      tournament.data = JSON.stringify(data);
      this.currentTournamentLevel[tournamentId] = 1;
      this.tournamentLevelData[tournamentId] = data.levels;
      await tournamentRepo.save(tournament);

      // bots should play the first hand
    } catch (err) { }
  }

  private async startLevelTimer(tournamentId: number, timeOutSecs: number) {
    const nextTimeOut = new Date();
    nextTimeOut.setSeconds(nextTimeOut.getSeconds() + timeOutSecs);
    startTimerWithPayload(
      {
        tournamentId: tournamentId,
        purpose: 'LEVEL_TIMEOUT',
      },
      nextTimeOut
    ).catch(err => {
      logger.error(
        `Failed to start timer for level timeout ${tournamentId} ${err}`
      );
    });
  }

  public async handleLevelTimeout(payload: any) {
    try {
      const tournamentId = payload.tournamentId;
      let tournamentRepo: Repository<Tournament>;
      tournamentRepo = getGameRepository(Tournament);
      let tournament = await tournamentRepo.findOne({ id: tournamentId });
      if (tournament) {
      } else {
        throw new Error(`Tournament ${tournamentId} is not found`);
      }
      let data = JSON.parse(tournament.data) as TournamentData;

      // continue only if there are players in the tournament
      if (data.tables[0].players.length > 1) {
        let currentLevelNo = this.currentTournamentLevel[tournamentId];
        if (currentLevelNo < this.tournamentLevelData[tournamentId].length) {
          let currentLevel: TournamentLevel =
            this.tournamentLevelData[tournamentId][currentLevelNo];
          let levels: Array<TournamentLevel> =
            this.tournamentLevelData[tournamentId];
          currentLevelNo++;
          for (let i = 0; i < levels.length; i++) {
            let level = levels[i];
            if (level.level === currentLevelNo) {
              currentLevel = level;
              logger.info(
                `******* Starting next level sb: ${level.smallBlind} bb: ${level.bigBlind} ante: ${level.ante} *******`
              );
              break;
            }
          }
          this.currentTournamentLevel[tournamentId] = currentLevel.level;

          // kick off the next level
          await this.startLevelTimer(tournamentId, data.levelTime);
        }
      }

      // send a NATS notification here
    } catch (err) {
      logger.error(
        `Failed to handle for level timeout ${payload.tournamentId} ${err}`
      );
    }
  }
  public async saveTournamentHand(
    tournamentId: number,
    tableNo: number,
    result: any
  ) {
    const queue = this.processQueue[tournamentId];
    const item: QueueItem = {
      type: 'HAND_RESULT',
      payload: {
        tableNo: tableNo,
        result: result,
      },
    };

    queue.items.push(item);
    this.processQueueItem(tournamentId).catch(err => {
      logger.error(`Failed to process queue item. ${JSON.stringify(item)}`);
    });
  }

  public async saveTournamentHandInternal(
    tournamentId: number,
    tableNo: number,
    result: any
  ) {
    try {
      // logger.info(
      //   `Result from Tournament: ${tournamentId} tableNo: ${tableNo}`
      // );

      // log interested result
      const players = result.result.playerInfo;
      let playerStack = '';
      for (const seatNo of Object.keys(players)) {
        const player = players[seatNo];
        const playerId = parseInt(player.id);
        playerStack = `${playerStack} ${playerId} [${player.balance.before} -> ${player.balance.after}]`;
        if (player.balance.after <= 0) {
          logger.info(
            `Player ${playerId} is out of tournament. Balance: ${player.balance.after} before: ${player.balance.before}`
          );
        }
      }
      logger.info(`${playerStack}`);
      let tournamentRepo: Repository<Tournament>;
      tournamentRepo = getGameRepository(Tournament);
      let tournament = await tournamentRepo.findOne({ id: tournamentId });
      if (tournament) {
      } else {
        throw new Error(`Tournament ${tournamentId} is not found`);
      }
      let data = JSON.parse(tournament.data) as TournamentData;
      let table = data.tables.find(t => t.tableNo === tableNo);
      if (!table) {
        throw new Error(
          `Table ${tableNo} is not found in tournament ${tournamentId}`
        );
      }
      const updatedTable = new Array<TournamentPlayer>();
      // remove the players who had lost all the stacks
      for (const seatNo of Object.keys(players)) {
        const player = players[seatNo];
        const playerId = parseInt(player.id);
        for (const playerInTable of table.players) {
          if (playerInTable.playerId === playerId) {
            if (player.balance.after === 0) {
              // remove the player from the table
              logger.info(
                `Tournament: ${tournamentId} tableNo: ${tableNo} Player: ${playerInTable.playerName} is busted`
              );
            } else {
              playerInTable.stack = player.balance.after;
              updatedTable.push(playerInTable);
            }
          }
        }
      }
      table.players = updatedTable;
      table.handNum = table.handNum + 1;
      tournament.data = JSON.stringify(data);
      tournament = await tournamentRepo.save(tournament);

      // start tournament level timer

      if (updatedTable.length > 1) {
        // run the next hand
        await this.runHand(tournamentId, table.tableNo);
      } else {
        logger.info(
          `Tournament: ${tournamentId} tableNo: ${tableNo} Player: ${updatedTable[0].playerName} is the winner.`
        );
      }
    } catch (err) { }
  }
}

export const TournamentRepository = new TournamentRepositoryImpl();
