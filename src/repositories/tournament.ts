import {Tournament} from '@src/entity/game/tournament';
import {errToStr, getLogger} from '@src/utils/log';
import {DataTypeNotSupportedError, EntityManager, Repository} from 'typeorm';
import {Cache} from '@src/cache';
import {getGameRepository} from '.';
import {sleep, startTimerWithPayload} from '@src/timer';
import {Nats} from '@src/nats';
import {GameServerRepository} from './gameserver';
import {GameType} from '@src/entity/types';

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

interface TableMove {
  newTableNo: number;
  oldTableNo: number;
  playerId: number;
  playerUuid: string;
  playerName: string;
  stack: number;
  seatNo: number;
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
  isActive: boolean;
  chipsOnTheTable: number;
  paused: boolean; // table may be paused if there are not enough players
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
  timesMoved: 0;
  stackBeforeHand: number;
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
export interface TournamentData {
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
  balanced: boolean;
  totalChips: number;
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
  chipsOnTheTable: number;
}

let gameServerRpc: any;
interface Queue {
  processing: boolean;
  items: Array<QueueItem>;
}
class TournamentRepositoryImpl {
  private initialized: boolean = false;
  private cachedEncryptionKeys: {[key: string]: string} = {};
  private currentTournamentLevel: {[key: number]: number} = {};
  private currentTournamentLevelStartedAt: {[key: number]: Date} = {};
  private tournamentLevelData: {[key: number]: Array<TournamentLevel>} = {};
  private processQueue: {[key: number]: Queue} = {};

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
      serverHost = url.hostname;
    }
    const rpcPort = 9000;
    const server = `${serverHost}:${rpcPort}`;
    const client = new tableService(server, grpc.credentials.createInsecure());
    logger.info(`Game server GRPC URL: ${server}`);
    gameServerRpc = client;
    //gameServerRpc = new TableServiceClient(server, {});
    this.initialized = true;
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
    let smallBlind = 200;
    let anteStart = 200;
    for (let i = 1; i <= 20; i++) {
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
        ante: ante,
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
      chipsOnTheTable: 0,
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

    let chipsOnTheTable = 0;
    // get the players in the table
    for (const player of table.players) {
      chipsOnTheTable += player.stack;
      ret.players.push({
        playerId: player.playerId,
        playerName: player.playerName,
        playerUuid: player.playerUuid,
        stack: player.stack,
        isSittingOut: player.isSittingOut,
        seatNo: player.seatNo,
        tableNo: player.tableNo,
        isBot: player.isBot,
        status: player.status,
        timesMoved: player.timesMoved,
        stackBeforeHand: player.stack,
      });
    }
    ret.chipsOnTheTable = chipsOnTheTable;
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
      const startingChips = 1000;
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
        balanced: true,
        totalChips: 0,
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
      await Cache.getTournamentData(tournament.id, true);

      data.id = tournament.id;
      tournament.data = JSON.stringify(data);
      tournament.tableServer = ''; // assign table server here
      tournament = await tournamentRepo.save(tournament);
      await Cache.getTournamentData(tournament.id, true);

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
      const tournament = await tournamentRepo.findOne({id: tournamentId});
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
          await Cache.getTournamentData(tournament.id, true);
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
      const data = Cache.getTournamentData(tournamentId);
      return data;
      // let tournamentRepo: Repository<Tournament>;
      // tournamentRepo = getGameRepository(Tournament);
      // const tournament = await tournamentRepo.findOne({ id: tournamentId });
      // if (tournament) {
      // } else {
      //   throw new Error(`Tournament ${tournamentId} is not found`);
      // }
      // return JSON.parse(tournament.data);
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
          logger.error(
            `Running hand failed table ${table.tableNo} err: ${errToStr(err)}`
          );
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
      const tournament = await tournamentRepo.findOne({id: tournamentId});
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
          tableServer: '',
          isActive: true, // set the table server here
          chipsOnTheTable: 0,
          paused: false,
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
        timesMoved: 0,
        stackBeforeHand: data.startingChips,
      };
      data.totalChips += data.startingChips;
      table.players.push(seatPlayer);
      let chipsOnTheTable = 0;
      for (const player of table.players) {
        chipsOnTheTable += player.stack;
      }
      table.chipsOnTheTable = chipsOnTheTable;

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
      await Cache.getTournamentData(tournament.id, true);

