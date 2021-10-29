import {Club, ClubMember} from '@src/entity/player/club';
import {
  PokerGame,
  PokerGameSettings,
  PokerGameUpdates,
} from '@src/entity/game/game';
import {Player} from '@src/entity/player/player';
import {EntityManager, getRepository, Repository} from 'typeorm';
import * as redis from 'redis';
import {
  redisHost,
  redisPort,
  redisUser,
  redisPassword,
  isRunningUnitTest,
} from '@src/utils';
import {getGameRepository, getUserRepository} from '@src/repositories';
import {PlayerLocation} from '@src/entity/types';
import {GameServer} from '@src/entity/game/gameserver';
import {getLogger, errToStr} from '@src/utils/log';

const logger = getLogger('cache');

let client: any;
interface MemCache {
  success: boolean;
  data: string;
}
let unitTestCache: {[key: string]: MemCache | undefined} = {};

export function initializeRedis() {
  if (client !== undefined) {
    return;
  }
  if (isRunningUnitTest()) {
    return;
  }

  if (redisUser() || redisPassword()) {
    const url = `rediss://${redisHost()}:${redisPort()}`;
    client = redis.createClient(url, {
      user: redisUser(),
      password: redisPassword(),
    });
    logger.info('Successfully connected to redis');
  } else {
    client = redis.createClient(redisPort(), redisHost());
  }
  client.on('error', error => {
    logger.error(`Redis client error: ${errToStr(error, false)}}`);
    throw new Error(error);
  });
}

class GameCache {
  constructor() {
    initializeRedis();
  }
  public async getCache(key: string) {
    if (isRunningUnitTest()) {
      if (!unitTestCache[key]) {
        return {
          success: false,
          data: undefined,
        };
      }
      return unitTestCache[key] as any;
    }

    if (!client) {
      throw new Error(
        `GameCache.getCache (key: ${key}) called when redis client is null or undefined`
      );
    }

    return new Promise<{success: boolean; data: string}>(
      async (resolve, reject) => {
        try {
          client.get(key, (err: any, value: any) => {
            if (err) {
              logger.error(
                `Error from Redis client.get (key: ${key}): ${errToStr(err)}`
              );
              resolve({success: false, data: value});
            } else {
              resolve({success: true, data: value});
            }
          });
        } catch (error) {
          logger.error(
            `Error while calling redis client.get (key: ${key}): ${errToStr(
              error
            )}`
          );
          reject({success: false, data: error});
        }
      }
    );
  }

  public async setCache(key: string, value: string) {
    if (isRunningUnitTest()) {
      const ret = {success: true, data: value};
      unitTestCache[key] = ret;
      return ret;
    }

    if (!client) {
      throw new Error(
        `GameCache.setCache (key: ${key}) called when redis client is null or undefined`
      );
    }

    return new Promise<{success: boolean}>(async (resolve, reject) => {
      try {
        client.set(key, value, (err: any, object: any) => {
          if (err) {
            logger.error(
              `Error from Redis client.set (key: ${key}): ${errToStr(err)}`
            );
            resolve({success: false});
          } else {
            resolve({success: true});
          }
        });
      } catch (error) {
        logger.error(
          `Error while calling redis client.set (key: ${key}): ${errToStr(
            error
          )}`
        );
        reject({success: false});
      }
    });
  }

  public async removeCache(key: string) {
    if (isRunningUnitTest()) {
      if (unitTestCache[key]) {
        unitTestCache[key] = undefined;
      }
      return {success: true};
    }

    if (!client) {
      throw new Error(
        `GameCache.removeCache (key: ${key}) called when redis client is null or undefined`
      );
    }

    return new Promise<{success: boolean}>(async (resolve, reject) => {
      try {
        client.del(key, (err: any, object: any) => {
          if (err) {
            logger.error(
              `Error from Redis client.del (key: ${key}): ${errToStr(err)}`
            );
            resolve({success: false});
          } else {
            resolve({success: true});
          }
        });
      } catch (error) {
        logger.error(
          `Error while calling Redis client.del (key: ${key}): ${errToStr(
            error
          )}`
        );
        reject({success: false});
      }
    });
  }

  public async scanCache(pattern: string) {
    if (isRunningUnitTest()) {
      const keys = new Array<string>();
      for (const key of Object.keys(unitTestCache)) {
        if (key.match(pattern)) {
          keys.push(key);
        }
      }
      return {data: keys};
    }

    if (!client) {
      throw new Error(
        `GameCache.scanCache called when redis client is null or undefined`
      );
    }

    return new Promise<{success: boolean; data: any}>(
      async (resolve, reject) => {
        try {
          client.keys(pattern, (err: any, reply: any) => {
            if (err) {
              logger.error(
                `Error from Redis client.keys: ${errToStr(err, false)}`
              );
              resolve({success: false, data: err});
            } else {
              resolve({success: true, data: reply});
            }
          });
        } catch (error) {
          logger.error(
            `Error while calling Redis client.keys: ${errToStr(error)}`
          );
          reject({success: false, data: error});
        }
      }
    );
  }

