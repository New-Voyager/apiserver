import {Column, Entity, ManyToOne, PrimaryGeneratedColumn} from 'typeorm';
import {DbAwareUpdateDateColumn} from '../dbaware';
import {GameType} from '../types';

@Entity({name: 'debug_hands'})
export class DebugHands {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column({name: 'shared_by_player_id', type: 'int'})
  public sharedById!: number;

  @Column({name: 'shared_by_player_name'})
  public sharedByName!: string;

  @Column({name: 'shared_by_player_uuid'})
  public sharedByUuid!: string;

  @Column({name: 'game_code'})
  public gameCode!: string;

  @Column({name: 'game_type'})
  public gameType!: GameType;

  @Column({name: 'hand_num', type: 'int'})
  public handNum!: number;

  @Column({name: 'data', type: 'text'})
  public data!: string;

  @DbAwareUpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  public updatedAt!: Date;
}
