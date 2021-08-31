import {PlayerGameTracker} from '@src/entity/game/player_game_tracker';
import {PokerGame, PokerGameSettings} from '@src/entity/game/game';
import {Player} from '@src/entity/player/player';
import {getDistanceInMeters, utcTime} from '@src/utils';
import {getLogger} from '@src/utils/log';
import {IsNull, Not} from 'typeorm';
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
const logger = getLogger('takebreak');

export class LocationCheck {
  private game: PokerGame;
  private gameSettings: PokerGameSettings;

  constructor(game: PokerGame, gameUpdate: PokerGameSettings) {
    this.game = game;
    this.gameSettings = gameUpdate;
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
      //const cachedPlayer = await Cache.getPlayer(playerInSeat.playerUuid);
      logger.info(
        `Location Check: Player: ${cachedPlayer.name} ip: ${cachedPlayer.ipAddress}`
      );

      const playersInProxmity = await this.playersInProxmity(
        cachedPlayer,
        cachedPlayers
      );
      if (playersInProxmity.length > 0) {
        playersInProxmity.push(cachedPlayer);
        proxmityPlayersMap[cachedPlayer.uuid] = playersInProxmity;
      }
    }
    logger.info(
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
            if (playerInSeat.satAt.getTime() < longestPlayer.satAt.getTime()) {
              longestPlayer = playerInSeat;
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
          const diff = Math.ceil(
            (now.getTime() - player2.locationUpdatedAt.getTime()) / 1000
          );
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
    playersInSeats?: Array<PlayerGameTracker>
  ) {
    if (!playersInSeats) {
      // get active players in the game
      const playerGameTrackerRepo = getGameRepository(PlayerGameTracker);
      playersInSeats = await playerGameTrackerRepo.find({
        game: {id: this.game.id},
        seatNo: Not(IsNull()),
      });
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
            if (distance <= this.gameSettings.gpsAllowedDistance) {
              throw new LocationPromixityError(playerInSeat.name, player.name);
            }
          }
        }
      }
    }
  }
}