  public async updateGameHighHand(gameCode: string, rank: number) {
    const getResp = await this.getCache(`gameCache-${gameCode}`);
    if (getResp.success && getResp.data) {
      const game: PokerGame = JSON.parse(getResp.data) as PokerGame;
      game.highHandRank = rank;
      await this.setCache(`gameCache-${gameCode}`, JSON.stringify(game));
    }
  }

  /**
   * Update the cache there is a pending updates for this game.
   * e.g. When a player's stack goes to 0, we need to start the buyin timer,
   * before we move to next hand.
   * @param gameCode
   * @param pendingUpdates
   */
  public async updateGamePendingUpdates(
    gameCode: string,
    pendingUpdates: boolean
  ) {
    const getResp = await this.getCache(`gameCache-${gameCode}`);
    if (getResp.success && getResp.data) {
      const game: PokerGame = JSON.parse(getResp.data) as PokerGame;
      game.pendingUpdates = pendingUpdates;
      await this.setCache(`gameCache-${gameCode}`, JSON.stringify(game));
    }
  }

  public async observeGame(gameCode: string, player: Player): Promise<boolean> {
    const setResp = await this.setCache(
      `observersCache-${gameCode}-${player.uuid}`,
      JSON.stringify(player)
    );
    return setResp.success;
  }

  public async gameObservers(gameCode: string): Promise<Array<Player>> {
    const observersList = await this.scanCache(`observersCache-${gameCode}-*`);
    const observers = new Array<Player>();
    for await (const key of observersList.data) {
      const getResp = await this.getCache(key);
      if (getResp.success && getResp.data) {
        observers.push(JSON.parse(getResp.data) as Player);
      }
    }
    return observers;
  }

  public async removeGameObserver(
    gameCode: string,
    player: Player
  ): Promise<boolean> {
    const getResp = await this.removeCache(
      `observersCache-${gameCode}-${player.uuid}`
    );
    return getResp.success;
  }

  public async removeAllObservers(gameCode: string) {
    const observersList = await this.scanCache(`observersCache-${gameCode}-*`);
    for await (const key of observersList.data) {
      await this.removeCache(key);
    }
  }

  public async getGame(
    gameCode: string,
    update = false,
    transactionManager?: EntityManager
  ): Promise<PokerGame | undefined> {
    const getResp = await this.getCache(`gameCache-${gameCode}`);
    if (getResp.success && getResp.data && !update) {
      const ret = JSON.parse(getResp.data) as PokerGame;
      return ret;
    } else {
      let repo: Repository<PokerGame>;
      if (transactionManager) {
        repo = transactionManager.getRepository(PokerGame);
      } else {
        repo = getGameRepository(PokerGame);
      }
      const game = await repo.findOne({
        where: {gameCode: gameCode},
      });
      if (!game) {
        return undefined;
        //.throw new GameNotFoundError(gameCode);
      }
      await this.updateGameIdGameCodeChange(game.id, game.gameCode);

      if (getResp.data) {
        const oldGame = JSON.parse(getResp.data) as PokerGame;
        game.highHandRank = oldGame.highHandRank;
        game.pendingUpdates = oldGame.pendingUpdates;
      }

      await this.setCache(`gameCache-${gameCode}`, JSON.stringify(game));
      await this.setCache(`gameIdCache-${game.id}`, JSON.stringify(game));
      return game;
    }
  }

  public async getGameSettings(
    gameCode: string,
    update = false,
    transactionManager?: EntityManager
  ): Promise<PokerGameSettings> {
    const getResp = await this.getCache(`gameSettingsCache-${gameCode}`);
    if (getResp.success && getResp.data && !update) {
      const ret = JSON.parse(getResp.data) as PokerGameSettings;
      return ret;
    } else {
      let repo: Repository<PokerGameSettings>;
      if (transactionManager) {
        repo = transactionManager.getRepository(PokerGameSettings);
      } else {
        repo = getGameRepository(PokerGameSettings);
      }
      const gameSettings = await repo.findOne({
        where: {gameCode: gameCode},
      });
      if (!gameSettings) {
        throw new Error(
          `Cannot find with game code [${gameCode}] in poker game settings repo`
        );
      }

      await this.setCache(
        `gameSettingsCache-${gameCode}`,
        JSON.stringify(gameSettings)
      );
      return gameSettings;
    }
  }

