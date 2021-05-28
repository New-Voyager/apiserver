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
} from './dbaware';

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
