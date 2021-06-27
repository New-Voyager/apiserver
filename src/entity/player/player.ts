import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import {
  DbAwareColumn,
  DbAwareCreateDateColumn,
  DbAwareUpdateDateColumn,
} from '../dbaware';
import { GameType } from '../types';
import { Club } from './club';

@Entity()
export class Player {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column({unique: true})
  public uuid!: string;

  @Column()
  public name!: string;

  @Column({unique: true, nullable: true})
  public email!: string;

  @Column({nullable: true})
  public password!: string;

  @Index()
  @Column({name: 'device_id', unique: true, nullable: true})
  public deviceId!: string;

  @Index()
  @Column({name: 'firebase_token', nullable: true})
  public firebaseToken!: string;

  @Column({name: 'encryption_key', nullable: false})
  public encryptionKey!: string;

  @Column({name: 'is_active'})
  public isActive!: boolean;
  /**
   * DB insert time.
   */
  @DbAwareCreateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  public createdAt!: Date;

  /**
   * DB last update time.
   */
  @DbAwareUpdateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  public updatedAt!: Date;

  @Column({name: 'is_bot', nullable: true, default: false})
  public bot!: boolean;
}

@Entity({name: 'player_notes'})
export class PlayerNotes {
  @ManyToOne(() => Player, player => player.id, {primary: true})
  @JoinColumn({name: 'player1_id'})
  public player!: Player;

  @ManyToOne(() => Player, player => player.id, {primary: true})
  @JoinColumn({name: 'player2_id'})
  public notesToPlayer!: Player;

  @DbAwareColumn({name: 'notes', type: 'text'})
  public notes!: string;
}

@Entity({name: 'saved_hands'})
export class SavedHands {
  @PrimaryGeneratedColumn()
  public id!: number;

  @ManyToOne(() => Player, sharedBy => sharedBy.id, {
    nullable: true,
    eager: true,
  })
  @JoinColumn({name: 'shared_by'})
  public sharedBy!: Player;

  @ManyToOne(() => Player, savedBy => savedBy.id, {nullable: true, eager: true})
  @JoinColumn({name: 'saved_by'})
  public savedBy!: Player;

  @ManyToOne(() => Club, sharedTo => sharedTo.id, {nullable: true})
  @JoinColumn({name: 'shared_to'})
  public sharedTo!: Club;

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
