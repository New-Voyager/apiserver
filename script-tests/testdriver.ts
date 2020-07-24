import * as yaml from 'js-yaml';
import * as fs from 'fs';
import {default as axios} from 'axios';
import {getClient} from '../tests/utils/utils';
import {gql} from 'apollo-boost';
import {ClubMemberStatus} from '../src/entity/club';
import {queryClubMembers} from '../tests/utils/club.testutils';

/*
This class runs game script and verifies results in different stages
*/
class GameScript {
  script: any;
  registeredPlayers: Record<string, any>;
  createdClub: any;

  public log(logStr: string) {
    console.log(`[${this.scriptFile}] ${logStr}`);
  }

  constructor(protected serverURL: string, protected scriptFile: string) {
    this.registeredPlayers = {};
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
    }
  }

  protected async registerPlayers(params: any) {
    for (const playerInput of params) {
      const player = await this.registerPlayer(playerInput);
      this.registeredPlayers[playerInput.name] = player;
    }
  }

  protected async createClubs(params: any) {
    const club = await this.createClub(params);
    this.createdClub = club;
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
          internalId: id
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
      return playerResp.data.player.uuid;
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
      this.registeredPlayers[clubInput.owner]
    ).mutate({
      variables: {
        input: {
          name: clubInput.name,
          description: 'Poker players gather',
        },
      },
      mutation: createClubQuery,
    });
    return resp.data.clubId;
  }

  protected async joinClub(joinClubInput: any): Promise<any> {
    this.log(`Join Club: ${JSON.stringify(joinClubInput)}`);
    const joinClubQuery = gql`
      mutation($clubId: String!) {
        status: joinClub(clubId: $clubId)
      }
    `;
    await getClient(this.registeredPlayers[joinClubInput]).mutate({
      variables: {
        clubId: this.createdClub,
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
      this.registeredPlayers[memberInput.name]
    ).query({
      variables: {
        clubId: this.createdClub,
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
    await getClient(this.registeredPlayers[owner]).mutate({
      variables: {
        clubId: this.createdClub,
        playerUuid: this.registeredPlayers[memberInput],
      },
      mutation: approveClubQuery,
    });
  }
}

const serverURL = 'http://localhost:9501';
const gameScript = new GameScript(serverURL, './script/allin.yaml');
gameScript.load();
gameScript.run();
