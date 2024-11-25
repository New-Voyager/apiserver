import * as yaml from 'js-yaml';
import * as fs from 'fs';
import {default as axios} from 'axios';
import {resetDatabase, mutationHelper, queryHelper} from './utils/utils';
import * as queries from './utils/queries';
import * as URL from './utils/APIPaths';
import { errToStr } from '@src/utils/log';

/*
This class runs game script and verifies results in different stages
*/
class GameScript {
  script: any;
  registeredPlayers: Record<string, any>;
  clubCreated: Record<string, any>;
  gameCreated: Record<string, any>;
  rewardIds: Record<string, any>;
  disabled: boolean;

  public log(logStr: string) {
    console.log(`[${this.scriptFile}] ${logStr}`);
  }

  constructor(protected serverURL: string, protected scriptFile: string) {
    this.registeredPlayers = {};
    this.clubCreated = {};
    this.gameCreated = {};
    this.rewardIds = {};
    this.disabled = false;
  }

  public isDisabled(): boolean {
    return this.disabled;
  }

  public load() {
    const filename = this.scriptFile;
    console.log(
      '\n---------------------------------------------------------------------\n'
    );
    console.log('dir: ' + filename);
    console.log(
      '\n---------------------------------------------------------------------\n'
    );
    const doc = yaml.safeLoad(fs.readFileSync(filename, 'utf8'));
    this.script = doc;
    this.scriptFile = filename;

    if (this.script['test']) {
      const config = this.script['test'];
      if (config['disabled'] === true) {
        this.disabled = true;
      }
    }
  }

  /////////////////////// Main Run Function

  public async run() {
    // cleanup
    await this.cleanup();

    // setup test
    await this.setup();

    //run a game
    await this.game();
  }

  /////////////////////// Include Functions

  protected async getIncludeFile(fileName) {
    const myArgs = process.argv.slice(2);
    let scriptDir = `${__dirname}/script`;
    if (myArgs.length > 0) {
      scriptDir = myArgs[0];
    }
    console.log(`Script directory: ${scriptDir}/utils/${fileName}`);
    const doc = yaml.safeLoad(
      fs.readFileSync(`${scriptDir}/utils/${fileName}`, 'utf8')
    );
    return doc;
  }

  protected async cleanupInclude(cleanup) {
    if (!cleanup) {
      return;
    }

    // run cleanup steps
    for (const step of cleanup['steps']) {
      if (step['delete-clubs']) {
        await this.deleteClubs(step['delete-clubs']);
      }
    }
  }

  protected async setupInclude(setup) {
    if (!setup) {
      return;
    }

    for (const step of setup['steps']) {
      // run setup steps
      if (step['register-players']) {
        await this.registerPlayers(step['register-players']);
      }
      if (step['create-clubs']) {
        await this.createClubs(step['create-clubs']);
      }
      if (step['join-clubs']) {
        await this.joinClubs(step['join-clubs']);
      }
      if (step['verify-club-members']) {
        await this.verifyClubMembers(step['verify-club-members']);
      }
      if (step['approve-club-members']) {
        await this.approveClubMembers(step['approve-club-members']);
      }
      if (step['deny-club-members']) {
        await this.denyClubMembers(step['deny-club-members']);
      }
      if (step['create-game-servers']) {
        await this.createGameServers(step['create-game-servers']);
      }
    }
  }

