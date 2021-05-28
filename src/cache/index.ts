import {Club, ClubMember} from '@src/entity/club';
import {PokerGame} from '@src/entity/game';
import {Player} from '@src/entity/player';
import {EntityManager, getRepository, Repository} from 'typeorm';
import * as redis from 'redis';
import {redisHost, redisPort} from '@src/utils';

interface CachedHighHandTracking {
  rewardId: number;
  trackingId: number;
  gameCodes: Array<string>;
}

const client = redis.createClient(redisPort(), redisHost());
client.on('error', error => {
  console.log(error);
  process.exit(0);
});

class GameCache {
  public async getCache(key: string) {
    return new Promise<{success: boolean; data: string}>(
      async (resolve, reject) => {
        try {
          client.get(key, (err: any, value: any) => {
            if (err) resolve({success: false, data: value});
            resolve({success: true, data: value});
          });
        } catch (error) {
          console.log('getCache Handle rejected promise (' + error + ') here.');
          reject({success: false, data: error});
        }
      }
    );
  }

  public async setCache(key: string, value: string) {
    return new Promise<{success: boolean}>(async (resolve, reject) => {
      try {
        client.set(key, value, (err: any, object: any) => {
          if (err) resolve({success: false});
          resolve({success: true});
        });
      } catch (error) {
        console.log('getCache Handle rejected promise (' + error + ') here.');
        reject({success: false});
      }
    });
  }

  public async removeCache(key: string) {
    return new Promise<{success: boolean}>(async (resolve, reject) => {
      try {
        client.del(key, (err: any, object: any) => {
          if (err) resolve({success: false});
          resolve({success: true});
        });
      } catch (error) {
        console.log(
          'removeCache Handle rejected promise (' + error + ') here.'
        );
        reject({success: false});
      }
    });
  }

  public async scanCache(pattern: string) {
    return new Promise<{success: boolean; data: any}>(
      async (resolve, reject) => {
        try {
          client.keys(pattern, (err: any, reply: any) => {
            if (err) resolve({success: false, data: err});
            resolve({success: true, data: reply});
          });
        } catch (error) {
          console.log(
            'scanCache Handle rejected promise (' + error + ') here.'
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
  ): Promise<PokerGame> {
    const getResp = await this.getCache(`gameCache-${gameCode}`);
    if (getResp.success && getResp.data && !update) {
      return JSON.parse(getResp.data) as PokerGame;
    } else {
      let repo: Repository<PokerGame>;
      if (transactionManager) {
        repo = transactionManager.getRepository(PokerGame);
      } else {
        repo = getRepository(PokerGame);
      }
      const game = await repo.findOne({
        relations: ['club', 'host', 'startedBy', 'endedBy'],
        where: {gameCode: gameCode},
      });
      if (!game) {
        throw new Error(`Cannot find with game code: ${gameCode}`);
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

  private async gameCodeFromId(gameId: number): Promise<string | null> {
    const getResp = await this.getCache(`gameIdGameCodeCache`);
    if (getResp.success && getResp.data) {
      const gameIdToCode = JSON.parse(getResp.data);
      return gameIdToCode[gameId.toString()];
    } else {
      return null;
    }
  }

  private async updateGameIdGameCodeChange(gameId: number, gameCode: string) {
    const getResp = await this.getCache(`gameIdGameCodeCache`);
    let data: any = {};
    if (getResp.success && getResp.data) {
      data = JSON.parse(getResp.data);
      data[gameId.toString()] = gameCode;
    } else {
      data[gameId.toString()] = gameCode;
    }

    await this.setCache(`gameIdGameCodeCache`, JSON.stringify(data));
  }

  public async getClub(clubCode: string, update = false): Promise<Club> {
    const getResp = await this.getCache(`clubCache-${clubCode}`);
    if (getResp.success && getResp.data && !update) {
      return JSON.parse(getResp.data) as Club;
    } else {
      const club = await getRepository(Club).findOne({
        relations: ['owner', 'members'],
        where: {clubCode: clubCode},
      });
      if (!club) {
        throw new Error(`Cannot find with club code: ${clubCode}`);
      }

      await this.setCache(`clubCache-${clubCode}`, JSON.stringify(club));
      return club;
    }
  }

  public async getPlayer(playerUuid: string, update = false): Promise<Player> {
    const getResp = await this.getCache(`playerCache-${playerUuid}`);
    if (getResp.success && getResp.data && !update) {
      return JSON.parse(getResp.data) as Player;
    } else {
      const player = await getRepository(Player).findOne({
        where: {uuid: playerUuid},
      });
      if (!player) {
        throw new Error(`Cannot find player: ${playerUuid}`);
      }
      await this.setCache(`playerCache-${playerUuid}`, JSON.stringify(player));
      await this.setCache(`playerIdCache-${player.id}`, JSON.stringify(player));
      return player;
    }
  }

  public async getPlayerById(id: number, update = false): Promise<Player> {
    const getResp = await this.getCache(`playerIdCache-${id}`);
    if (getResp.success && getResp.data && !update) {
      return JSON.parse(getResp.data) as Player;
    } else {
      const player = await getRepository(Player).findOne({
        where: {id: id},
      });
      if (!player) {
        throw new Error(`Cannot find player: ${id}`);
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
      const clubMember = await getRepository(ClubMember).findOne({
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

  public async getGameById(gameID: number): Promise<PokerGame | undefined> {
    const gameCode = await this.gameCodeFromId(gameID);
    if (!gameCode) {
      const game = await getRepository(PokerGame).findOne({
        relations: ['club', 'host', 'startedBy', 'endedBy'],
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
    return new Promise(async (resolve, reject) => {
      client.flushall((err, succeeded) => {
        console.log(succeeded);
        resolve(true);
      });
    });
  }
}

export const Cache = new GameCache();