      const gameCode = `t-${tournamentId}-${table.tableNo}`;
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
      tournament_url: process.env['TOURNAMENT_URL'],
      tournament_id: tournamentId,
      table_no: table.tableNo,
      game_code: TournamentRepository.getTableGameCode(tournamentId, tableNo),
      game_id: TournamentRepository.getTableGameId(tournamentId, tableNo),
      seats: seats,
      hand_details: handDetails,
    };
    // logger.info(`1 Running hand num: ${table.handNum} table: ${tableNo}`);
    if (table.handNum === 1) {
      // send level changed information
      let currentLevelNo = this.currentTournamentLevel[tournamentId];
      let nextLevelNo = this.currentTournamentLevel[tournamentId] + 1;
      let currentLevel: any;
      let nextLevel: any;

      for (let i = 0; i < data.levels.length; i++) {
        level = data.levels[i];
        if (level.level === currentLevelNo) {
          currentLevel = level;
        }
        if (level.level === nextLevelNo) {
          nextLevel = level;
        }
      }
      this.currentTournamentLevelStartedAt[tournamentId] = new Date();
      //Nats.tournamentLevelChanged(tournamentId, currentLevel, nextLevel, data.levelTime);
    }
    // logger.info(`2 Running hand num: ${table.handNum} table: ${tableNo}`);
    gameServerRpc.runHand(handInfo, (err, value) => {
      if (err) {
        // logger.error(
        //   `Running hand on tournament: ${tournamentId} table: ${tableNo} failed. Error: ${errToStr(
        //     err
        //   )}`
        // );
      } else {
        // successfully hosted the table
        logger.info(
          `Running hand on tournament: ${tournamentId} table: ${tableNo} succeeded`
        );
      }
    });
  }

  private printTournamentStats(data: TournamentData) {
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
    if (totalChipsOnTheTournament !== data.totalChips) {
      logger.info(
        `ALERT: Total chips: ${data.totalChips} total chips in the tournament now: ${totalChipsOnTheTournament} Missing chips`
      );
    }

    totalChipsOnTheTournament = 0;
    for (const table of data.tables) {
      for (const player of table.players) {
        totalChipsOnTheTournament += player.stack;
      }
    }
    logger.info(
      `============================  Tournament stats: ${data.id} Balanced: ${data.balanced} ============================`
    );
    logger.info(
      `Active tables: ${activeTables} totalActivePlayers: ${totalActivePlayers} Total chips: ${data.totalChips} total chips on the tournament: ${totalChipsOnTheTournament}`
    );
    for (const table of data.tables) {
      if (!table.isActive) {
        continue;
      }
      let playersStack = '';

      for (const player of table.players) {
        playersStack =
          playersStack +
          ` ${player.playerName}:${player.playerId} ${player.stack}`;
      }

      logger.info(
        `[Table: ${table.tableNo}] Players count: ${table.players.length} isActive: ${table.isActive}, Paused: ${table.paused} ${playersStack}`
      );
    }
    logger.info(
      `========================================================================`
    );
  }

  public async startTournament(tournamentId: number) {
    try {
      // bots will join the tournament here
      let tournamentRepo: Repository<Tournament>;
      tournamentRepo = getGameRepository(Tournament);
      let tournament = await tournamentRepo.findOne({id: tournamentId});
      if (tournament) {
      } else {
        throw new Error(`Tournament ${tournamentId} is not found`);
      }
      let data = JSON.parse(tournament.data) as TournamentData;
      data.tables = [];
      data.playersInTournament = [];
      tournament.data = JSON.stringify(data);
      await tournamentRepo.save(tournament);
      await Cache.getTournamentData(tournamentId, true);

      for (const registeredPlayer of data.registeredPlayers) {
        if (registeredPlayer.isBot) {
          // call bot-runner to start the bot
          await this.joinTournament(registeredPlayer.playerUuid, tournamentId);
        }
      }

      // get data again from the db
      tournament = await tournamentRepo.findOne({id: tournamentId});
      if (!tournament) {
        throw new Error(`Tournament ${tournamentId} is not found`);
      }
      data = JSON.parse(tournament.data) as TournamentData;
      data.currentLevel = 1;
      tournament.data = JSON.stringify(data);
      this.currentTournamentLevel[tournamentId] = 1;
      this.tournamentLevelData[tournamentId] = data.levels;
      await tournamentRepo.save(tournament);
      await Cache.getTournamentData(tournamentId, true);

      // bots should play the first hand
    } catch (err) {
      logger.error(
        `Could not start tournament. tournamentId: ${tournamentId}, err: ${errToStr(
          err
        )}`
      );
    }
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
        `Failed to start timer for level timeout ${tournamentId} err: ${errToStr(
          err
        )}`
      );
    });
  }

  public async handleLevelTimeout(payload: any) {
    try {
      const tournamentId = payload.tournamentId;
      let tournamentRepo: Repository<Tournament>;
      tournamentRepo = getGameRepository(Tournament);
      let tournament = await tournamentRepo.findOne({id: tournamentId});
      if (tournament) {
      } else {
        throw new Error(`Tournament ${tournamentId} is not found`);
      }
      let data = JSON.parse(tournament.data) as TournamentData;

      // continue only if there are players in the tournament
      if (data.tables[0].players.length > 1) {
        let prevLevelNo = this.currentTournamentLevel[tournamentId];
        if (prevLevelNo < this.tournamentLevelData[tournamentId].length) {
          let prevLevel: TournamentLevel =
            this.tournamentLevelData[tournamentId][prevLevelNo];
          let levels: Array<TournamentLevel> =
            this.tournamentLevelData[tournamentId];
          let currentLevel: any;
          let currentLevelNo = prevLevelNo + 1;
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
          if (
            currentLevel.level !== this.currentTournamentLevel[tournamentId]
          ) {
            // level changed
            this.currentTournamentLevel[tournamentId] = currentLevel.level;
            let nextLevel;
            if (currentLevelNo < levels.length + 1) {
              nextLevel = levels[currentLevelNo + 1];
            }
            this.currentTournamentLevelStartedAt[tournamentId] = new Date();
            Nats.tournamentLevelChanged(
              tournamentId,
              currentLevel,
              nextLevel,
              data.levelTime
            );
          }

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
    let data: TournamentData | null = null;
    try {
      // logger.info(
      //   `Result from Tournament: ${tournamentId} tableNo: ${tableNo}`
      // );
      logger.info(
        `====================================== Tournament: ${tournamentId} TableNo: ${tableNo} Save Hand ======================================`
      );

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
      // logger.info(`${tournamentId}:${tableNo} ${playerStack}`);
      const tournamentRepo: Repository<Tournament> =
        getGameRepository(Tournament);
      let tournament = await tournamentRepo.findOne({id: tournamentId});
      if (tournament) {
      } else {
        throw new Error(`Tournament ${tournamentId} is not found`);
      }
      data = JSON.parse(tournament.data) as TournamentData;
      let table = data.tables.find(t => t.tableNo === tableNo);
      if (!table) {
        throw new Error(
          `Table ${tableNo} is not found in tournament ${tournamentId}`
        );
      }

      let updatedTable = new Array<TournamentPlayer>();

      let playersStack = '';
      for (const player of table.players) {
        playersStack =
          playersStack +
          ` ${player.playerId}: [${player.stackBeforeHand}->${player.stack}]`;
      }

      let bustedPlayers = new Array<TournamentPlayer>();
      // remove the players who had lost all the stacks from the result
      for (const seatNo of Object.keys(players)) {
        const player = players[seatNo];
        const playerId = parseInt(player.id);
        for (const playerInTable of table.players) {
          if (playerInTable.playerId === playerId) {
            playerInTable.stack = player.balance.after;
            playerInTable.stackBeforeHand = playerInTable.stack;
            if (playerInTable.stack === 0) {
              // remove the player from the table
              logger.info(
                `Tournament: ${tournamentId} tableNo: ${tableNo} Player: ${playerInTable.playerName} is busted`
              );
              bustedPlayers.push(playerInTable);
            } else {
              updatedTable.push(playerInTable);
            }
            break;
          }
        }
      }
      const anyPlayerBusted = bustedPlayers.length > 0;

      let bustedPlayerIds = bustedPlayers.map(e => e.playerId);
      if (bustedPlayerIds.length > 0) {
        updatedTable = [];
        logger.info(`Before removing busted players`);
        // print tournament stats before removing busted players
        // this.printTournamentStats(data);

        // skip busted players
        for (const player of table.players) {
          if (bustedPlayerIds.indexOf(player.playerId) === -1) {
            updatedTable.push(player);
          }
        }
        table.players = updatedTable;
        logger.info(`After removing busted players ${bustedPlayerIds}`);
        // this.printTournamentStats(data);
      }

      table.handNum = table.handNum + 1;
      let chipsOnTheTable = 0;
      for (const player of table.players) {
        chipsOnTheTable += player.stack;
      }
      table.chipsOnTheTable = chipsOnTheTable;

      // start tournament level timer
      if (anyPlayerBusted) {
        data.balanced = false;
      }
      let tournamentData: TournamentData | null = data;
      let movedPlayers: Array<TableMove> = [];
      if (!data.balanced) {
        this.printTournamentStats(data);
        // balance the table
        [tournamentData, movedPlayers] = await this.balanceTable(
          data,
          table.tableNo
        );
        this.printTournamentStats(data);
      } else {
        // this.printTournamentStats(data);
      }

      let resumeTables = new Array<number>();
      if (tournamentData) {
        table = tournamentData.tables.find(t => t.tableNo === tableNo);
        if (table) {
          if (table.players.length === 1) {
            // this player should be moved to another table or players from other table should move here
            table.paused = true;
          }
        }
        // resume other paused tables if they have enough players
        for (const table of data.tables) {
          if (table.paused) {
            if (table.isActive) {
              if (table.players.length >= 2) {
                // resume table
                table.paused = false;
                resumeTables.push(table.tableNo);
              }
            }
          }
        }
      }
      tournament.data = JSON.stringify(tournamentData);
      tournament = await tournamentRepo.save(tournament);
      await Cache.getTournamentData(tournamentId, true);
      data = tournamentData;

      // there is a race condition here, the player may move to another table before subscribing to the messages
      // send NATS message to moved players
      for (const player of movedPlayers) {
        Nats.tournamentPlayerMoved(
          tournamentId,
          player.oldTableNo,
          player.newTableNo,
          player.playerId,
          player.playerName,
          player.playerUuid,
          player.stack,
          player.seatNo
        );
      }

      // if we need to resume some of the paused tables, do now
      /*
        If some tables were paused due to not enough players, then we may have moved players from another table to the paused table. We need to resume the tables again
        Let us say there are 5 players in table 3, every went all-in and only one survived
        this table has only one player. The other tables are full, so we cannot move this player anywhere
        When the next table (table 1) save hand arrives, we will move players from that table to table 3 and resume
      */
      if (resumeTables.length > 0) {
        for (const tableNo of resumeTables) {
          logger.info(`Resuming table: ${tableNo}`);
          await this.runHand(tournamentId, tableNo);
        }
      }

      table = tournamentData.tables.find(t => t.tableNo === tableNo);
      if (table) {
        if (table.players.length > 1) {
          // run the next hand
          await this.runHand(tournamentId, table.tableNo);
        } else {
          logger.info(
            `Tournament: ${tournamentId} tableNo: ${tableNo} Player: ${updatedTable[0].playerName} is the winner Stack: ${updatedTable[0].stack}.`
          );
        }
      }
    } catch (err) {
      logger.error(
        `Error saving tournament hand tournament ${tournamentId} table ${tableNo} result ${JSON.stringify(
          result
        )} err ${errToStr(err)}`
      );
    } finally {
      let totalChipsOnTheTournament = 0;
      let activeTables = 0;
      let totalActivePlayers = 0;
      let currentLevel: TournamentLevel | undefined;
      if (data) {
        for (const table of data.tables) {
          for (const player of table.players) {
            totalChipsOnTheTournament += player.stack;
          }
        }
        // get active tables
        for (const table of data.tables) {
          if (table.isActive) {
            activeTables++;
          }
        }
        // get total active players
        for (const table of data.tables) {
          totalActivePlayers += table.players.length;
        }
        let currentLevelNo = this.currentTournamentLevel[tournamentId];
        currentLevel = data.levels.find(l => l.level === currentLevelNo);
      }

      // id:, table: activeTables: [], balanced:, totalChips: totalChipsInTournament:, remainingPlayers:, currentLevel:, sb, bb, ante
      logger.info(
        `======== Tournament: ${tournamentId} Current TableNo: ${tableNo} Save Hand done `
      );
      // if final table print stats
      if (activeTables === 1) {
        if (data) {
          this.printTournamentStats(data);
        }
      }

      logger.info(
        `======== Tournament: ${tournamentId} Active Players: ${totalActivePlayers} ActiveTables: ${activeTables} Balanced: ${data?.balanced} Expected Chips: ${data?.totalChips} Chips: ${totalChipsOnTheTournament} Blinds: ${currentLevel?.smallBlind}/${currentLevel?.bigBlind} (${currentLevel?.ante})========`
      );

      // if we have only one table and one player and it is paused
      // we have a winner
      if (data) {
        if (activeTables === 1 && totalActivePlayers === 1) {
          // get total active players
          for (const table of data.tables) {
            if (table.isActive) {
              const winner = table.players[0];
              logger.info(
                `*********** Tournament: ${tournamentId} Winner: ${winner.playerName} ${winner.stack} ***********`
              );
              break;
            }
          }
        }
      }
    }
  }

  private balanceTable(
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
        let playersBeingMoved = this.determinePlayersToMove(
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
        movedPlayers = this.movePlayers(
          tournamentId,
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

  private determinePlayersToMove(
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

  private tablesWithSeats(
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

  private movePlayers(
    tournamentId: number,
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
        const tablesWithSeats = this.tablesWithSeats(
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

                // player is moved
                ret.push({
                  playerId: player.playerId,
                  newTableNo: table.tableNo,
                  seatNo: seatNo,
                  oldTableNo: currentTableNo,
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
}

export const TournamentRepository = new TournamentRepositoryImpl();
