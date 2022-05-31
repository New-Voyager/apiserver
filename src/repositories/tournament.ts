import {Tournament} from '@src/entity/game/tournament';
import {errToStr, getLogger} from '@src/utils/log';
import {EntityManager, Repository} from 'typeorm';
import {Cache} from '@src/cache';
import {getGameRepository} from '.';
import {sleep} from '@src/timer';
import {Nats} from '@src/nats';
import {GameServerRepository} from './gameserver';
import {GameType} from '@src/entity/types';
// import { TableServiceClient } from '@src/rpc/rpc_pb_service';
// import * as proto_rpc_pb from "@src/rpc/rpc_pb";

const logger = getLogger('tournaments');
const apiCallbackHost = 'localhost:9001';

const grpc = require('@grpc/grpc-js');
var protoLoader = require('@grpc/proto-loader');
const PROTO_PATH = __dirname + '/./rpc.proto';

logger.info('Loading proto file: ' + PROTO_PATH);

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

class TournamentRepositoryImpl {
  private initialized: boolean = false;
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
    return `tournament-${tournamentId}-${tableNo}`;
  }

  public getTurboLevels(): Array<TournamentLevel> {
    let levels = new Array<TournamentLevel>();
    let smallBlind = 10;
    for (let i = 1; i <= 20; i++) {
      let ante = 0;
      let bigBlind = smallBlind * 2;
      if (i < 5) {
        ante = 0;
      } else {
        ante = bigBlind;
      }
      levels.push({
        level: i,
        smallBlind: smallBlind,
        bigBlind: bigBlind,
        ante: ante,
      });
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
      const data: TournamentData = {
        id: 0,
        name: tournamentName,
        minPlayers: 2,
        maxPlayers: 100,
        maxPlayersInTable: 6,
        levelTime: 2, // minutes
        currentLevel: -1,
        levels: this.getTurboLevels(),
        tables: [],
        registeredPlayers: [],
        playersInTournament: [],
        startTime: startTime,
        startingChips: 5000,
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
            stack: data.startingStack,
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
      const tournament = await tournamentRepo.findOne({id: tournamentId});
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
    try {
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
    } catch (err) {
      logger.error(
        `Failed to get tournement info: ${tournamentId}: ${errToStr(err)}`
      );
      throw err;
    }
  }

  public async seatBotsInTournament(tournamentId: number, botCount: number) {
    try {
      // call bot-runner to register bots to the system and let them register for the tournament
      // now bots are listening on tournament channel
    } catch (err) {}
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
      await tournamentRepo.save(tournament);
      Nats.tournamentStarted(tournamentId);
      await sleep(1000);
      // wait for the bots to start listen on the table channels
      // start the first hand
      // bots should play the first hand
    } catch (err) {}
  }
}

export const TournamentRepository = new TournamentRepositoryImpl();
