import * as yaml from 'js-yaml';
import * as fs from 'fs';
import {default as axios} from 'axios';
import {getClient} from '../tests/utils/utils';
import {gql} from 'apollo-boost';
import {ClubMemberStatus} from '../src/entity/club';

/*
This class runs game script and verifies results in different stages
*/
class GameScript {
  script: any;
  registeredPlayers: Record<string, any>;
  clubCreated: Record<string, any>;
  gameCreated: Record<string, any>;

  public log(logStr: string) {
    console.log(`[${this.scriptFile}] ${logStr}`);
  }

  constructor(protected serverURL: string, protected scriptFile: string) {
    this.registeredPlayers = {};
    this.clubCreated = {};
    this.gameCreated = {};
  }

  public load() {
    const cwd = __dirname;
    const filename = `${cwd}/${this.scriptFile}`;
    console.log('dir: ' + filename);
    const doc = yaml.safeLoad(fs.readFileSync(filename, 'utf8'));
    this.script = doc;
    this.scriptFile = filename;
  }

  public async run() {
    // cleanup
    await this.cleanup();

    // setup test
    await this.setup();

    //run a game
    await this.game();
  }

  protected async cleanup() {
    const cleanup = this.script['cleanup'];
    if (!cleanup) {
      return;
    }

    // run cleanup steps
    for (const step of cleanup['steps']) {
      if (step['delete-club']) {
        await this.deleteClub(step['delete-club']);
      }
    }
  }

  protected async setup() {
    const setup = this.script['setup'];
    if (!setup) {
      return;
    }

    for (const step of setup['steps']) {
      // run setup steps
      if (step['register-players']) {
        // register players
        await this.registerPlayers(step['register-players']);
      }
      if (step['create-club']) {
        await this.createClubs(step['create-club']);
      }
      if (step['join-club']) {
        await this.joinClubs(step['join-club']);
      }
      if (step['verify-club-members']) {
        await this.verifyClubMembers(step['verify-club-members']);
      }
      if (step['approve-club-members']) {
        await this.approveClubMembers(step['approve-club-members']);
      }
      if (step['create-game-server']) {
        await this.createGameServer(step['create-game-server']);
      }
    }
  }

  protected async game() {
    const game = this.script['game'];
    if (!game) {
      return;
    }

    // run game steps
    for (const step of game['steps']) {
      if (step['config']) {
        await this.startGames(step['config']);
      }
      if (step['sitsin']) {
        await this.playersSitsin(step['sitsin']);
      }
      if (step['buyin']) {
        await this.addBuyins(step['buyin']);
      }
      if (step['hands']) {
        await this.hands(step['hands']);
      }
      if (step['end-game']) {
        await this.endGame(step['end-game']);
      }
      if (step['verify-balance']) {
        await this.verifyBalances(step['verify-balance']);
      }
    }
  }

  protected async registerPlayers(params: any) {
    for (const playerInput of params) {
      const [playerUuid, playerId] = await this.registerPlayer(playerInput);
      this.registeredPlayers[playerInput.name] = {
        playerUuid: playerUuid,
        playerId: playerId,
      };
    }
  }

  protected async createClubs(params: any) {
    const [clubUuid, clubId] = await this.createClub(params);
    this.clubCreated = {
      owner: params.owner,
      clubId: clubId,
      clubUuid: clubUuid,
    };
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
    for (const membersInput of params.members) {
      await this.approveMember(params.owner, membersInput);
    }
  }