  protected async gameInclude(game) {
    if (!game) {
      return;
    }

    // run game steps
    for (const step of game['steps']) {
      if (step['error']) {
        let flag = false;
        try {
          await this.gameInclude(step['error']);
          flag = true;
        } catch (error) {
          this.log('error case successfully verified');
        }
        if (flag) throw new Error('error case not satisfied');
      }
      if (step['configure-games']) {
        await this.configureGames(step['configure-games']);
      }
      if (step['sitsin']) {
        await this.playersSitsin(step['sitsin']);
      }
      if (step['buyin']) {
        await this.addBuyins(step['buyin']);
      }
      if (step['start-games']) {
        await this.startGames(step['start-games']);
      }
      if (step['verify-club-game-stack']) {
        await this.verifyClubGameStacks(step['verify-club-game-stack']);
      }
      if (step['verify-player-game-stack']) {
        await this.verifyPlayerGameStacks(step['verify-player-game-stack']);
      }
      if (step['verify-player-game-status']) {
        await this.verifyPlayersGameStatus(step['verify-player-game-status']);
      }
      if (step['save-hands']) {
        await this.saveHands(step['save-hands']);
      }
      if (step['end-games']) {
        await this.endGames(step['end-games']);
      }
      if (step['verify-club-balance']) {
        await this.verifyClubBalances(step['verify-club-balance']);
      }
      if (step['verify-player-balance']) {
        await this.verifyPlayerBalances(step['verify-player-balance']);
      }
      if (step['messages']) {
        await this.sendClubMessages(step['messages']);
      }
      if (step['process-pending-updates']) {
        await this.processPendingUpdates(step['process-pending-updates']);
      }
      if (step['reload']) {
        await this.reloadChips(step['reload']);
      }
      if (step['update-club-members']) {
        await this.updateClubMembers(step['update-club-members']);
      }
      if (step['live-games']) {
        await this.liveGames(step['live-games']);
      }
      if (step['request-seat-change']) {
        await this.requestSeatChanges(step['request-seat-change']);
      }
      if (step['seat-change-requests']) {
        await this.seatChangeRequests(step['seat-change-requests']);
      }
      if (step['confirm-seat-change']) {
        await this.confirmSeatChanges(step['confirm-seat-change']);
      }
      if (step['sleep']) {
        await this.sleep(step['sleep'].time);
      }
      if (step['timer-callback']) {
        await this.timerCallbacks(step['timer-callback']);
      }
      if (step['players-seat-info']) {
        await this.playerSeatInfos(step['players-seat-info']);
      }
      if (step['add-to-waitinglist']) {
        await this.addToWaitinglists(step['add-to-waitinglist']);
      }
      if (step['remove-from-waitinglist']) {
        await this.removeFromWaitinglists(step['remove-from-waitinglist']);
      }
      if (step['waiting-list']) {
        await this.waitingLists(step['waiting-list']);
      }
      if (step['apply-waitinglist-order']) {
        await this.applyWaitinglistOrders(step['apply-waitinglist-order']);
      }
      if (step['leave-game']) {
        await this.leaveGames(step['leave-game']);
      }
    }
  }

  /////////////////////// Level 1 Functions

  protected async cleanup() {
    const cleanup = this.script['cleanup'];
    if (!cleanup) {
      return;
    }

    // run cleanup steps
    for (const step of cleanup['steps']) {
      if (step['include']) {
        const data = await this.getIncludeFile(step['include'].script);
        if (data) {
          await this.cleanupInclude(data['cleanup']);
        }
      }
    }

    await this.cleanupInclude(cleanup);
  }

  protected async setup() {
    const setup = this.script['setup'];
    if (!setup) {
      return;
    }

    for (const step of setup['steps']) {
      // run setup steps
      if (step['include']) {
        const data = await this.getIncludeFile(step['include'].script);
        if (data) {
          await this.setupInclude(data['setup']);
        }
      }
    }

    await this.setupInclude(setup);
  }

  protected async game() {
    const game = this.script['game'];
    if (!game) {
      return;
    }

    // run game steps
    for (const step of game['steps']) {
      if (step['include']) {
        const data = await this.getIncludeFile(step['include'].script);
        if (data) {
          await this.gameInclude(data['game']);
        }
      }
    }

    await this.gameInclude(game);
  }

  /////////////////////// Level 2 Functions

  protected sleep(ms: number) {
    return new Promise(resolve => {
      setTimeout(resolve, ms);
    });
  }

  protected async deleteClubs(params: any) {
    for (const clubName of params) {
      await this.deleteClub(clubName);
    }
  }

  protected async registerPlayers(params: any) {
    for (const playerInput of params) {
      const [playerUuid, playerId, token] = await this.registerPlayer(
        playerInput
      );
      this.registeredPlayers[playerInput.name] = {
        playerUuid: playerUuid,
        playerId: playerId,
        token: token,
      };
    }
  }

  protected async createClubs(params: any) {
    for (const clubInput of params) {
      const [clubCode, clubId] = await this.createClub(clubInput);
      this.clubCreated[clubInput.name] = {
        owner: clubInput.owner,
        clubId: clubId,
        clubCode: clubCode,
      };
    }
  }

  protected async joinClubs(params: any) {
    for (const joinClubInput of params) {
      await this.joinClub(joinClubInput);
    }
  }

  protected async verifyClubMembers(params: any) {
    for (const membersInput of params) {
      await this.verifyMember(membersInput);
    }
  }

  protected async approveClubMembers(params: any) {
    for (const membersInput of params) {
      await this.approveMember(membersInput);
    }
  }

  protected async denyClubMembers(params: any) {
    for (const membersInput of params) {
      await this.denyMember(membersInput);
    }
  }

  protected async createGameServers(params: any) {
    for (const serverInput of params) {
      await this.createGameServer(serverInput);
    }
  }

  protected async configureGames(params: any) {
    for (const gameInput of params) {
      const [gameCode, gameId] = await this.configureGame(gameInput);
      this.gameCreated[gameInput.game] = {
        club: gameInput.club,
        gameCode: gameCode,
        gameId: gameId,
      };
    }
  }

