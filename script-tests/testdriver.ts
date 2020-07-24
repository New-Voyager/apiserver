import * as yaml from 'js-yaml';
import * as fs from 'fs';
import {default as axios} from 'axios';
import {getClient} from '../tests/utils/utils';
import {gql} from 'apollo-boost';

/*
This class runs game script and verifies results in different stages
*/
class GameScript {
  script: any;
  registeredPlayers: Record<string, any>;

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
    }
  }

  protected async registerPlayers(params: any) {
    for (const playerInput of params) {
      const player = await this.registerPlayer(playerInput);
      this.registeredPlayers[playerInput.name] = player;
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
      return playerResp.player;
    } catch (err) {
      this.log(err.toString());
      throw err;
    }
  }
}

const serverURL = 'http://localhost:9501';
const gameScript = new GameScript(serverURL, './script/allin.yaml');
gameScript.load();
gameScript.run();
