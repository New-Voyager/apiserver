import {PlayerGameTracker} from '@src/entity/game/player_game_tracker';
import {PokerGame, PokerGameUpdates} from '@src/entity/game/game';
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
  private gameUpdate: PokerGameUpdates;

  constructor(game: PokerGame, gameUpdate: PokerGameUpdates) {
    this.game = game;
    this.gameUpdate = gameUpdate;
  }

  public async check() {
    // get active players in the game
    const playerGameTrackerRepo = getGameRepository(PlayerGameTracker);
    const playersInSeats = await playerGameTrackerRepo.find({
      game: {id: this.game.id},
      seatNo: Not(IsNull()),
    });
    const proxmityPlayersMap: any = {};
    for (const playerInSeat of playersInSeats) {
      const cachedPlayer = await Cache.getPlayer(playerInSeat.playerUuid);
      const playersInProxmity = await this.playersInProxmity(
        cachedPlayer,
        playersInSeats
      );
      if (playersInProxmity.length > 0) {
        playersInProxmity.push(playerInSeat);
        proxmityPlayersMap[playerInSeat.playerUuid] = playersInProxmity;
      }
    }
    logger.info(
      `Game: [${this.game.gameCode}] ${proxmityPlayersMap.length} players are in proxmity`
    );
    const removePlayers = new Array<string>();
    if (proxmityPlayersMap.length > 0) {
      const now = new Date();
      for (const playerUuid of proxmityPlayersMap) {
        const playersInProxmity = proxmityPlayersMap[
          playerUuid
        ] as Array<PlayerGameTracker>;
        // we need to remove the players who have recently joined
        let longestPlayer: PlayerGameTracker | undefined;
        for (const player of playersInProxmity) {
          // if this player is already in remove list, skip the player
          if (removePlayers.indexOf(player.playerUuid) !== -1) {
            continue;
          }
          if (!longestPlayer) {
            longestPlayer = player;
          } else {
            if (player.satAt.getTime() < longestPlayer.satAt.getTime()) {
              longestPlayer = player;
            }
          }
        }

        // add other players other than the one who played long enough
        if (longestPlayer) {
          const otherPlayers = _.filter(
            playersInProxmity,
            p => p.playerUuid !== longestPlayer?.playerUuid
          ).map(e => e.playerUuid);
          removePlayers.push(...otherPlayers);
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
    playersInSeats: Array<PlayerGameTracker>
  ): Promise<Array<PlayerGameTracker>> {
    const ret = new Array<PlayerGameTracker>();

    // check whether this player can sit in this game
    if (this.gameUpdate.ipCheck) {
      const appSettings = getAppSettings();
      if (player.ipAddress) {
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
            if (playerInSeat.ipAddress === player.ipAddress) {
              logger.error(
                `Game: [${this.game.gameCode}] Player ${playerInSeat.name} has the same ip as player: ${player.name}. Ipaddres: ${player.ipAddress}`
              );
              ret.push(player2);
            }
          }
        }
      }
    }

    if (this.gameUpdate.gpsCheck) {
      if (player.location) {
        // split the location first
        for (const player2 of playersInSeats) {
          const playerInSeat = await Cache.getPlayer(player2.playerUuid);
          if (playerInSeat.location) {
            const distance = getDistanceInMeters(
              player.location.lat,
              player.location.long,
              playerInSeat.location.lat,
              playerInSeat.location.long
            );
            if (distance <= this.gameUpdate.gpsAllowedDistance) {
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
    if (this.gameUpdate.ipCheck) {
      if (ip === null || ip.length === 0) {
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

    if (this.gameUpdate.gpsCheck) {
      if (location) {
        // split the location first
        for (const player2 of playersInSeats) {
          const playerInSeat = await Cache.getPlayer(player2.playerUuid);
          if (playerInSeat.location) {
            const distance = getDistanceInMeters(
              location.lat,
              location.long,
              playerInSeat.location.lat,
              playerInSeat.location.long
            );
            if (distance <= this.gameUpdate.gpsAllowedDistance) {
              throw new LocationPromixityError(playerInSeat.name, player.name);
            }
          }
        }
      }
    }
  }
}
