import {Tournament} from '@src/entity/game/tournament';
import {errToStr, getLogger} from '@src/utils/log';
import {EntityManager, Repository} from 'typeorm';
import {Cache} from '@src/cache';
import {getGameRepository} from '.';
import {sleep, startTimerWithPayload} from '@src/timer';
import {Nats} from '@src/nats';
import {GameServerRepository} from './gameserver';
import {GameType} from '@src/entity/types';
import {
  balanceTable,
  getLevelData,
  Table,
  TableMove,
  TournamentData,
  TournamentLevel,
  TournamentLevelType,
  TournamentListItem,
  TournamentPlayer,
  TournamentPlayerRank,
  TournamentPlayingStatus,
  TournamentStatus,
  TournamentTableInfo,
} from './balance';
import _ from 'lodash';
import {endBotTournament, registerBotsTournament} from '@src/botrunner';

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

const options = {
  keepCase: true,
  enums: String,
  defaults: true,
  oneofs: true,
};

var packageDefinition = protoLoader.loadSync(PROTO_PATH, options);
var packageDef = grpc.loadPackageDefinition(packageDefinition);
const tableService = packageDef.rpc.TableService;

/*

Tournament Name
Description
Structure
    Standard
    Turbo
    Deep Stack
Players Per Table
Max Rebuys
Level Timeout
*/