  protected async playersSitsin(params: any) {
    for (const sitsinInput of params) {
      await this.playerSitsin(sitsinInput);
    }
  }

  protected async addBuyins(params: any) {
    for (const BuyinsInput of params) {
      await this.addBuyin(BuyinsInput);
    }
  }

  protected async verifyClubGameStacks(params: any) {
    for (const clubStack of params) {
      await this.verifyClubGameStack(clubStack);
    }
  }

  protected async verifyPlayerGameStacks(params: any) {
    for (const playerStack of params) {
      await this.verifyPlayerGameStack(playerStack);
    }
  }

  protected async verifyPlayersGameStatus(params: any) {
    for (const playerStatus of params) {
      await this.verifyPlayerGameStatus(playerStatus);
    }
  }

  protected async startGames(params: any) {
    for (const startGameInput of params) {
      await this.startGame(startGameInput);
    }
  }

  protected async saveHands(params: any) {
    for (const handData of params) {
      await this.saveHand(handData);
    }
  }

  protected async endGames(params: any) {
    for (const endGameInput of params) {
      await this.endGame(endGameInput);
    }
  }

  protected async verifyClubBalances(clubsBalance: any) {
    for (const balance of clubsBalance) {
      await this.verifyClubBalance(balance);
    }
  }

  protected async verifyPlayerBalances(playersBalance: any) {
    for (const balance of playersBalance) {
      await this.verifyPlayerBalance(balance);
    }
  }

  protected async sendClubMessages(params: any) {
    for (const club of params) {
      await this.sendClubMessagesForClub(club);
    }
  }

  protected async processPendingUpdates(params: any) {
    for (const pendingUpdate of params) {
      await this.processPendingUpdate(pendingUpdate);
    }
  }

  protected async reloadChips(params: any) {
    for (const chips of params) {
      await this.reloadChip(chips);
    }
  }

  protected async updateClubMembers(params: any) {
    for (const updateData of params) {
      await this.updateClubMember(updateData);
    }
  }

  protected async liveGames(params: any) {
    for (const games of params) {
      await this.liveGame(games);
    }
  }

  protected async requestSeatChanges(params: any) {
    for (const data of params) {
      await this.requestSeatChange(data);
    }
  }

  protected async seatChangeRequests(params: any) {
    for (const data of params) {
      await this.seatChangeRequest(data);
    }
  }

  protected async confirmSeatChanges(params: any) {
    for (const data of params) {
      await this.confirmSeatChange(data);
    }
  }

  protected async timerCallbacks(params: any) {
    for (const data of params) {
      await this.timerCallback(data);
    }
  }

  protected async playerSeatInfos(params: any) {
    for (const data of params) {
      await this.playerSeatInfo(data);
    }
  }

  protected async addToWaitinglists(params: any) {
    for (const data of params) {
      await this.addToWaitinglist(data);
    }
  }

  protected async removeFromWaitinglists(params: any) {
    for (const data of params) {
      await this.removeFromWaitinglist(data);
    }
  }

  protected async waitingLists(params: any) {
    for (const data of params) {
      await this.waitingList(data);
    }
  }

  protected async applyWaitinglistOrders(params: any) {
    for (const data of params) {
      await this.applyWaitinglistOrder(data);
    }
  }

  protected async leaveGames(params: any) {
    for (const data of params) {
      await this.leaveGame(data);
    }
  }

  /////////////////////// Level 3 Functions

  protected async deleteClub(params: any) {
    // call internal REST API to delete the club
    try {
      const url = `${this.serverURL}${URL.deleteClubByName}/${params.name}`;
      this.log(url);
      await axios.post(url, {});
      this.log(`Club ${params.name} has been deleted`);
    } catch (err) {
      this.log(errToStr(err));
    }
  }

  protected async registerPlayer(playerInput: any): Promise<any> {
    this.log(`Register player: ${JSON.stringify(playerInput)}`);
    try {
      const variables = {
        input: {
          name: playerInput.name,
          deviceId: playerInput.deviceId,
          email: `${playerInput.name}@poker.net`,
          password: playerInput.name,
        },
      };
      const resp = await mutationHelper(variables, queries.createPlayer);
      const playerId = resp.data.playerId;

      const token = await this.loginPlayerWithUuid({
        uuid: playerId,
        deviceId: playerInput.deviceId,
        name: playerInput.name,
      });

      const playerResp = await queryHelper(
        {playerId: resp.data.playerId},
        queries.getPlayer,
        token
      );
      return [playerResp.data.player.uuid, playerResp.data.player.id, token];
    } catch (err) {
      this.log(errToStr(err));
      throw err;
    }
  }