  public async getGameUpdates(
    gameCode: string,
    update = false,
    transactionManager?: EntityManager
  ): Promise<PokerGameUpdates> {
    const getResp = await this.getCache(`gameUpdatesCache-${gameCode}`);
    if (getResp.success && getResp.data && !update) {
      const cacheRet = JSON.parse(getResp.data) as any;
      const ret = cacheRet as PokerGameUpdates;
      if (cacheRet && cacheRet.nextCoinConsumeTime) {
        ret.nextCoinConsumeTime = new Date(
          Date.parse(cacheRet.nextCoinConsumeTime.toString())
        );
      }

      if (cacheRet && cacheRet.lastIpGpsCheckTime) {
        ret.lastIpGpsCheckTime = new Date(
          Date.parse(cacheRet.lastIpGpsCheckTime.toString())
        );
      }

      if (cacheRet && cacheRet.lastBombPotTime) {
        ret.lastBombPotTime = new Date(
          Date.parse(cacheRet.lastBombPotTime.toString())
        );
      }

      return ret;
    } else {
      let repo: Repository<PokerGameUpdates>;
      if (transactionManager) {
        repo = transactionManager.getRepository(PokerGameUpdates);
      } else {
        repo = getGameRepository(PokerGameUpdates);
      }
      const gameUpdates = await repo.findOne({
        where: {gameCode: gameCode},
      });
      if (!gameUpdates) {
        throw new Error(
          `Cannot find with game code [${gameCode}] in poker game updates repo`
        );
      }

      await this.setCache(
        `gameUpdatesCache-${gameCode}`,
        JSON.stringify(gameUpdates)
      );
      return gameUpdates;
    }
  }

  public async getGameServer(
    url: string,
    update = false,
    transactionManager?: EntityManager
  ): Promise<GameServer> {
    const getResp = await this.getCache(`gameServerCache-${url}`);
    if (getResp.success && getResp.data && !update) {
      const ret = JSON.parse(getResp.data) as GameServer;
      return ret;
    } else {
      let repo: Repository<GameServer>;
      if (transactionManager) {
        repo = transactionManager.getRepository(GameServer);
      } else {
        repo = getGameRepository(GameServer);
      }
      const gameServer = await repo.findOne({
        where: {url: url},
      });
      if (!gameServer) {
        throw new Error(`Cannot find game server with url: ${url}`);
      }

      await this.setCache(`gameServerCache-${url}`, JSON.stringify(gameServer));
      return gameServer;
    }
  }

  private async gameCodeFromId(gameId: number): Promise<string | null> {
    const getResp = await this.getCache('gameIdGameCodeCache');
    if (getResp.success && getResp.data) {
      const gameIdToCode = JSON.parse(getResp.data);
      return gameIdToCode[gameId.toString()];
    } else {
      return null;
    }
  }

  private async updateGameIdGameCodeChange(gameId: number, gameCode: string) {
    const getResp = await this.getCache('gameIdGameCodeCache');
    let data: any = {};
    if (getResp.success && getResp.data) {
      data = JSON.parse(getResp.data);
      data[gameId.toString()] = gameCode;
    } else {
      data[gameId.toString()] = gameCode;
    }

    await this.setCache('gameIdGameCodeCache', JSON.stringify(data));
  }

  public async getClub(clubCode: string, update = false): Promise<Club> {
    const getResp = await this.getCache(`clubCache-${clubCode}`);
    if (getResp.success && getResp.data && !update) {
      return JSON.parse(getResp.data) as Club;
    } else {
      const club = await getUserRepository(Club).findOne({
        relations: ['owner', 'members'],
        where: {clubCode: clubCode},
      });
      if (!club) {
        throw new Error(`Cannot find club code [${clubCode}] in club repo`);
      }

      await this.setCache(`clubCache-${clubCode}`, JSON.stringify(club));
      return club;
    }
  }

  public async getPlayer(playerUuid: string, update = false): Promise<Player> {
    const getResp = await this.getCache(`playerCache-${playerUuid}`);
    if (getResp.success && getResp.data && !update) {
      const player = JSON.parse(getResp.data) as Player;
      if (player && player.locationUpdatedAt) {
        player.locationUpdatedAt = new Date(
          Date.parse(player.locationUpdatedAt.toString())
        );
      }

      return player;
    } else {
      const player = await getUserRepository(Player).findOne({
        where: {uuid: playerUuid},
      });
      if (!player) {
        throw new Error(
          `Cannot find player uuid [${playerUuid}] in player repo`
        );
      }

      // update player location/ip
      if (getResp.success && getResp.data) {
        let ret = JSON.parse(getResp.data) as Player;
        player.ipAddress = ret.ipAddress;
        player.location = ret.location;
        if (!ret.locationUpdatedAt) {
          ret.locationUpdatedAt = null;
        } else {
          ret.locationUpdatedAt = new Date(
            Date.parse(ret.locationUpdatedAt.toString())
          );
        }
        player.locationUpdatedAt = ret.locationUpdatedAt;
      }
      await this.setCache(`playerCache-${playerUuid}`, JSON.stringify(player));
      await this.setCache(`playerIdCache-${player.id}`, JSON.stringify(player));
      return player;
    }
  }

