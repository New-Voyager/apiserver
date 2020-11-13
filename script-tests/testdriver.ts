import * as yaml from 'js-yaml';
import * as fs from 'fs';
import {default as axios} from 'axios';
import {getClient} from '../tests/utils/utils';
import {gql} from 'apollo-boost';
import {ClubMemberStatus} from '../src/entity/types';

/*
This class runs game script and verifies results in different stages
*/
class GameScript {
  script: any;
  registeredPlayers: Record<string, any>;
  clubCreated: Record<string, any>;
  gameCreated: Record<string, any>;
  disabled: boolean;

  public log(logStr: string) {
    console.log(`[${this.scriptFile}] ${logStr}`);
  }

  constructor(protected serverURL: string, protected scriptFile: string) {
    this.registeredPlayers = {};
    this.clubCreated = {};
    this.gameCreated = {};
    this.disabled = false;
  }

  public isDisabled(): boolean {
    return this.disabled;
  }

  public load() {
    const cwd = __dirname;
    //const filename = `${cwd}/${this.scriptFile}`;
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

  /////////////////////// Level 1 Functions

  protected async cleanup() {
    const cleanup = this.script['cleanup'];
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
      if (step['create-game-servers']) {
        await this.createGameServers(step['create-game-servers']);
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
    }
  }

  /////////////////////// Level 2 Functions

  protected async deleteClubs(params: any) {
    for (const clubName of params) {
      await this.deleteClub(clubName);
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

  protected async startGames(params: any) {
    for (const startGameInput of params) {
      await this.startGame(startGameInput);
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

  /////////////////////// Level 3 Functions

  protected async deleteClub(params: any) {
    // call internal REST API to delete the club
    try {
      const url = `${this.serverURL}/internal/delete-club-by-name/${params.name}`;
      this.log(url);
      await axios.post(url, {});
      this.log(`Club ${params.name} has been deleted`);
    } catch (err) {
      this.log(err.toString());
    }
  }

  protected async registerPlayer(playerInput: any): Promise<any> {
    this.log(`Register player: ${JSON.stringify(playerInput)}`);
    try {
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
            email: `${playerInput.name}@poker.net`,
            password: playerInput.name,
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
    try {
      const createClubQuery = gql`
        mutation($input: ClubCreateInput!) {
          clubCode: createClub(club: $input)
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
        query($clubCode: String!) {
          club: clubById(clubCode: $clubCode) {
            id
          }
        }
      `;
      const clubResp = await getClient(
        this.registeredPlayers[clubInput.owner].playerUuid
      ).query({
        variables: {
          clubCode: resp.data.clubCode,
        },
        query: queryClub,
      });
      return [resp.data.clubCode, clubResp.data.club.id];
    } catch (err) {
      this.log(err.toString());
      throw err;
    }
  }

  protected async joinClub(joinClubInput: any): Promise<any> {
    this.log(`Join Club: ${JSON.stringify(joinClubInput)}`);
    try {
      const joinClubQuery = gql`
        mutation($clubCode: String!) {
          status: joinClub(clubCode: $clubCode)
        }
      `;
      for (const member of joinClubInput.members) {
        await getClient(this.registeredPlayers[member].playerUuid).mutate({
          variables: {
            clubCode: this.clubCreated[joinClubInput.club].clubCode,
          },
          mutation: joinClubQuery,
        });
      }
    } catch (err) {
      this.log(err.toString());
      throw err;
    }
  }

  protected async verifyMember(memberInput: any): Promise<any> {
    this.log(`Verify Club Membres: ${JSON.stringify(memberInput)}`);
    try {
      const queryMemberStatus = gql`
        query($clubCode: String!) {
          status: clubMemberStatus(clubCode: $clubCode) {
            status
          }
        }
      `;
      for (const member of memberInput.members) {
        const resp = await getClient(
          this.registeredPlayers[member.name].playerUuid
        ).query({
          variables: {
            clubCode: this.clubCreated[memberInput.club].clubCode,
          },
          query: queryMemberStatus,
        });
        if (ClubMemberStatus[resp.data.status.status] != member.status) {
          throw new Error(
            `${member.name}'s status verification failed. Expected: ${
              member.status
            } Received: ${ClubMemberStatus[resp.data.status.status]}`
          );
        }
      }
    } catch (err) {
      this.log(err.toString());
      throw err;
    }
  }

  protected async approveMember(memberInput: any): Promise<any> {
    this.log(`Approve Club Membres: ${JSON.stringify(memberInput)}`);
    try {
      const approveClubQuery = gql`
        mutation($clubCode: String!, $playerUuid: String!) {
          status: approveMember(clubCode: $clubCode, playerUuid: $playerUuid)
        }
      `;
      for (const member of memberInput.members) {
        await getClient(
          this.registeredPlayers[this.clubCreated[memberInput.club].owner]
            .playerUuid
        ).mutate({
          variables: {
            clubCode: this.clubCreated[memberInput.club].clubCode,
            playerUuid: this.registeredPlayers[member].playerUuid,
          },
          mutation: approveClubQuery,
        });
      }
    } catch (err) {
      this.log(err.toString());
      throw err;
    }
  }

  protected async createGameServer(gameServer: any): Promise<any> {
    this.log(`Create game server: ${JSON.stringify(gameServer)}`);
    // call internal REST API to create a game server
    const url = `${this.serverURL}/internal/register-game-server`;
    await axios.post(url, gameServer).catch(err => {
      this.log('Game server already exists');
    });
  }

  protected async configureGame(gameInput: any) {
    this.log(`Register game: ${JSON.stringify(gameInput)}`);
    try {
      const configureGame = gql`
        mutation($clubCode: String!, $gameInput: GameCreateInput!) {
          configuredGame: configureGame(clubCode: $clubCode, game: $gameInput) {
            gameCode
          }
        }
      `;
      const resp = await getClient(
        this.registeredPlayers[this.clubCreated[gameInput.club].owner]
          .playerUuid
      ).mutate({
        variables: {
          gameInput: gameInput.input,
          clubCode: this.clubCreated[gameInput.club].clubCode,
        },
        mutation: configureGame,
      });

      // get game by uuid (we need to get internal id for game/hand requests)
      const queryGame = gql`
        query($gameCode: String!) {
          game: gameById(gameCode: $gameCode) {
            id
          }
        }
      `;
      const gameResp = await getClient(
        this.registeredPlayers[this.clubCreated[gameInput.club].owner]
          .playerUuid
      ).query({
        variables: {
          gameCode: resp.data.configuredGame.gameCode,
        },
        query: queryGame,
      });
      console.log(`Game code: ${resp.data.configuredGame.gameCode}`);
      return [resp.data.configuredGame.gameCode, gameResp.data.game.id];
    } catch (err) {
      this.log(err.toString());
      throw err;
    }
  }

  protected async startGame(input: any): Promise<any> {
    this.log(`Start game: ${JSON.stringify(input)}`);

    try {
      const query = gql`
        mutation($gameCode: String!) {
          startGame(gameCode: $gameCode)
        }
      `;
      const club = this.clubCreated[input.club]
      const gameCode = this.gameCreated[input.game].gameCode;
      const client = await getClient(
        this.registeredPlayers[club.owner].playerUuid
      );
      await client.mutate({
        variables: {
          gameCode: gameCode,
        },
        mutation: query,
      });
    } catch (err) {
      this.log(JSON.stringify(err));
      throw err;
    }
  }

  protected async startGameOld(input: any): Promise<any> {
    this.log(`Start game: ${JSON.stringify(input)}`);
    try {
      const clubId = this.clubCreated[input.club].clubId;
      const gameId = this.gameCreated[input.game].gameId;
      const url = `${this.serverURL}/internal/start-game/club_id/${clubId}/game_id/${gameId}`;
      const resp = await axios.post(
        `${this.serverURL}/internal/start-game?club-id=${clubId}&game-id=${gameId}`
      );
    } catch (err) {
      if (err.response && err.response.data) {
        this.log(err.response.data);
      }
      this.log(err.toString());
      throw err;
    }
  }

  protected async playerSitsin(sitsinInput: any): Promise<any> {
    this.log(`Players sits in: ${JSON.stringify(sitsinInput)}`);
    try {
      const query = gql`
        mutation($gameCode: String!, $seatNo: Int!) {
          joinGame(gameCode: $gameCode, seatNo: $seatNo)
        }
      `;
      //console.log(this.registeredPlayers);
      //console.log(sitsinInput.players);
      for (const player of sitsinInput.players) {
        const client = await getClient(
          this.registeredPlayers[player.playerId].playerUuid
        );
        await client.mutate({
          variables: {
            gameCode: this.gameCreated[sitsinInput.game].gameCode,
            seatNo: player.seatNo,
          },
          mutation: query,
        });
      }
    } catch (err) {
      this.log(JSON.stringify(err));
      throw err;
    }
  }

  protected async playerSitsinOld(sitsinInput: any): Promise<any> {
    this.log(`Players sits in: ${JSON.stringify(sitsinInput)}`);
    try {
      for (const player of sitsinInput.players) {
        const messageInput = {
          clubId: this.clubCreated[sitsinInput.club].clubId,
          playerId: this.registeredPlayers[player.playerId].playerId,
          gameId: this.gameCreated[sitsinInput.game].gameId,
          buyIn: player.buyChips,
          status: 'PLAYING',
          seatNo: player.seatNo,
        };
        await axios.post(
          `${this.serverURL}/internal/player-sit-in`,
          messageInput
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
      const query = gql`
        mutation($gameCode: String!, $amount: Float!) {
          buyIn(gameCode: $gameCode, amount: $amount)
        }
      `;
      console.log(this.registeredPlayers);
      console.log(buyinInput.players);
      for (const player of buyinInput.players) {
        const client = await getClient(
          this.registeredPlayers[player.playerId].playerUuid
        );
        await client.mutate({
          variables: {
            gameCode: this.gameCreated[buyinInput.game].gameCode,
            amount: player.buyChips,
          },
          mutation: query,
        });
      }
    } catch (err) {
      this.log(JSON.stringify(err));
      throw err;
    }
  }

  protected async addBuyinOld(buyinInput: any): Promise<any> {
    this.log(`Buyin: ${JSON.stringify(buyinInput)}`);
    try {
      for (const player of buyinInput.players) {
        const buyChips = {
          clubId: this.clubCreated[buyinInput.club].clubId,
          playerId: this.registeredPlayers[player.playerId].playerId,
          gameId: this.gameCreated[buyinInput.game].gameId,
          buyChips: player.buyChips,
        };
        const resp = await axios.post(
          `${this.serverURL}/internal/buy-chips`,
          buyChips
        );
      }
    } catch (err) {
      if (err.response && err.response.data) {
        this.log(err.response.data);
      }
      this.log(err.toString());
      throw err;
    }
  }

  protected async verifyClubGameStack(balance: any): Promise<any> {
    this.log(`verify club stack: ${JSON.stringify(balance)}`);
    const queryClubTrack = gql`
      query($clubCode: String!, $gameCode: String!) {
        balance: clubGameRake(clubCode: $clubCode, gameCode: $gameCode) {
          rake
          promotion
          lastHandNum
        }
      }
    `;
    try {
      const resp = await getClient(
        this.registeredPlayers[this.clubCreated[balance.club].owner].playerUuid
      ).query({
        variables: {
          clubCode: this.clubCreated[balance.club].clubCode,
          gameCode: this.gameCreated[balance.game].gameCode,
        },
        query: queryClubTrack,
      });
      if (resp.data.balance.rake !== balance.balance) {
        this.log(
          `Expected ${balance.balance} but received ${resp.data.balance.rake}`
        );
        throw new Error('Club stack verification failed');
      }
    } catch (err) {
      this.log(err.toString());
      throw err;
    }
  }

  protected async verifyPlayerGameStack(balance: any): Promise<any> {
    this.log(`Verify player stack: ${JSON.stringify(balance)}`);
    const queryPlayerTrack = gql`
      query($playerId: String!, $clubCode: String!, $gameCode: String!) {
        balance: playerGametrack(
          clubCode: $clubCode
          gameCode: $gameCode
          playerId: $playerId
        ) {
          buyIn
          stack
          seatNo
          noOfBuyins
          hhRank
          hhHandNum
        }
      }
    `;
    try {
      for (const player of balance.players) {
        const resp = await getClient(
          this.registeredPlayers[player.name].playerUuid
        ).query({
          variables: {
            playerId: this.registeredPlayers[player.name].playerUuid,
            clubCode: this.clubCreated[balance.club].clubCode,
            gameCode: this.gameCreated[balance.game].gameCode,
          },
          query: queryPlayerTrack,
        });
        if (resp.data.balance.stack != player.balance) {
          this.log(
            `Expected ${player.balance} but received ${resp.data.balance.stack}`
          );
          throw new Error('Player stack verification failed');
        }
      }
    } catch (err) {
      this.log(err.toString());
      throw err;
    }
  }

  protected async saveHand(handData: any): Promise<any> {
    this.log(`save hand: ${JSON.stringify(handData)}`);
    const saveHandData = handData;
    saveHandData.clubId = this.clubCreated[handData.clubId].clubId;
    saveHandData.gameNum = this.gameCreated[handData.gameNum].gameId;
    for (let i = 0; i < handData.handResult.playersInSeats.length; i++) {
      if (handData.handResult.playersInSeats[i] !== 0) {
        saveHandData.handResult.playersInSeats[i] = this.registeredPlayers[
          handData.handResult.playersInSeats[i]
        ].playerId;
      }
    }
    for (let i = 0; i < handData.handResult.balanceAfterHand.length; i++) {
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

  protected async endGame(params: any) {
    try {
      const url = `${this.serverURL}/internal/game-ended`;
      const resp = await axios.post(url, {
        club_id: this.clubCreated[params.club].clubId,
        game_id: this.gameCreated[params.game].gameId,
      });
      this.log(`Game ${[params.game]} has been ended`);
    } catch (err) {
      this.log(err.toString());
      throw err;
    }
  }

  protected async verifyClubBalance(balance: any): Promise<any> {
    this.log(`verify club balance: ${JSON.stringify(balance)}`);
    const queryClubBalance = gql`
      query($clubCode: String!) {
        balance: clubBalance(clubCode: $clubCode) {
          balance
          updatedAt
        }
      }
    `;
    try {
      const resp = await getClient(
        this.registeredPlayers[this.clubCreated[balance.club].owner].playerUuid
      ).query({
        variables: {clubCode: this.clubCreated[balance.club].clubCode},
        query: queryClubBalance,
      });
      if (resp.data.balance.balance !== balance.balance) {
        this.log(
          `Expected ${balance.balance} but received ${resp.data.balance.balance}`
        );
        throw new Error('Club balance verification failed');
      }
    } catch (err) {
      this.log(err.toString());
      throw err;
    }
  }

  protected async verifyPlayerBalance(balance: any): Promise<any> {
    this.log(`Verify player balance: ${JSON.stringify(balance)}`);
    const queryPlayerBalance = gql`
      query($playerId: String!, $clubCode: String!) {
        balance: playerBalance(playerId: $playerId, clubCode: $clubCode) {
          totalBuyins
          totalWinnings
          balance
          notes
          updatedAt
        }
      }
    `;
    try {
      const resp = await getClient(
        this.registeredPlayers[balance.player].playerUuid
      ).query({
        variables: {
          clubCode: this.clubCreated[balance.club].clubCode,
          playerId: this.registeredPlayers[balance.player].playerUuid,
        },
        query: queryPlayerBalance,
      });
      if (resp.data.balance.balance !== balance.balance) {
        this.log(
          `Expected ${balance.balance} but received ${resp.data.balance.balance}`
        );
        throw new Error('Player balance verification failed');
      }
    } catch (err) {
      this.log(err.toString());
      throw err;
    }
  }

  protected async sendClubMessages(params: any) {
    for (const club of params) {
      await this.sendClubMessagesForClub(club);
    }
  }

  protected async sendClubMessagesForClub(club: any) {
    const sendMessage = gql`
      mutation($clubCode: String!, $text: String) {
        resp: sendClubMessage(
          clubCode: $clubCode
          message: {messageType: TEXT, text: $text}
        )
      }
    `;
    const clubCode = this.clubCreated[club.club].clubCode;
    const messages = club.messages;
    for (const message of messages) {
      let playerId;
      let messageText;
      for (const key of Object.keys(message)) {
        messageText = message[key];
        playerId = this.registeredPlayers[key].playerUuid;
        break;
      }
      const resp = await getClient(playerId).mutate({
        variables: {clubCode: clubCode, text: messageText},
        mutation: sendMessage,
      });
    }
  }
}

async function resetDatabase() {
  const resetDB = gql`
    mutation {
      resetDB
    }
  `;
  const resp = await getClient().mutate({
    mutation: resetDB,
  });
}

async function main() {
  const myArgs = process.argv.slice(2);
  let scriptDir = `${__dirname}/script/`;
  if (myArgs.length > 0) {
    scriptDir = myArgs[0];
  }
  console.log(`Script directory: ${scriptDir}`);

  const list = fs.readdirSync(scriptDir);
  await resetDatabase();
  for (const file of list) {
    if (file.endsWith('.yaml')) {
      try {
        const gameScript1 = new GameScript(serverURL, `${scriptDir}/${file}`);
        gameScript1.load();
        if (gameScript1.isDisabled()) {
          console.log(`Script: ${file} is marked as disabled`);
          continue;
        }
        await gameScript1.run();
      } catch (err) {
        console.log(
          `Setting up script ${file} failed. Error: ${err.toString()}`
        );
        throw err;
      }
    }
  }
}

const serverURL = 'http://localhost:9501';
(async () => {
  await main();
})();