  protected async loginPlayerWithUuid(params: any) {
    // call internal REST API to delete the club
    try {
      const url = `${this.serverURL}${URL.authLogin}`;
      this.log(url);
      const resp = await axios.post(url, {
        uuid: params.uuid,
        'device-id': params.deviceId,
      });
      this.log(`player ${params.name} has logged in successfully`);
      return resp.data.jwt;
    } catch (err) {
      this.log(errToStr(err));
      throw err;
    }
  }

  protected async createClub(clubInput: any): Promise<any> {
    this.log(`Create Club: ${JSON.stringify(clubInput)}`);
    try {
      const resp = await mutationHelper(
        {
          input: {
            name: clubInput.name,
            description: 'Poker players gather',
          },
        },
        queries.createClub,
        this.registeredPlayers[clubInput.owner].token
      );

      // get club by uuid (we need to get internal id for game/hand requests)
      const clubResp = await queryHelper(
        {clubCode: resp.data.clubCode},
        queries.getClub,
        this.registeredPlayers[clubInput.owner].token
      );
      return [resp.data.clubCode, clubResp.data.club.id];
    } catch (err) {
      this.log(errToStr(err));
      throw err;
    }
  }

  protected async joinClub(joinClubInput: any): Promise<any> {
    this.log(`Join Club: ${JSON.stringify(joinClubInput)}`);
    try {
      for (const member of joinClubInput.members) {
        await mutationHelper(
          {
            clubCode: this.clubCreated[joinClubInput.club].clubCode,
          },
          queries.joinClub,
          this.registeredPlayers[member].token
        );
      }
    } catch (err) {
      this.log(errToStr(err));
      throw err;
    }
  }

  protected async verifyMember(memberInput: any): Promise<any> {
    this.log(`Verify Club Membres: ${JSON.stringify(memberInput)}`);
    try {
      for (const member of memberInput.members) {
        const resp = await queryHelper(
          {
            clubCode: this.clubCreated[memberInput.club].clubCode,
            playerUuid: this.registeredPlayers[member.name].playerUuid,
          },
          queries.clubMemberStatus,
          this.registeredPlayers[member.name].token
        );
        if (resp.data.status[0].status != member.status) {
          throw new Error(
            `${member.name}'s status verification failed. Expected: ${member.status} Received: ${resp.data.status[0].status}`
          );
        }
      }
    } catch (err) {
      this.log(errToStr(err));
      throw err;
    }
  }

  protected async approveMember(memberInput: any): Promise<any> {
    this.log(`Approve Club Membres: ${JSON.stringify(memberInput)}`);
    try {
      for (const member of memberInput.members) {
        await mutationHelper(
          {
            clubCode: this.clubCreated[memberInput.club].clubCode,
            playerUuid: this.registeredPlayers[member].playerUuid,
          },
          queries.approveClubMember,
          this.registeredPlayers[this.clubCreated[memberInput.club].owner].token
        );
      }
    } catch (err) {
      this.log(errToStr(err));
      throw err;
    }
  }

  protected async denyMember(memberInput: any): Promise<any> {
    this.log(`Deny Club Membres: ${JSON.stringify(memberInput)}`);
    try {
      for (const member of memberInput.members) {
        await mutationHelper(
          {
            clubCode: this.clubCreated[memberInput.club].clubCode,
            playerUuid: this.registeredPlayers[member].playerUuid,
          },
          queries.rejectClubMember,
          this.registeredPlayers[this.clubCreated[memberInput.club].owner].token
        );
      }
    } catch (err) {
      this.log(errToStr(err));
      throw err;
    }
  }

  protected async createGameServer(gameServer: any): Promise<any> {
    this.log(`Create game server: ${JSON.stringify(gameServer)}`);
    // call internal REST API to create a game server
    const url = `${this.serverURL}${URL.registerGameServer}`;
    await axios.post(url, gameServer).catch(err => {
      this.log('Game server already exists');
    });
  }

  protected async createReward(input: any) {
    this.log(`Create Reward: ${JSON.stringify(input)}`);
    try {
      const response = await mutationHelper(
        {
          clubCode: this.clubCreated[input.club].clubCode,
          input: input.reward,
        },
        queries.createReward,
        this.registeredPlayers[this.clubCreated[input.club].owner].token
      );
      return response.data.rewardId;
    } catch (err) {
      this.log(JSON.stringify(err));
      throw err;
    }
  }