  /**
   * Update the cache with next coin consume time.
   * @param gameCode
   * @param playerLocation
   * @param ipAddress
   */
  public async updatePlayerLocation(
    playerUuid: string,
    playerLocation: PlayerLocation,
    ipAddr: string
  ): Promise<Player | null> {
    const getResp = await this.getCache(`playerCache-${playerUuid}`);
    if (getResp.success && getResp.data) {
      const player = JSON.parse(getResp.data) as Player;
      if (playerLocation) {
        player.location = playerLocation;
      }
      if (ipAddr) {
        player.ipAddress = ipAddr;
      }
      player.locationUpdatedAt = new Date();
      await this.setCache(`playerCache-${playerUuid}`, JSON.stringify(player));
      await this.setCache(`playerIdCache-${player.id}`, JSON.stringify(player));
      return player;
    }
    return null;
  }

  public async getPlayerById(id: number, update = false): Promise<Player> {
    const getResp = await this.getCache(`playerIdCache-${id}`);
    if (getResp.success && getResp.data && !update) {
      return JSON.parse(getResp.data) as Player;
    } else {
      const player = await getUserRepository(Player).findOne({
        where: {id: id},
      });
      if (!player) {
        throw new Error(`Cannot find player id [${id}] in player repo`);
      }
      await this.setCache(`playerCache-${player.uuid}`, JSON.stringify(player));
      await this.setCache(`playerIdCache-${player.id}`, JSON.stringify(player));
      return player;
    }
  }

  public async getClubMember(
    playerUuid: string,
    clubCode: string,
    update = false
  ): Promise<ClubMember | null> {
    const key = `${clubCode}:${playerUuid}`;
    const getResp = await this.getCache(`clubMemberCache-${key}`);
    if (getResp.success && getResp.data && !update) {
      return JSON.parse(getResp.data) as ClubMember;
    } else {
      const club = await this.getClub(clubCode);
      const player = await this.getPlayer(playerUuid);
      const clubMember = await getUserRepository(ClubMember).findOne({
        relations: ['player', 'club'],
        where: {
          club: {id: club.id},
          player: {id: player.id},
        },
      });
      if (!clubMember) {
        return null;
      }
      await this.setCache(`clubMemberCache-${key}`, JSON.stringify(clubMember));
      return clubMember;
    }
  }

  public async isClubMember(
    playerUUid: string,
    clubCode: string
  ): Promise<boolean> {
    const clubMember = await this.getClubMember(playerUUid, clubCode);
    if (!clubMember) {
      return false;
    }
    return true;
  }

  public async getGameById(
    gameID: number,
    transactionManager?: EntityManager
  ): Promise<PokerGame | undefined> {
    const gameCode = await this.gameCodeFromId(gameID);
    if (!gameCode) {
      let gameRepo: Repository<PokerGame>;
      if (transactionManager) {
        gameRepo = transactionManager.getRepository(PokerGame);
      } else {
        gameRepo = getGameRepository(PokerGame);
      }
      const game = await gameRepo.findOne({
        where: {id: gameID},
      });
      if (!game) {
        return game;
      }
      return game;
    } else {
      return this.getGame(gameCode);
    }
  }

  public async removeGame(gameCode: string) {
    const getResp = await this.getCache(`gameCache-${gameCode}`);
    if (getResp.success && getResp.data) {
      const game = JSON.parse(getResp.data) as PokerGame;
      await this.removeCache(`gameCache-${gameCode}`);
      await this.removeCache(`gameIdCache-${game.id}`);
    }
  }

  public async removeClub(clubCode: string) {
    await this.removeCache(`clubCache-${clubCode}`);
  }

  public async removeClubMember(playerUuid: string, clubCode: string) {
    const key = `${clubCode}:${playerUuid}`;
    await this.removeCache(`clubMemberCache-${key}`);
  }

  public reset() {
    if (isRunningUnitTest()) {
      unitTestCache = {};
      return;
    }
    initializeRedis();
    return new Promise(async (resolve, reject) => {
      client.flushall((err: Error, succeeded) => {
        if (err) {
          logger.error(`Redis flushall error: ${errToStr(err, false)}`);
        } else {
          logger.info(`Redis flushall succeeded. Result: ${succeeded}`);
          resolve(true);
        }
      });
    });
  }
}

export const Cache = new GameCache();
