import {createConnection} from "typeorm";
import {Player} from "./entity/player";
import {Club, ClubMember} from "./entity/club";
import {PokerGame, PokerGamePlayers, PokerHand} from "./entity/game";

export async function initializeDB() {
  try{
    console.log("Initializing database");
    await createConnection({
              type: "postgres",
              host: "10.2.4.4",
              port: 5436,
              username: "game",
              password: "game",
              database: "game",
              entities: [
                Player,
                Club,
                ClubMember,
                PokerGame,
                PokerHand,
                PokerGamePlayers
              ],
              synchronize: true,
              logging: false
          });
    console.log("Database is initialized")
  } catch (err) {
    console.log(err)
    process.exit(1)
  }
}