  protected async configureGame(gameInput: any) {
    this.log(`Register game: ${JSON.stringify(gameInput)}`);
    try {
      const rewardId = await this.createReward({
        club: gameInput.club,
        reward: gameInput.reward,
      });
      gameInput.input.rewardIds = [rewardId];

      const resp = await mutationHelper(
        {
          gameInput: gameInput.input,
          clubCode: this.clubCreated[gameInput.club].clubCode,
        },
        queries.configureGame,
        this.registeredPlayers[this.clubCreated[gameInput.club].owner].token
      );

      // get game by uuid (we need to get internal id for game/hand requests)
      const gameResp = await queryHelper(
        {
          gameCode: resp.data.configuredGame.gameCode,
        },
        queries.getGame,
        this.registeredPlayers[this.clubCreated[gameInput.club].owner].token
      );
      this.log(`Game code: ${resp.data.configuredGame.gameCode}`);
      this.rewardIds[gameInput.game] = {
        ids: gameInput.input.rewardIds,
      };
      return [resp.data.configuredGame.gameCode, gameResp.data.game.id];
    } catch (err) {
      this.log(errToStr(err));
      throw err;
    }
  }

  protected async playerSitsin(sitsinInput: any): Promise<any> {
    this.log(`Players sits in: ${JSON.stringify(sitsinInput)}`);
    try {
      for (const player of sitsinInput.players) {
        await mutationHelper(
          {
            gameCode: this.gameCreated[sitsinInput.game].gameCode,
            seatNo: player.seatNo,
          },
          queries.joinGame,
          this.registeredPlayers[player.playerId].token
        );
      }
    } catch (err) {
      this.log(JSON.stringify(err));
      throw err;
    }
  }

  protected async addBuyin(buyinInput: any): Promise<any> {
    this.log(`Buyin: ${JSON.stringify(buyinInput)}`);
    try {
      for (const player of buyinInput.players) {
        await mutationHelper(
          {
            gameCode: this.gameCreated[buyinInput.game].gameCode,
            amount: player.buyChips,
          },
          queries.buyIn,
          this.registeredPlayers[player.playerId].token
        );
      }
    } catch (err) {
      this.log(JSON.stringify(err));
      throw err;
    }
  }

  protected async verifyClubGameStack(balance: any): Promise<any> {
    this.log(`verify club stack: ${JSON.stringify(balance)}`);
    try {
      const resp = await queryHelper(
        {
          gameCode: this.gameCreated[balance.game].gameCode,
        },
        queries.clubGameRake,
        this.registeredPlayers[this.clubCreated[balance.club].owner].token
      );
      if (resp.data.balance !== balance.balance) {
        this.log(
          `Expected ${balance.balance} but received ${resp.data.balance}`
        );
        throw new Error('Club stack verification failed');
      }
    } catch (err) {
      this.log(errToStr(err));
      throw err;
    }
  }

  protected async verifyPlayerGameStack(balance: any): Promise<any> {
    this.log(`Verify player stack: ${JSON.stringify(balance)}`);
    try {
      const resp = await queryHelper(
        {
          gameCode: this.gameCreated[balance.game].gameCode,
        },
        queries.playersInSeats,
        this.registeredPlayers[this.clubCreated[balance.club].owner].token
      );
      const playerInSeats: Array<any> =
        resp.data.seatInfo.seatInfo.playersInSeats;
      for (const player of balance.players) {
        const receivedPlayer = await playerInSeats.find(
          element => element.name == player.name
        );
        if (!receivedPlayer) {
          this.log(`Player ${player} not found in ${playerInSeats}`);
          throw new Error('Player stack verification failed');
        }
        if (player.balance != receivedPlayer.stack) {
          this.log(
            `Expected ${player.balance} but received ${receivedPlayer.stack}`
          );
          throw new Error('Player stack verification failed');
        }
      }
    } catch (err) {
      this.log(errToStr(err));
      throw err;
    }
  }

  protected async verifyPlayerGameStatus(status: any): Promise<any> {
    this.log(`Verify player status: ${JSON.stringify(status)}`);
    try {
      const resp = await queryHelper(
        {
          gameCode: this.gameCreated[status.game].gameCode,
        },
        queries.playersInSeats,
        this.registeredPlayers[this.clubCreated[status.club].owner].token
      );
      const playerInSeats: Array<any> =
        resp.data.seatInfo.seatInfo.playersInSeats;
      for (const player of status.players) {
        const receivedPlayer = await playerInSeats.find(
          element => element.name == player.name
        );
        if (!receivedPlayer) {
          this.log(`Player ${player} not found in ${playerInSeats}`);
          throw new Error('Player status verification failed');
        }
        if (player.status != receivedPlayer.status) {
          this.log(
            `Expected ${player.status} but received ${receivedPlayer.status}`
          );
          throw new Error('Player status verification failed');
        }
      }
    } catch (err) {
      this.log(errToStr(err));
      throw err;
    }
  }

