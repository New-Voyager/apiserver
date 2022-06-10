import { Cache } from '@src/cache/index';
import { sendEmail } from '@src/email';
import { PokerGame } from '@src/entity/game/game';
import { getAppSettings } from '@src/firebase';
import { errToStr, getLogger } from '@src/utils/log';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const humanizeDuration = require('humanize-duration');

const logger = getLogger('resolvers::util');

export async function isHostOrManagerOrOwner(
  playerUuid: string,
  game: PokerGame
): Promise<boolean> {
  // is the player host
  const host = game.hostUuid === playerUuid;
  if (host) {
    return true;
  }

  if (game.clubCode) {
    const clubMember = await Cache.getClubMember(playerUuid, game.clubCode);
    if (!clubMember) {
      logger.error(
        `Player: ${playerUuid} is not a club member in club ${game.clubName}`
      );
      return false;
    }

    if (!host) {
      if (clubMember.isManager || clubMember.isOwner) {
        logger.info(
          `Player: ${playerUuid} is either a manager or club owner of the ${game.clubName}`
        );
        return true;
      } else {
        logger.error(
          `Player: ${playerUuid} is not a owner or a manager ${game.clubName}. Cannot make rearrange seats`
        );
        return false;
      }
    }
  }
  return false;
}

const resolvers: any = {
  Query: {

  },
  Mutation: {
    sendGameLink: async (parent, args, ctx, info) => {
      return sendGameLink(args.gameCode, args.emails);
    },
  },

};

export function getResolvers() {
  return resolvers;
}

export function getSessionTimeStr(totalSeconds: number): string {
  if (totalSeconds < 60) {
    // "## seconds"
    return humanizeDuration(totalSeconds * 1000);
  }
  if (totalSeconds < 3600) {
    // "## minutes"
    return humanizeDuration(totalSeconds * 1000, { units: ['m'], round: true });
  }
  // "## hours"
  return humanizeDuration(totalSeconds * 1000, { units: ['h'], round: true });
}

async function sendGameLink(gameCode: string, emails: string[]): Promise<boolean> {
  const url: string = `${getAppSettings().appUrl}/#/game/${gameCode}`;
  const to = emails.join(',');
  const from = `contact.poker.clubapp@gmail.com`;
  const bodyHtml = `<p>Hi,</p>` + `<p>You can join the game by clicking the link below:</p>` + `<p><a href="${url}">${url}</a></p>` + `<p>Regards,</p>` + `<p>Poker Club</p>`;
  sendEmail(to, from, 'Game Invitation', '', bodyHtml).catch(err => {
    logger.error(`Failed to send game invitation. Error: ${errToStr(err)}`);
    return false;
  });

  return true;
}