// # bots should unsubscribe and leave the tournament
// # tournament status (SCHEDULED, RUNNING, ENDED)
// # tournament result (ranks)
// # tournament stats (player: rank, busted_order, how many hands played, how many times moved, duration, chipsBeforeBusted, largestStack, lowStack)
// # busted_order: 1, 2, 3 as the player goes out of the tournament
// # rank order: active players are ranked by their chips, busted players are ranked by reverse busted_order

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

  public getPrivateChannel(tournamentId: number, playerId: number): string {
    return `tournament.${tournamentId}.player.${playerId}`;
  }

  public getTableGameCode(tournamentId: number, tableNo: number): string {
    return `t-${tournamentId}-${tableNo}`;
  }

  public getTableGameId(tournamentId: number, tableNo: number): number {
    return (tournamentId << 16) | tableNo;
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
      nextLevelTimeInSecs: 10,
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
        stackBeforeBusted: player.stack,
        handsPlayed: 0,
        duration: 0,
        largestStack: 0,
        lowStack: 0,
        bustedOrder: -1,
        startTime: new Date(Date.now()),
        bustedLevel: 0,
        bustedTime: null,
      });
    }
    ret.chipsOnTheTable = chipsOnTheTable;
    return ret;
  }

  public async scheduleTournament(
    input: any,
    transactionManager?: EntityManager
  ): Promise<number> {
    try {
      const tableServer = await GameServerRepository.getNextGameServer();
      const startingChips = 1000;
      let levelTime = 30;
      if (input.levelTime) {
        levelTime = input.levelTime;
      }
      const data: TournamentData = {
        id: 0,
        name: input.name,
        minPlayers: input.minPlayers,
        maxPlayers: input.maxPlayers,
        activePlayers: 0,
        maxPlayersInTable: input.maxPlayersInTable,
        levelTime: levelTime, // seconds
        currentLevel: -1,
        levels: getLevelData(TournamentLevelType.STANDARD),
        tables: [],
        registeredPlayers: [],
        playersInTournament: [],
        bustedPlayers: [],
        scheduledStartTime: new Date(Date.now()),
        startingChips: startingChips * 100,
        tableServerId: tableServer.id,
        balanced: true,
        totalChips: 0,
        status: TournamentStatus.SCHEDULED,
        startTime: null,
        endTime: null,
        timeTakenToBalance: 0,
        result: {
          ranks: [],
        },
        bustedOrder: 0,
        fillWithBots: input.fillWithBots,
      };
      let tournamentRepo: Repository<Tournament>;
      if (transactionManager) {
        tournamentRepo = transactionManager.getRepository(Tournament);
      } else {
        tournamentRepo = getGameRepository(Tournament);
      }
      let tournament = new Tournament();
      tournament.data = JSON.stringify(data);
      tournament.maxPlayersInTable = input.maxPlayersInTable;
      tournament.status = TournamentStatus.SCHEDULED;
      tournament.botsCount = input.botsCount || 0;
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

  public async kickoffTournament(tournamentId: number) {
    if (!this.processQueue[tournamentId]) {
      this.processQueue[tournamentId] = {
        processing: false,
        items: [],
      };
    }
    const queue = this.processQueue[tournamentId];
    const item: QueueItem = {
      type: 'KICKOFF_TOURNAMENT',
      payload: {
        tournamentId: tournamentId,
      },
    };

    queue.items.push(item);
    this.processQueueItem(tournamentId).catch(err => {
      logger.error(`Failed to process queue item. ${JSON.stringify(item)}`);
    });
  }

  public async fillBotsTournament(tournamentId: number) {
    let tournamentRepo: Repository<Tournament>;
    tournamentRepo = getGameRepository(Tournament);
    const tournament = await tournamentRepo.findOne({id: tournamentId});
    if (tournament) {
      const data: TournamentData = JSON.parse(tournament.data);
      const botCount = data.maxPlayers - data.registeredPlayers.length;
      logger.info(`Registering ${botCount} in tournament: ${tournamentId}`);
      await registerBotsTournament(tournamentId, botCount);
      logger.info(`Bots registered in tournament: ${tournamentId}`);
    }
  }

  public async registerTournamentInternal(
    playerUuid: string,
    tournamentId: number
  ) {
    try {
      const player = await Cache.getPlayer(playerUuid);
      let tournamentRepo: Repository<Tournament>;
      tournamentRepo = getGameRepository(Tournament);
      const tournament = await tournamentRepo.findOne({id: tournamentId});
      if (tournament) {
        let data = JSON.parse(tournament.data);
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
            status: TournamentPlayingStatus.REGISTERED,
          });
          tournament.data = JSON.stringify(data);
          await tournamentRepo.save(tournament);
          // publish new player information to tournament channel
          await Cache.getTournamentData(tournament.id, true);
        }
        let tournamentData = Cache.getTournamentData(tournament.id);
        Nats.tournamentUpdate(tournamentId, data);
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
      type: 'PLAYER_JOIN',
      payload: {
        playerUuid: playerUuid,
      },
    };

    queue.items.push(item);
    await this.processQueueItem(tournamentId).catch(err => {
      logger.error(`Failed to process queue item. ${JSON.stringify(item)}`);
    });
  }

  private async kickoffTournamentInternal(tournamentId: number) {
    try {
      const data = await Cache.getTournamentData(tournamentId);
      if (!data) {
        throw new Error(`Tournament ${tournamentId} is not found`);
      }
      // start the level timer
      logger.info('Starting the level timer');
      await this.startLevelTimer(data.id, data.levelTime);
      Nats.tournamentStarted(data.id);
      let tournamentRepo: Repository<Tournament>;
      tournamentRepo = getGameRepository(Tournament);
      const tournament = await tournamentRepo.findOne({id: tournamentId});
      if (!tournament) {
        throw new Error(`Tournament ${tournamentId} not found`);
      }
      data.status = TournamentStatus.RUNNING;
      data.startTime = new Date(Date.now());
      tournament.data = JSON.stringify(data);
      tournament.status = TournamentStatus.RUNNING;
      await tournamentRepo.save(tournament);
      // reload cache
      await Cache.getTournamentData(tournament.id, true);

      // start the first hand
      for (const table of data.tables) {
        logger.info('Run a first hand');
        await this.runHand(data.id, table.tableNo);
        // .catch(err => {
        //   logger.error(
        //     `Running hand failed table ${table.tableNo} err: ${errToStr(err)}`
        //   );
        // });
      }

      // if (data.activePlayers === data.registeredPlayers.length) {
      //   logger.info('Waiting for bot players to take the seats');
      //   await sleep(5000);
      // }
    } catch (err) {
      logger.error(
        `Kickoff tournament failed: ${tournamentId}: ${errToStr(err)}`
      );
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
          await this.registerTournamentInternal(
            item.payload.playerUuid,
            tournamentId
          );
        } else if (item.type === 'PLAYER_JOIN') {
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
        } else if (item.type === 'KICKOFF_TOURNAMENT') {
          await this.kickoffTournamentInternal(tournamentId);
        } else if (item.type === 'ABOUT_TO_START_TOURNAMENT') {
          await this.triggerAboutToStartTournamentInternal(tournamentId);
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
    const player = await Cache.getPlayer(playerUuid);
    try {
      logger.info(
        `Joining tournament: ${tournamentId} playerUuid: ${playerUuid} id: ${player.id} name: ${player.name}`
      );
      if (player.name === 'Alison') {
        const updatedCache = await Cache.getPlayer(playerUuid, true);
        logger.info(
          `Alison: Joining tournament: ${tournamentId} playerUuid: ${updatedCache.uuid} id: ${updatedCache.id} name: ${updatedCache.name}`
        );
        logger.info(`Alison is joining the tournament`);
      }
      let tournamentRepo: Repository<Tournament>;
      tournamentRepo = getGameRepository(Tournament);
      const tournament = await tournamentRepo.findOne({id: tournamentId});
      if (tournament) {
      } else {
        throw new Error(`Tournament ${tournamentId} is not found`);
      }

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
          prevHandSeats: [],
          buttonPos: -1,
          smallBlindPos: -1,
          bigBlindPos: -1,
          lastHandStartTime: null,
          lastHandSaveTime: null,
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
        stackBeforeBusted: data.startingChips,
        handsPlayed: 0,
        duration: 0,
        largestStack: 0,
        lowStack: 0,
        bustedOrder: -1,
        startTime: new Date(Date.now()),
        bustedLevel: 0,
        bustedTime: null,
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

      // await this.kickOffTournament(data);
    } catch (err) {
      logger.error(
        `Failed to get tournement info: ${tournamentId}: ${errToStr(err)}`
      );
      throw err;
    }
  }

  private getNextActiveSeat(
    data: TournamentData,
    tableNo: number,
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
    let occupiedSeats = new Array<number>();
    for (let seatNo = 0; seatNo <= data.maxPlayersInTable; seatNo++) {
      let found = false;
      for (const player of table.players) {
        if (player.seatNo === seatNo) {
          player.bustedLevel = currentLevel;
          occupiedSeats.push(player.playerId);
          found = true;
          break;
        }
      }
      if (!found) {
        occupiedSeats.push(0);
      }
    }

    let buttonPos = table.buttonPos;
    let smallBlindPos = table.smallBlindPos;
    let bigBlindPos = table.bigBlindPos;
    if (table.handNum === 1) {
      // first hand
      // determine random button position
      let playerIdx = Math.round(Math.random() * 1000) % table.players.length;
      buttonPos = table.players[playerIdx].seatNo;
      smallBlindPos = this.getNextActiveSeat(
        data,
        tableNo,
        occupiedSeats,
        buttonPos
      );
    } else {
      buttonPos = table.smallBlindPos;
      smallBlindPos = table.bigBlindPos;
    }

    if (table.players.length === 2) {
      smallBlindPos = buttonPos;
    }
    table.smallBlindPos = smallBlindPos;
    table.buttonPos = buttonPos;
    table.bigBlindPos = this.getNextActiveSeat(
      data,
      tableNo,
      occupiedSeats,
      smallBlindPos
    );

    let handDetails: any = {
      button_pos: table.buttonPos,
      sb_pos: table.smallBlindPos,
      bb_pos: table.bigBlindPos,
      sb: sb * 100,
      bb: bb * 100,
      ante: ante * 100,
      game_type: GameType.HOLDEM,
      hand_num: table.handNum,
      result_pause_time: 3,
      max_players: 6,
      action_time: 15,
    };

    logger.info(
      `Table: ${table.tableNo} Hand ${table.handNum} button: ${table.buttonPos} sb: ${table.smallBlindPos} bb: ${table.bigBlindPos}`
    );

    // based on the number of players set up sb and bb
    const numPlayers = table.players.length;
    handDetails.button_pos = table.buttonPos;
    handDetails.sb_pos = table.smallBlindPos;
    handDetails.bb_pos = table.bigBlindPos;

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
    const currentLevelData =
      data.levels[this.currentTournamentLevel[tournamentId]];
    logger.info(
      `============================  Tournament stats: ${data.id} Balanced: ${data.balanced} Level: ${currentLevelData.level} ${currentLevelData.smallBlind}/${currentLevelData.bigBlind} (${currentLevelData.ante})============================`
    );
    table.lastHandStartTime = new Date(Date.now());

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

    // save the tournament state
    let tournamentRepo: Repository<Tournament>;
    tournamentRepo = getGameRepository(Tournament);
    let tournament = await tournamentRepo.findOne({id: tournamentId});
    if (tournament) {
    } else {
      throw new Error(`Tournament ${tournamentId} is not found`);
    }
    const dataStr = JSON.stringify(data);
    tournament.data = dataStr;
    await tournamentRepo.save(tournament);
    await Cache.getTournamentData(tournamentId, true);
  }

  private getActivePlayersCount(data: TournamentData) {
    // get total active players
    let totalActivePlayers = 0;
    for (const table of data.tables) {
      totalActivePlayers += table.players.length;
    }
    return totalActivePlayers;
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
    const level = this.currentTournamentLevel[data.id];
    const currentLevel = data.levels[level];

    logger.info(
      `============================  Tournament stats: ${data.id} Balanced: ${data.balanced} Level: ${level} ${currentLevel.smallBlind}/${currentLevel.bigBlind} (${currentLevel.ante}) Balancing time: ${data.timeTakenToBalance}ms ============================`
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

      let tableActivity = '';
      if (table.lastHandSaveTime) {
        tableActivity = `lastHandSaveTime: ${table.lastHandSaveTime}`;
      }
      if (table.lastHandStartTime) {
        tableActivity =
          tableActivity + ` lastHandStartTime: ${table.lastHandStartTime}`;
      }
      logger.info(
        `[Table: ${table.tableNo}] Players count: ${table.players.length} isActive: ${table.isActive}, Paused: ${table.paused} ${playersStack} handNum: ${table.handNum} ${tableActivity}`
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
      const data = await Cache.getTournamentData(payload.tournamentId);
      let activePlayers = 0;
      if (data) {
        const tournamentId = data.id;
        for (const table of data.tables) {
          activePlayers += table.players.length;
        }

        if (activePlayers >= 2) {
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
                  `******* Starting next level ${level.level} sb: ${level.smallBlind} bb: ${level.bigBlind} ante: ${level.ante} *******`
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
            // this.printTournamentStats(data);
          }
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
      const bustedTime = new Date(Date.now());
      // remove the players who had lost all the stacks from the result
      for (const seatNo of Object.keys(players)) {
        const player = players[seatNo];
        const playerId = parseInt(player.id);
        for (const playerInTable of table.players) {
          if (playerInTable.playerId === playerId) {
            playerInTable.stack = player.balance.after;
            playerInTable.stackBeforeHand = player.balance.before;
            if (playerInTable.stack === 0) {
              // remove the player from the table
              // logger.info(
              //   `Tournament: ${tournamentId} tableNo: ${tableNo} Player: ${playerInTable.playerName} is busted`
              // );
              bustedPlayers.push(playerInTable);
              data.bustedOrder++;
              playerInTable.bustedOrder = data.bustedOrder;
              playerInTable.stackBeforeBusted = playerInTable.stackBeforeHand;
              playerInTable.bustedTime = bustedTime;
              data.bustedPlayers.push(playerInTable);
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
        const startTime = Date.now();
        // balance the table
        [tournamentData, movedPlayers] = await balanceTable(
          data,
          table.tableNo
        );
        const endTime = Date.now();
        data.timeTakenToBalance += endTime - startTime;
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
              } else if (table.players.length == 1) {
                // move the players from this table
                balanceTable(data, table.tableNo);
              }
            }
          }
        }
      }
      if (table) {
        table.lastHandSaveTime = new Date(Date.now());
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
          player.oldSeatNo,
          player.newTableNo,
          player.playerId,
          player.playerName,
          player.playerUuid,
          player.stack,
          player.seatNo
        );
        const playerMovedPayload = {
          tournament_id: tournamentData.id,
          old_table_no: player.oldTableNo,
          new_table_no: player.newTableNo,
          new_table_seat_no: player.seatNo,
          game_code: this.getTableGameCode(
            tournamentData.id,
            player.oldTableNo
          ),
          game_id: this.getTableGameId(tournamentData.id, player.oldTableNo),
          player_id: player.playerId,
          game_info: `{"gameCode": ${this.getTableGameCode(
            tournamentData.id,
            player.oldTableNo
          )}}`,
        };
        logger.info(
          `Moving player table: ${JSON.stringify(playerMovedPayload)}`
        );
        gameServerRpc.playerMovedTable(playerMovedPayload, (err, value) => {
          if (err) {
            logger.error(
              `moving player table tournament: ${tournamentData?.id} table: ${player.oldTableNo}=>${player.newTableNo} failed`
            );
          } else {
            // successfully moved the table
            logger.info(
              `moving player table tournament: ${tournamentData?.id} table: ${player.oldTableNo}=>${player.newTableNo} succeeded`
            );
          }
        });
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
          // logger.info(
          //   `Tournament: ${tournamentId} tableNo: ${tableNo} Player: ${updatedTable[0].playerName} is the winner Stack: ${updatedTable[0].stack}.`
          // );
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
          this.tournamentEnded(data);
        }
      }
    }
  }

  private async tournamentEnded(data: TournamentData) {
    const tournamentId = data.id;
    let winner: TournamentPlayer | null = null;
    await endBotTournament(tournamentId);
    // get total active players
    for (const table of data.tables) {
      if (table.isActive) {
        winner = table.players[0];
        logger.info(
          `*********** Tournament: ${tournamentId} Winner: ${winner.playerName} ${winner.stack} ***********`
        );
        if (data.startTime) {
          data.endTime = new Date(Date.now());
          let duration =
            data.endTime.valueOf() -
            Date.parse(data.startTime.toString()).valueOf();
          let durationInSecs = Math.round(duration / 1000);
          logger.info(
            `*********** Tournament: ${tournamentId} run time: ${durationInSecs} seconds Balancing time: ${data.timeTakenToBalance}ms ***********`
          );
        }
        break;
      }
    }
    data.status = TournamentStatus.ENDED;

    // update the ranks
    //const bustedPlayers = _.filter(data.playersInTournament, p => p.stack !== -1);
    const bustedRankOrder = _.orderBy(
      data.bustedPlayers,
      ['bustedOrder'],
      'desc'
    );
    const rankedPlayers = new Array<TournamentPlayerRank>();

    /*
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
      }
    */
    let rank = 1;
    if (winner) {
      rankedPlayers.push({
        playerId: winner.playerId,
        playerName: winner.playerName,
        playerUuid: winner.playerUuid,
        stackBeforeBusted: 0,
        handsPlayed: 0,
        duration: 0,
        largestStack: winner.stack,
        lowStack: 0,
        rank: rank,
        bustedLevel: -1,
        bustedTime: null,
      });
    }

    for (const bustedPlayer of bustedRankOrder) {
      rank++;
      rankedPlayers.push({
        playerId: bustedPlayer.playerId,
        playerName: bustedPlayer.playerName,
        playerUuid: bustedPlayer.playerUuid,
        stackBeforeBusted: bustedPlayer.stackBeforeBusted,
        handsPlayed: 0,
        duration: 0,
        largestStack: 0,
        lowStack: 0,
        rank: rank,
        bustedLevel: bustedPlayer.bustedLevel,
        bustedTime: bustedPlayer.bustedTime,
      });
    }
    data.result.ranks = rankedPlayers;
    logger.info(`*********** Tournament: ${tournamentId} Result ***********`);
    for (const rank of rankedPlayers) {
      let bustedTime = 'Not busted';
      if (rank.bustedTime) {
        bustedTime = new Date(rank.bustedTime.toString()).toISOString();
      }
      logger.info(
        `rank: ${rank.rank} player: ${rank.playerName} stack: ${rank.stackBeforeBusted} Last level: ${rank.bustedLevel} bustedTime: ${bustedTime} ***********`
      );
    }
    logger.info(`*********** Tournament: ${tournamentId} ***********`);

    // update results
    let tournamentRepo: Repository<Tournament>;
    tournamentRepo = getGameRepository(Tournament);
    const tournament = await tournamentRepo.findOne({id: tournamentId});
    if (!tournament) {
      throw new Error(`Tournament ${tournamentId} not found`);
    }
    tournament.data = JSON.stringify(data);
    tournament.status = TournamentStatus.ENDED;
    await tournamentRepo.save(tournament);
    await Cache.getTournamentData(tournamentId, true);
  }

  public async triggerAboutToStartTournament(tournamentId: number) {
    if (!this.processQueue[tournamentId]) {
      this.processQueue[tournamentId] = {
        processing: false,
        items: [],
      };
    }

    const queue = this.processQueue[tournamentId];
    const item: QueueItem = {
      type: 'ABOUT_TO_START_TOURNAMENT',
      payload: {
        tournamentId: tournamentId,
      },
    };

    queue.items.push(item);
    await this.processQueueItem(tournamentId).catch(err => {
      logger.error(`Failed to process queue item. ${JSON.stringify(item)}`);
    });
  }

  public async triggerAboutToStartTournamentInternal(tournamentId: number) {
    try {
      logger.info(`Tournament is about to start: ${tournamentId}`);
      // bots will join the tournament here
      const data = await Cache.getTournamentData(tournamentId);
      if (!data) {
        throw new Error(`Tournament ${tournamentId} not found`);
      }

      this.currentTournamentLevel[tournamentId] = 1;
      this.tournamentLevelData[tournamentId] = data.levels;
      // send NATS message to all the players
      Nats.tournamentAboutToStart(data.id);
      let tournamentRepo: Repository<Tournament>;
      tournamentRepo = getGameRepository(Tournament);
      const tournament = await tournamentRepo.findOne({id: tournamentId});
      if (!tournament) {
        throw new Error(`Tournament ${tournamentId} not found`);
      }
      data.status = TournamentStatus.ABOUT_TO_START;
      tournament.data = JSON.stringify(data);
      await tournamentRepo.save(tournament);

      logger.info(
        `Sent messages to players to join tournament ${tournamentId}`
      );
    } catch (err) {
      logger.error(
        `Could not start tournament. tournamentId: ${tournamentId}, err: ${errToStr(
          err
        )}`
      );
    }
  }

  public async getActiveTournaments(
    playerUuid: string,
    clubCode: string | undefined
  ) {
    const ret = new Array<TournamentListItem>();
    const tournamentRepo = getGameRepository(Tournament);
    const tournaments = await tournamentRepo.find({
      where: [
        {status: TournamentStatus.SCHEDULED},
        {status: TournamentStatus.RUNNING},
      ],
    });
    for (const tournament of tournaments) {
      const data: TournamentData = JSON.parse(tournament.data);
      let startTime = new Date(Date.now());
      if (data.startTime) {
        startTime = new Date(data.startTime.toString());
      }
      /*  status: TournamentStatus;
  registeredPlayersCount: number;
  botsCount: number;
  activePlayersCount: number;
  createdBy: string;
  */
      const item: TournamentListItem = {
        tournamentId: tournament.id,
        name: data.name,
        startTime: startTime,
        startingChips: data.startingChips,
        minPlayers: data.minPlayers,
        maxPlayers: data.maxPlayers,
        maxPlayersInTable: data.maxPlayersInTable,
        levelType: TournamentLevelType.STANDARD,
        fillWithBots: data.fillWithBots,
        status: tournament.status,
        registeredPlayersCount: data.registeredPlayers.length,
        botsCount: 0,
        activePlayersCount: this.getActivePlayersCount(data),
        createdBy: 'POC',
      };
      ret.push(item);
    }
    return ret;
  }
}

export const TournamentRepository = new TournamentRepositoryImpl();