  protected async startGame(input: any): Promise<any> {
    this.log(`Start game: ${JSON.stringify(input)}`);
    try {
      await mutationHelper(
        {
          gameCode: this.gameCreated[input.game].gameCode,
        },
        queries.startGame,
        this.registeredPlayers[this.clubCreated[input.club].owner].token
      );
      const url = `${this.serverURL}${URL.updateTableStatus}`;
      await axios.post(url, {
        gameId: this.gameCreated[input.game].gameId,
        status: 'GAME_RUNNING',
      });
    } catch (err) {
      this.log(JSON.stringify(err));
      throw err;
    }
  }

  protected async saveHand(handData: any): Promise<any> {
    this.log(`save hand: ${JSON.stringify(handData)}`);
    const saveHandData = JSON.parse(JSON.stringify(handData));
    saveHandData.clubId = this.clubCreated[handData.clubId].clubId;
    saveHandData.gameId = this.gameCreated[handData.gameId].gameId;
    saveHandData.rewardTrackingIds = this.rewardIds[handData.gameId].ids;
    for (const i of Object.keys(saveHandData.players)) {
      saveHandData.players[i].id = this.registeredPlayers[
        saveHandData.players[i].id
      ].playerId;
    }
    try {
      await axios.post(
        `${this.serverURL}${URL.saveHand}/gameId/${saveHandData.gameId}/handNum/${saveHandData.handNum}`,
        saveHandData
      );
    } catch (err) {
      this.log(errToStr(err));
      throw err;
    }
  }

  protected async endGame(params: any) {
    this.log(`endgame: ${JSON.stringify(params)}`);
    try {
      await mutationHelper(
        {gameCode: this.gameCreated[params.game].gameCode},
        queries.endGame,
        this.registeredPlayers[this.clubCreated[params.club].owner].token
      );
      this.log(`Game ${[params.game]} has been ended`);
    } catch (err) {
      this.log(errToStr(err));
      throw err;
    }
  }

  protected async verifyClubBalance(balance: any): Promise<any> {
    this.log(`verify club balance: ${JSON.stringify(balance)}`);
    try {
      const resp = await queryHelper(
        {clubCode: this.clubCreated[balance.club].clubCode},
        queries.clubBalance,
        this.registeredPlayers[this.clubCreated[balance.club].owner].token
      );
      if (resp.data.balance.balance !== balance.balance) {
        this.log(
          `Expected ${balance.balance} but received ${resp.data.balance.balance}`
        );
        throw new Error('Club balance verification failed');
      }
    } catch (err) {
      this.log(errToStr(err));
      throw err;
    }
  }

  protected async verifyPlayerBalance(balance: any): Promise<any> {
    this.log(`Verify player balance: ${JSON.stringify(balance)}`);
    try {
      const resp = await queryHelper(
        {
          clubCode: this.clubCreated[balance.club].clubCode,
          playerId: this.registeredPlayers[balance.player].playerUuid,
        },
        queries.playerBalance,
        this.registeredPlayers[balance.player].token
      );
      if (resp.data.balance.balance !== balance.balance) {
        this.log(
          `Expected ${balance.balance} but received ${resp.data.balance.balance}`
        );
        throw new Error('Player balance verification failed');
      }
    } catch (err) {
      this.log(errToStr(err));
      throw err;
    }
  }

  protected async sendClubMessagesForClub(club: any) {
    this.log(`Send club messages: ${JSON.stringify(club)}`);
    const clubCode = this.clubCreated[club.club].clubCode;
    const messages = club.messages;
    for (const message of messages) {
      let token;
      let messageText;
      for (const key of Object.keys(message)) {
        messageText = message[key];
        token = this.registeredPlayers[key].token;
        break;
      }
      await mutationHelper(
        {clubCode: clubCode, text: messageText},
        queries.sendMessage,
        token
      );
    }
  }

  protected async processPendingUpdate(update: any) {
    this.log(`Process pending updates for: ${JSON.stringify(update)}`);
    const url = `${this.serverURL}${URL.processPendingUpdates}/gameId/${
      this.gameCreated[update.game].gameId
    }`;
    try {
      await axios.post(url);
    } catch (err) {
      this.log(JSON.stringify(err));
      throw err;
    }
  }

  protected async reloadChip(chips: any) {
    this.log(`Reload chips for: ${JSON.stringify(chips)}`);
    try {
      for (const chip of chips.players) {
        await mutationHelper(
          {
            gameCode: this.gameCreated[chips.game].gameCode,
            amount: chip.amount,
          },
          queries.reload,
          this.registeredPlayers[chip.name].token
        );
      }
    } catch (err) {
      this.log(JSON.stringify(err));
      throw err;
    }
  }

