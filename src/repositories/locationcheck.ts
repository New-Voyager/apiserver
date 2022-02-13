import {PlayerGameTracker} from '@src/entity/game/player_game_tracker';
import {PokerGame, PokerGameSettings} from '@src/entity/game/game';
import {Player} from '@src/entity/player/player';
import {getDistanceInMeters, utcTime} from '@src/utils';
import {errToStr, getLogger} from '@src/utils/log';
import {EntityManager, IsNull, Not, Repository} from 'typeorm';
import {Cache} from '@src/cache/index';
import {getGameRepository} from '.';
import {
  IpAddressMissingError,
  LocationPromixityError,
  SameIpAddressError,
} from '@src/errors';
import {getAppSettings} from '@src/firebase';
import _ from 'lodash';
import {TakeBreak} from './takebreak';
import * as fs from 'fs';
const logger = getLogger('repositories::locationcheck');

// Maxmind
const Reader = require('@maxmind/geoip2-node').Reader;
const buildDir = __dirname + '/../..';
const dbBuffer = fs.readFileSync(buildDir + '/geodb/GeoLite2-City.mmdb');

export class LocationCheck {
  private game: PokerGame;
  private gameSettings: PokerGameSettings;

  constructor(game: PokerGame, gameUpdate: PokerGameSettings) {
    this.game = game;
    this.gameSettings = gameUpdate;
  }

  /*
  {
    continent: {
      code: 'NA',
      geonameId: 6255149,
      names: {
        de: 'Nordamerika',
        en: 'North America',
        es: 'Norteamérica',
        fr: 'Amérique du Nord',
        ja: '北アメリカ',
        'pt-BR': 'América do Norte',
        ru: 'Северная Америка',
        'zh-CN': '北美洲'
      }
    },
    country: {
      geonameId: 6252001,
      isoCode: 'US',
      names: {
        de: 'Vereinigte Staaten',
        en: 'United States',
        es: 'Estados Unidos',
        fr: 'États Unis',
        ja: 'アメリカ',
        'pt-BR': 'EUA',
        ru: 'США',
        'zh-CN': '美国'
      }
    },
    maxmind: undefined,
    registeredCountry: {
      geonameId: 6252001,
      isoCode: 'US',
      names: {
        de: 'Vereinigte Staaten',
        en: 'United States',
        es: 'Estados Unidos',
        fr: 'États Unis',
        ja: 'アメリカ',
        'pt-BR': 'EUA',
        ru: 'США',
        'zh-CN': '美国'
      },
      isInEuropeanUnion: false
    },
    representedCountry: undefined,
    traits: {
      isAnonymous: false,
      isAnonymousProxy: false,
      isAnonymousVpn: false,
      isHostingProvider: false,
      isLegitimateProxy: false,
      isPublicProxy: false,
      isResidentialProxy: false,
      isSatelliteProvider: false,
      isTorExitNode: false,
      ipAddress: '73.60.143.27',
      network: '73.60.136.0/21'
    },
    city: { geonameId: 4930577, names: { en: 'Billerica', ja: 'ビレリカ' } },
    location: {
      accuracyRadius: 5,
      latitude: 42.5511,
      longitude: -71.256,
      metroCode: 506,
      timeZone: 'America/New_York'
    },
    postal: { code: '01821' },
    subdivisions: [ { geonameId: 6254926, isoCode: 'MA', names: [Object] } ]
  }
  */
  static getGeoLite2City(ip: string): any {
    const reader = Reader.openBuffer(dbBuffer);
    return reader.city(ip);
  }

  static getCity(ip: string): any {
    try {
      const data = LocationCheck.getGeoLite2City(ip);
      const continent = data.continent?.names?.en;
      const country = data.country?.names?.en;
      const city = data.city?.names?.en;
      let state = undefined;
      if (data.subdivisions && data.subdivisions.length > 0) {
        state = data.subdivisions[0].names?.en;
      }

      let postalCode = '';
      if (data.postal && data.postal.code) {
        postalCode = data.postal.code;
      }

      return {continent, country, state, city, postalCode};
    } catch (err) {
      logger.error(`Could not get city from IP: ${errToStr(err)}`);
      return undefined;
    }
  }

