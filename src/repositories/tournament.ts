import {Tournament} from '@src/entity/game/tournament';
import {errToStr, getLogger} from '@src/utils/log';
import {EntityManager, Repository} from 'typeorm';
import {Cache} from '@src/cache';
import {getGameRepository} from '.';

const logger = getLogger('tournaments');

interface Table {
  tableNo: number;
  players: Array<TournamentPlayer>;
  tableServer: string;
}

interface TournamentPlayer {
  playerId: number;
  playerName: string;
  playerUuid: string;
  stack: number;
  isSittingOut: boolean;
  isBot: boolean;
  tableNo: number;
}

interface TournamentData {
  id: number;
  startingStack: number;
  tables: Array<Table>;
  registeredPlayers: Array<TournamentPlayer>;
  playersInTournament: Array<TournamentPlayer>;
  tournamentName: string;
  startTime: Date;
}

class TournamentRepositoryImpl {
  public getTournamentChannel(tournamentId: number): string {
    return `tournament-${tournamentId}`;
  }

  public async scheduleTournament(
    tournamentName: string,
    clubCode: string,
    startTime: Date,
    transactionManager?: EntityManager
  ): Promise<number> {
    try {
      const data: TournamentData = {
        id: 0,
        tournamentName: tournamentName,
        tables: [],
        registeredPlayers: [],
        playersInTournament: [],
        startTime: startTime,
        startingStack: 5000,
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
        data.tables.push(table);
      }
      table.players.push({
        playerId: player.id,
        playerName: player.name,
        playerUuid: player.uuid,
        stack: data.startingStack,
        isSittingOut: false,
        isBot: player.bot,
        tableNo: table.tableNo,
      });

      // set the table number for the player
      const playerData = data.registeredPlayers.find(
        p => p.playerUuid === playerUuid
      );
      if (playerData) {
        playerData.tableNo = table.tableNo;
      }

      tournament.data = JSON.stringify(data);
      await tournamentRepo.save(tournament);

      // publish that the player has joined to tournament channel, send the table info
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
      // wait for the bots to start listen on the table channels
      // start the first hand
      // bots should play the first hand
    } catch (err) {}
  }
}

export const TournamentRepository = new TournamentRepositoryImpl();