  protected async updateClubMember(updateData: any) {
    this.log(`update club members: ${JSON.stringify(updateData)}`);
    try {
      for (const data of updateData.players) {
        await mutationHelper(
          {
            clubCode: this.clubCreated[updateData.club].clubCode,
            playerUuid: this.registeredPlayers[data.name].playerUuid,
            update: data.update,
          },
          queries.updateClubMember,
          this.registeredPlayers[this.clubCreated[updateData.club].owner].token
        );
      }
    } catch (err) {
      this.log(JSON.stringify(err));
      throw err;
    }
  }

  protected async liveGame(games: any): Promise<any> {
    this.log(`Verify live games: ${JSON.stringify(games)}`);
    try {
      const resp = await queryHelper(
        {
          clubCode: this.clubCreated[games.club].clubCode,
        },
        queries.liveGames,
        this.registeredPlayers[this.clubCreated[games.club].owner].token
      );
      if (resp.data.games.length !== games.input.length) {
        this.log(
          `Expected ${games.input.length} live games but received ${resp.data.games.length}`
        );
        throw new Error('Live games verification failed');
      }
      for (const game of games.input) {
        const receivedGame = await resp.data.games.find(
          element => element.title == game.game
        );
        if (!receivedGame) {
          this.log(`Game ${game} not found in ${resp.data.games}`);
          throw new Error('Live games verification failed');
        }
        if (game.gameType != receivedGame.gameType) {
          this.log(
            `Expected ${game.gameType} but received ${receivedGame.gameType}`
          );
          throw new Error('Live games verification failed');
        }
        if (game.tableCount != receivedGame.tableCount) {
          this.log(
            `Expected ${game.tableCount} but received ${receivedGame.tableCount}`
          );
          throw new Error('Live games verification failed');
        }
      }
    } catch (err) {
      this.log(errToStr(err));
      throw err;
    }
  }

  protected async requestSeatChange(updateData: any) {
    this.log(`Request seat change: ${JSON.stringify(updateData)}`);
    try {
      for (const data of updateData.players) {
        await mutationHelper(
          {
            gameCode: this.gameCreated[updateData.game].gameCode,
          },
          queries.requestSeatChange,
          this.registeredPlayers[data].token
        );
      }
    } catch (err) {
      this.log(JSON.stringify(err));
      throw err;
    }
  }

  protected async seatChangeRequest(updateData: any) {
    this.log(`Seat change requests: ${JSON.stringify(updateData)}`);
    try {
      const resp = await queryHelper(
        {
          gameCode: this.gameCreated[updateData.game].gameCode,
        },
        queries.seatChangeRequests,
        this.registeredPlayers[this.clubCreated[updateData.club].owner].token
      );
      if (resp.data.players.length !== updateData.players.length) {
        this.log(
          `Expected ${updateData.input.length} players but received ${resp.data.players.length}`
        );
        throw new Error('seat change verification failed');
      }
      for (const data of updateData.players) {
        const receivedPlayer = await resp.data.players.find(
          element => element.name == data
        );
        if (!receivedPlayer) {
          this.log(`player ${data} not found in ${resp.data.players}`);
          throw new Error('Seat change verification failed');
        }
      }
    } catch (err) {
      this.log(JSON.stringify(err));
      throw err;
    }
  }

  protected async confirmSeatChange(updateData: any) {
    this.log(`Confirm seat change: ${JSON.stringify(updateData)}`);
    try {
      for (const data of updateData.players) {
        await mutationHelper(
          {
            gameCode: this.gameCreated[updateData.game].gameCode,
            seatNo: data.seat,
          },
          queries.confirmSeatChange,
          this.registeredPlayers[data.name].token
        );
      }
    } catch (err) {
      this.log(JSON.stringify(err));
      throw err;
    }
  }

  protected async timerCallback(update: any) {
    this.log(`Timer callback for: ${JSON.stringify(update)}`);
    const url = `${this.serverURL}${URL.timerCallback}/gameId/${
      this.gameCreated[update.game].gameId
    }/playerId/${
      this.registeredPlayers[this.clubCreated[update.club].owner].playerId
    }/purpose/${update.purpose}`;
    try {
      await axios.post(url);
    } catch (err) {
      this.log(JSON.stringify(err));
      throw err;
    }
  }