  public async check() {
    logger.info(
      `Location Check: Running location check on game  ${this.game.gameCode}`
    );

    // get active players in the game
    const playerGameTrackerRepo = getGameRepository(PlayerGameTracker);
    const playersInSeatsTemp = await playerGameTrackerRepo.find({
      game: {id: this.game.id},
      seatNo: Not(IsNull()),
    });

    const playersInSeats = _.keyBy(playersInSeatsTemp, 'playerUuid');

    const proxmityPlayersMap: any = {};
    const cachedPlayers = new Array<Player>();
    for (const playerInSeat of Object.values(playersInSeats)) {
      const cachedPlayer = await Cache.getPlayer(playerInSeat.playerUuid);
      cachedPlayers.push(cachedPlayer);
    }

    for (const cachedPlayer of cachedPlayers) {
      const playersInProxmity = await this.playersInProxmity(
        cachedPlayer,
        cachedPlayers
      );
      if (playersInProxmity.length > 0) {
        playersInProxmity.push(cachedPlayer);
        proxmityPlayersMap[cachedPlayer.uuid] = playersInProxmity;
      }
    }
    logger.debug(
      `Location Check: Game: [${this.game.gameCode}] ${
        Object.keys(proxmityPlayersMap).length
      } players are in proxmity`
    );
    const removePlayers = new Array<string>();
    if (Object.keys(proxmityPlayersMap).length > 0) {
      const now = new Date();
      for (const playerUuid of Object.keys(proxmityPlayersMap)) {
        const playersInProxmity = proxmityPlayersMap[
          playerUuid
        ] as Array<Player>;
        // we need to remove the players who have recently joined
        let longestPlayer: PlayerGameTracker | undefined;
        for (const player of playersInProxmity) {
          const playerInSeat = playersInSeats[player.uuid];
          // if this player is already in remove list, skip the player
          if (removePlayers.indexOf(player.uuid) !== -1) {
            continue;
          }
          if (!longestPlayer) {
            longestPlayer = playerInSeat;
          } else {
            if (playerInSeat.satAt && longestPlayer.satAt) {
              if (
                playerInSeat.satAt.getTime() < longestPlayer.satAt.getTime()
              ) {
                longestPlayer = playerInSeat;
              }
            }
          }
        }

        // add other players other than the one who played long enough
        if (longestPlayer) {
          const otherPlayers = _.filter(
            playersInProxmity,
            p => p.uuid !== longestPlayer?.playerUuid
          ).map(e => e.uuid);
          for (const removePlayer of otherPlayers) {
            if (removePlayers.indexOf(removePlayer) === -1) {
              removePlayers.push(...otherPlayers);
            }
          }
        }
      }
    }

    if (removePlayers.length > 0) {
      // remove these players from the game
      for (const playerUuid of removePlayers) {
        try {
          const player = await Cache.getPlayer(playerUuid);
          const takeBreak = new TakeBreak(this.game, player);
          await takeBreak.processPendingUpdate(null);
        } catch (err) {
          logger.error(
            `Game: [${this.game.gameCode}] Could not remove player ${playerUuid} from the table`
          );
        }
      }
    }
  }