  protected async startGames(params: any) {
    const [gameUuid, gameId] = await this.startGame(params);
    this.gameCreated = {
      gameUuid: gameUuid,
      gameId: gameId,
    };
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

  protected async hands(params: any) {
    for (const handData of params) {
      if (handData['save']) {
        await this.saveHand(handData['save']);
      }
      // if(handData['verify-balance']) {
      //   await this.verifyBalances(handData['verify-balance']);
      // }
    }
  }

  protected async verifyBalances(balance: any) {
    if (balance['club']) {
      await this.verifyClubBalance(balance['club']);
    }
    if (balance['players']) {
      await this.verifyPlayerBalances(balance['players']);
    }
  }

  protected async verifyPlayerBalances(playersBalance: any) {
    for (const balance of playersBalance) {
      await this.verifyPlayerBalance(balance);
    }
  }

  protected async endGame(params: any) {
    const url = `${this.serverURL}/internal/game-ended`;
    const resp = await axios.post(url, {
      club_id: this.clubCreated.clubId,
      game_id: this.gameCreated.gameId,
    });
    this.log(`Game ${this.gameCreated.gameId} has been ended`);
  }

  protected async deleteClub(params: any) {
    // call internal REST API to delete the club
    const url = `${this.serverURL}/internal/delete-club-by-name/${params.name}`;
    this.log(url);
    await axios.post(url, {});
    this.log(`Club ${params.name} has been deleted`);
  }

  protected async registerPlayer(playerInput: any): Promise<any> {
    this.log(`Register player: ${JSON.stringify(playerInput)}`);

    const createPlayer = gql`
      mutation($input: PlayerCreateInput!) {
        playerId: createPlayer(player: $input)
      }
    `;
    const resp = await getClient().mutate({
      variables: {
        input: {
          name: playerInput.name,
          deviceId: playerInput.deviceId,
        },
      },
      mutation: createPlayer,
    });
    const playerId = resp.data.playerId;

    // get player by uuid (we need to get internal id for game/hand requests)
    const queryPlayer = gql`
      query {
        player: playerById {
          uuid
          id
          name
          lastActiveTime
        }
      }
    `;
    try {
      const playerResp = await getClient(playerId).query({
        variables: {
          playerId: resp.data.playerId,
        },
        query: queryPlayer,
      });
      return [playerResp.data.player.uuid, playerResp.data.player.id];
    } catch (err) {
      this.log(err.toString());
      throw err;
    }
  }

  protected async createClub(clubInput: any): Promise<any> {
    this.log(`Create Club: ${JSON.stringify(clubInput)}`);

    const createClubQuery = gql`
      mutation($input: ClubCreateInput!) {
        clubId: createClub(club: $input)
      }
    `;
    const resp = await getClient(
      this.registeredPlayers[clubInput.owner].playerUuid
    ).mutate({
      variables: {
        input: {
          name: clubInput.name,
          description: 'Poker players gather',
        },
      },
      mutation: createClubQuery,
    });

    // get club by uuid (we need to get internal id for game/hand requests)
    const queryClub = gql`
      query($clubId: String!) {
        club: clubById(clubId: $clubId) {
          id
        }
      }
    `;
    try {
      const clubResp = await getClient(
        this.registeredPlayers[clubInput.owner].playerUuid
      ).query({
        variables: {
          clubId: resp.data.clubId,
        },
        query: queryClub,
      });
      return [resp.data.clubId, clubResp.data.club.id];
    } catch (err) {
      this.log(err.toString());
      throw err;
    }
  }

  protected async joinClub(joinClubInput: any): Promise<any> {
    this.log(`Join Club: ${JSON.stringify(joinClubInput)}`);
    const joinClubQuery = gql`
      mutation($clubId: String!) {
        status: joinClub(clubId: $clubId)
      }
    `;
    await getClient(this.registeredPlayers[joinClubInput].playerUuid).mutate({
      variables: {
        clubId: this.clubCreated.clubUuid,
      },
      mutation: joinClubQuery,
    });
  }

  protected async verifyMember(memberInput: any): Promise<any> {
    this.log(`Verify Club Membres: ${JSON.stringify(memberInput)}`);
    const queryMemberStatus = gql`
      query($clubId: String!) {
        status: clubMemberStatus(clubId: $clubId) {
          id
          status
          isManager
          isOwner
          contactInfo
          ownerNotes
          lastGamePlayedDate
          joinedDate
          leftDate
          viewAllowed
          playAllowed
          createdAt
          updatedAt
        }
      }
    `;
    const resp = await getClient(
      this.registeredPlayers[memberInput.name].playerUuid
    ).query({
      variables: {
        clubId: this.clubCreated.clubUuid,
      },
      query: queryMemberStatus,
    });
    if (ClubMemberStatus[resp.data.status.status] != memberInput.status) {
      throw new Error(`${memberInput.name}'s status verification failed`);
    }
  }

  protected async approveMember(owner: string, memberInput: any): Promise<any> {
    this.log(`Approve Club Membres: ${JSON.stringify(memberInput)}`);
    const approveClubQuery = gql`
      mutation($clubId: String!, $playerUuid: String!) {
        status: approveMember(clubId: $clubId, playerUuid: $playerUuid)
      }
    `;
    await getClient(this.registeredPlayers[owner].playerUuid).mutate({
      variables: {
        clubId: this.clubCreated.clubUuid,
        playerUuid: this.registeredPlayers[memberInput].playerUuid,
      },
      mutation: approveClubQuery,
    });
  }

  protected async createGameServer(gameServer: any): Promise<any> {
    this.log(`Create game server: ${JSON.stringify(gameServer)}`);
    // call internal REST API to create a game server
    const url = `${this.serverURL}/internal/register-game-server`;
    await axios.post(url, gameServer).catch(err => {
      this.log('Game server already exists');
    });
  }

  protected async startGame(gameInput: any) {
    this.log(`Register game: ${JSON.stringify(gameInput)}`);
    const startGame = gql`
      mutation($clubId: String!, $gameInput: GameCreateInput!) {
        startedGame: startGame(clubId: $clubId, game: $gameInput) {
          gameId
        }
      }
    `;
    const resp = await getClient(
      this.registeredPlayers[this.clubCreated.owner].playerUuid
    ).mutate({
      variables: {
        gameInput: gameInput.input,
        clubId: this.clubCreated.clubUuid,
      },
      mutation: startGame,
    });

    // get game by uuid (we need to get internal id for game/hand requests)
    const queryGame = gql`
      query($gameId: String!) {
        game: gameById(gameId: $gameId) {
          id
        }
      }
    `;
    try {
      const gameResp = await getClient(
        this.registeredPlayers[this.clubCreated.owner].playerUuid
      ).query({
        variables: {
          gameId: resp.data.startedGame.gameId,
        },
        query: queryGame,
      });
      return [resp.data.startedGame.gameId, gameResp.data.game.id];
    } catch (err) {
      this.log(err.toString());
      throw err;
    }
  }

  protected async playerSitsin(sitsinInput: any): Promise<any> {
    this.log(`Player sits in: ${JSON.stringify(sitsinInput)}`);
    const messageInput = {
      clubId: this.clubCreated.clubId,
      playerId: this.registeredPlayers[sitsinInput.playerId].playerId,
      gameId: this.gameCreated.gameId,
      buyIn: sitsinInput.buyChips,
      status: 'PLAYING',
      seatNo: sitsinInput.seatNo,
    };

    try {
      await axios.post(
        `${this.serverURL}/internal/player-sit-in`,
        messageInput
      );
    } catch (err) {
      this.log(err.toString());
      throw err;
    }
  }

  protected async addBuyin(buyinInput: any): Promise<any> {
    this.log(`Buyin: ${JSON.stringify(buyinInput)}`);

    const buyChips = {
      clubId: this.clubCreated.clubId,
      playerId: this.registeredPlayers[buyinInput.playerId].playerId,
      gameId: this.gameCreated.gameId,
      buyChips: buyinInput.buyChips,
    };

    try {
      await axios.post(`${this.serverURL}/internal/buy-chips`, buyChips);
    } catch (err) {
      this.log(err.toString());
      throw err;
    }
  }

  protected async saveHand(handData: any): Promise<any> {
    this.log(`save hand: ${JSON.stringify(handData)}`);
    const saveHandData = handData;
    saveHandData.clubId = this.clubCreated.clubId;
    saveHandData.gameNum = this.gameCreated.gameId;
    for (var i = 0; i < handData.handResult.playersInSeats.length; i++) {
      if (handData.handResult.playersInSeats[i] !== 0) {
        saveHandData.handResult.playersInSeats[i] = this.registeredPlayers[
          handData.handResult.playersInSeats[i]
        ].playerId;
      }
    }
    for (var i = 0; i < handData.handResult.balanceAfterHand.length; i++) {
      saveHandData.handResult.balanceAfterHand[
        i
      ].playerId = this.registeredPlayers[
        handData.handResult.balanceAfterHand[i].playerId
      ].playerId;
    }
    try {
      await axios.post(`${this.serverURL}/internal/save-hand`, saveHandData);
    } catch (err) {
      this.log(err.toString());
      throw err;
    }
  }

  protected async verifyClubBalance(balance: any): Promise<any> {
    this.log(`verify club balance: ${JSON.stringify(balance)}`);
    const queryClubBalance = gql`
      query($clubId: String!) {
        balance: clubBalance(clubId: $clubId) {
          balance
          updatedAt
        }
      }
    `;
    const resp = await getClient(
      this.registeredPlayers[this.clubCreated.owner].playerUuid
    ).query({
      variables: {clubId: this.clubCreated.clubUuid},
      query: queryClubBalance,
    });
    if (resp.data.balance.balance != balance.balance) {
      this.log(
        `Expected ${balance.balance} but received ${resp.data.balance.balance}`
      );
      throw new Error('Club balance verification failed');
    }
  }

  protected async verifyPlayerBalance(balance: any): Promise<any> {
    this.log(`Verify player balance: ${JSON.stringify(balance)}`);
    const queryPlayerBalance = gql`
      query($playerId: String!, $clubId: String!) {
        balance: playerBalance(playerId: $playerId, clubId: $clubId) {
          totalBuyins
          totalWinnings
          balance
          notes
          updatedAt
        }
      }
    `;
    const resp = await getClient(
      this.registeredPlayers[balance.name].playerUuid
    ).query({
      variables: {
        clubId: this.clubCreated.clubUuid,
        playerId: this.registeredPlayers[balance.name].playerUuid,
      },
      query: queryPlayerBalance,
    });
    console.log(resp.data.balance);
    if (resp.data.balance.balance != balance.balance) {
      this.log(
        `Expected ${balance.balance} but received ${resp.data.balance.balance}`
      );
      throw new Error('Club balance verification failed');
    }
  }
}

const serverURL = 'http://localhost:9501';
const gameScript = new GameScript(serverURL, './script/allin.yaml');
gameScript.load();
gameScript.run();