  protected async playerSeatInfo(status: any): Promise<any> {
    this.log(`Verify player seat info: ${JSON.stringify(status)}`);
    try {
      const resp = await queryHelper(
        {
          gameCode: this.gameCreated[status.game].gameCode,
        },
        queries.playersInSeats,
        this.registeredPlayers[this.clubCreated[status.club].owner].token
      );
      const playerInSeats: Array<any> =
        resp.data.seatInfo.seatInfo.playersInSeats;
      for (const player of status.players) {
        const receivedPlayer = await playerInSeats.find(
          element => element.name == player.name
        );
        if (!receivedPlayer) {
          this.log(`Player ${player} not found in ${playerInSeats}`);
          throw new Error('Player status verification failed');
        }
        if (player.seatNo != receivedPlayer.seatNo) {
          this.log(
            `Expected ${player.seatNo} but received ${receivedPlayer.seatNo}`
          );
          throw new Error('Player status verification failed');
        }
      }
    } catch (err) {
      this.log(errToStr(err));
      throw err;
    }
  }

  protected async addToWaitinglist(updateData: any) {
    this.log(`Add players to waiting list: ${JSON.stringify(updateData)}`);
    try {
      for (const data of updateData.players) {
        await mutationHelper(
          {
            gameCode: this.gameCreated[updateData.game].gameCode,
          },
          queries.addToWaitingList,
          this.registeredPlayers[data].token
        );
      }
    } catch (err) {
      this.log(JSON.stringify(err));
      throw err;
    }
  }

  protected async waitingList(updateData: any) {
    this.log(`Verify waiting list: ${JSON.stringify(updateData)}`);
    try {
      const resp = await queryHelper(
        {
          gameCode: this.gameCreated[updateData.game].gameCode,
        },
        queries.waitingList,
        this.registeredPlayers[this.clubCreated[updateData.club].owner].token
      );
      if (resp.data.players.length !== updateData.players.length) {
        this.log(
          `Expected ${updateData.input.length} players but received ${resp.data.players.length}`
        );
        throw new Error('waitlist verification failed');
      }
      for (const data of updateData.players) {
        const receivedPlayer = await resp.data.players.find(
          element => element.name == data.name
        );
        if (!receivedPlayer) {
          this.log(`player ${data.name} not found in ${resp.data.players}`);
          throw new Error('waitlist verification failed');
        }
        if (receivedPlayer.waitlistNum !== data.waitlistNum) {
          this.log(
            `expected ${receivedPlayer.waitlistNum} but received ${data.waitlistNum}`
          );
          throw new Error('waitlist verification failed');
        }
      }
    } catch (err) {
      this.log(JSON.stringify(err));
      throw err;
    }
  }

  protected async leaveGame(updateData: any) {
    this.log(`player leaves a game: ${JSON.stringify(updateData)}`);
    try {
      for (const data of updateData.players) {
        await mutationHelper(
          {
            gameCode: this.gameCreated[updateData.game].gameCode,
          },
          queries.leaveGame,
          this.registeredPlayers[data].token
        );
      }
    } catch (err) {
      this.log(JSON.stringify(err));
      throw err;
    }
  }

  protected async removeFromWaitinglist(updateData: any) {
    this.log(`Remove players from waiting list: ${JSON.stringify(updateData)}`);
    try {
      for (const data of updateData.players) {
        await mutationHelper(
          {
            gameCode: this.gameCreated[updateData.game].gameCode,
          },
          queries.removeFromWaitingList,
          this.registeredPlayers[data].token
        );
      }
    } catch (err) {
      this.log(JSON.stringify(err));
      throw err;
    }
  }

  protected async applyWaitinglistOrder(updateData: any) {
    this.log(`Apply waitlist order: ${JSON.stringify(updateData)}`);
    try {
      const players = new Array<string>();
      for (const data of updateData.players) {
        players.push(this.registeredPlayers[data].playerUuid);
      }
      await mutationHelper(
        {
          gameCode: this.gameCreated[updateData.game].gameCode,
          playerUuid: players,
        },
        queries.applyWaitlistOrder,
        this.registeredPlayers[this.clubCreated[updateData.club].owner].token
      );
    } catch (err) {
      this.log(JSON.stringify(err));
      throw err;
    }
  }
}

async function main() {
  const myArgs = process.argv.slice(2);
  let scriptDir = `${__dirname}/script/`;
  if (myArgs.length > 0) {
    scriptDir = myArgs[0];
  }
  console.log(`Script directory: ${scriptDir}`);

  const list = fs.readdirSync(scriptDir);
  for (const file of list) {
    if (file.endsWith('.yaml')) {
      try {
        await resetDatabase();
        const gameScript1 = new GameScript(URL.server, `${scriptDir}/${file}`);
        gameScript1.load();
        if (gameScript1.isDisabled()) {
          console.log(`Script: ${file} is marked as disabled`);
          continue;
        }
        await gameScript1.run();
      } catch (err) {
        console.log(
          `Setting up script ${file} failed. Error: ${errToStr(err)}`
        );
        throw err;
      }
    }
  }
}

(async () => {
  await main();
})();