  /*
  Returns players who are proxmity to the passed user.
  */
  protected async playersInProxmity(
    player: Player,
    playersInSeats: Array<Player>
  ): Promise<Array<Player>> {
    const ret = new Array<Player>();

    // check whether this player can sit in this game
    if (this.gameSettings.ipCheck) {
      const appSettings = getAppSettings();
      if (player.ipAddress) {
        const now = new Date();
        for (const player2 of playersInSeats) {
          if (player2.uuid === player.uuid) {
            // same player
            continue;
          }
          if (!player2.locationUpdatedAt) {
            continue;
          }

          // when was this player's location updated (should be recent)
          // const diff = Math.ceil(
          //   (now.getTime() - player2.locationUpdatedAt.getTime()) / 1000
          // );
          // if (diff > 2 * appSettings.ipGpsCheckInterval) {
          //   // stale location
          //   continue;
          // }

          if (player2.ipAddress) {
            if (player2.ipAddress === player.ipAddress) {
              logger.error(
                `Game: [${this.game.gameCode}] Player ${player2.name} has the same ip as player: ${player.name}. Ipaddres: ${player.ipAddress}`
              );
              ret.push(player2);
            }
          }
        }
      }
    }

    if (this.gameSettings.gpsCheck) {
      if (player.location) {
        // split the location first
        for (const player2 of playersInSeats) {
          if (player2.uuid === player.uuid) {
            // same player
            continue;
          }
          const playerInSeat = await Cache.getPlayer(player2.uuid);
          if (playerInSeat.location) {
            const distance = getDistanceInMeters(
              player.location.lat,
              player.location.long,
              playerInSeat.location.lat,
              playerInSeat.location.long
            );
            if (distance <= this.gameSettings.gpsAllowedDistance) {
              ret.push(player2);
            }
          }
        }
      }
    }
    return ret;
  }

  public async checkForOnePlayer(
    player: Player,
    ip: string,
    location: any,
    playersInSeats?: Array<PlayerGameTracker>,
    transactionEntityManager?: EntityManager
  ) {
    if (!playersInSeats) {
      // get active players in the game
      let playerGameTrackerRepo: Repository<PlayerGameTracker>;
      if (transactionEntityManager) {
        playerGameTrackerRepo =
          transactionEntityManager.getRepository(PlayerGameTracker);
      } else {
        playerGameTrackerRepo = getGameRepository(PlayerGameTracker);
      }
      playersInSeats = await playerGameTrackerRepo.find({
        game: {id: this.game.id},
        seatNo: Not(IsNull()),
      });
      playersInSeats = _.filter(playersInSeats, e => e.seatNo != 0);
    }

    // check whether this player can sit in this game
    if (this.gameSettings.ipCheck) {
      if (ip === undefined || ip === null || ip.length === 0) {
        throw new IpAddressMissingError(player.name);
      }
      const appSettings = getAppSettings();
      if (ip) {
        const now = new Date();
        for (const player2 of playersInSeats) {
          if (player2.playerUuid === player.uuid) {
            // same player
            continue;
          }
          const playerInSeat = await Cache.getPlayer(player2.playerUuid);
          if (!playerInSeat.locationUpdatedAt) {
            continue;
          }

          // when was this player's location updated (should be recent)
          const diff = Math.ceil(
            (now.getTime() - playerInSeat.locationUpdatedAt.getTime()) / 1000
          );
          if (diff > appSettings.ipGpsCheckInterval) {
            // stale location
            continue;
          }

          if (playerInSeat.ipAddress) {
            if (playerInSeat.ipAddress === ip) {
              logger.error(
                `Game: [${this.game.gameCode}] Player ${playerInSeat.name} has the same ip as player: ${player.name}. Ipaddres: ${ip}`
              );
              throw new SameIpAddressError(playerInSeat.name, player.name);
            }
          }
        }
      }
    }

    if (this.gameSettings.gpsCheck) {
      if (location) {
        // split the location first
        for (const player2 of playersInSeats) {
          const playerInSeat = await Cache.getPlayer(player2.playerUuid);
          if (player2.playerUuid === player.uuid) {
            continue;
          }
          if (playerInSeat.location) {
            const distance = getDistanceInMeters(
              location.lat,
              location.long,
              playerInSeat.location.lat,
              playerInSeat.location.long
            );
            logger.info(`Location Update: Player: ${
              player2.playerName
            } Location: ${JSON.stringify(location)} 
                Player2: ${playerInSeat.displayName} Location: ${JSON.stringify(
              location
            )} Distance: ${distance}`);
            if (distance <= this.gameSettings.gpsAllowedDistance) {
              throw new LocationPromixityError(playerInSeat.name, player.name);
            }
          }
        }
      }
    }
  }
}
