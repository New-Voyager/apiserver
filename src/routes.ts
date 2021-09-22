import {GameServerAPI} from './internal/gameserver';
import {HandServerAPI} from './internal/hand';
import {GameAPI} from './internal/game';
import {AdminAPI} from './internal/admin';
import {timerCallback} from './repositories/timer';
import {
  buyBotCoins,
  generateBotScript,
  generateBotScriptDebugHand,
  resetServerSettings,
  setServerSettings,
  updateButtonPos,
} from './internal/bot';
import {restartTimers} from '@src/timer';
import {
  getRecoveryCode,
  login,
  loginUsingRecoveryCode,
  newlogin,
  signup,
} from './auth';
import {DevRepository} from './repositories/dev';
import {Firebase} from './firebase';
import {createPromotion, deleteAll, getAllPromotion} from './admin';
import {AdminRepository} from './repositories/admin';

export function addExternalRoutes(app: any) {
  app.post('/auth/login', login);
  app.post('/auth/new-login', newlogin);
  app.post('/auth/signup', signup);
  app.post('/auth/recovery-code', getRecoveryCode);
  app.post('/auth/login-recovery-code', loginUsingRecoveryCode);

  app.get('/nats-urls', natsUrls);
  app.get('/assets', getAssets);

  app.get('/bot-script/game-code/:gameCode/hand/:handNum', generateBotScript);
  app.get(
    '/bot-script/debug/game-code/:gameCode/hand/:handNum',
    generateBotScriptDebugHand
  );

  app.post(
    '/bot-script/game-code/:gameCode/button-pos/:buttonPos',
    updateButtonPos
  );
  app.post('/bot-script/server-settings', setServerSettings);
  app.post('/bot-script/reset-server-settings', resetServerSettings);
  app.post('/bot-script/buy-bot-coins', buyBotCoins);
}

export function addInternalRoutes(app: any) {
  app.get('/internal/ready', readyCheck);
  app.post('/internal/register-game-server', GameServerAPI.registerGameServer);
  app.post('/internal/update-game-server', GameServerAPI.updateGameServer);
  app.get('/internal/game-servers', GameServerAPI.getGameServers);
  app.post(
    '/internal/post-hand/gameId/:gameId/handNum/:handNum',
    HandServerAPI.postHand
  );
  app.post(
    '/internal/save-hand/gameId/:gameId/handNum/:handNum',
    HandServerAPI.saveHand
  );

  // app.post(
  //   '/internal/save-hand-binary/gameId/:gameId/handNum/:handNum',
  //   HandServerAPI.saveHandBinary
  // );
  app.post('/internal/start-game', GameAPI.startGame);
  app.post('/internal/delete-club-by-name/:clubName', AdminAPI.deleteClub);
  app.post('/internal/update-player-game-state', GameAPI.updatePlayerGameState);
  app.post('/internal/update-table-status', GameAPI.updateTableStatus);
  app.get(
    '/internal/any-pending-updates/gameId/:gameId',
    GameAPI.anyPendingUpdates
  );
  app.post(
    '/internal/process-pending-updates/gameId/:gameId',
    GameAPI.processPendingUpdates
  );
  app.get(
    '/internal/get-game-server/game_num/:gameCode',
    GameServerAPI.getSpecificGameServer
  );

  app.get(
    '/internal/get-game/club_id/:clubCode/game_num/:gameCode',
    GameAPI.getGame
  );

  app.get('/internal/game-info/game_num/:gameCode', GameAPI.getGameInfo);

  app.get(
    '/internal/next-hand-info/game_num/:gameCode',
    GameAPI.getNextHandInfo
  );

  app.post(
    '/internal/move-to-next-hand/game_num/:gameCode/hand_num/:currentHandNum',
    GameAPI.moveToNextHand
  );

  app.post(
    '/internal/timer-callback/gameId/:gameID/playerId/:playerID/purpose/:purpose',
    timerCallback
  );

  app.post('/internal/restart-games', GameServerAPI.restartGames);
  app.post('/internal/restart-timers', restartTimers);

  // admin apis
  app.get('/admin/feature-requests', DevRepository.featureRequests);
  app.get('/admin/bug-reports', DevRepository.bugReports);
  app.post('/admin/promotion', createPromotion);
  app.get('/admin/promotion', getAllPromotion);
  app.get('/admin/delete', deleteAll);
  app.post('/admin/post-process-games', GameAPI.aggregateGameData);
  app.post('/admin/set-max-games', GameServerAPI.setMaxGames);
}

// returns nats urls
async function natsUrls(req: any, resp: any) {
  let natsUrl = process.env.NATS_URL;
  if (process.env.EXTERNAL_NATS_URL) {
    natsUrl = process.env.EXTERNAL_NATS_URL;
  }
  resp.status(200).send(JSON.stringify({urls: natsUrl}));
}

// returns all assets from the firebase
async function getAssets(req: any, resp: any) {
  const assets = await Firebase.getAllAssets();
  resp.status(200).send(JSON.stringify({assets: assets}));
}

async function readyCheck(req: any, resp: any) {
  resp.status(200).send(JSON.stringify({status: 'OK'}));
}
