import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  JoinColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import {
  DbAwareColumn,
  DbAwareCreateDateColumn,
  DbAwareUpdateDateColumn,
} from './dbaware';
import {Player} from './player';
import {ClubMemberStatus, ClubStatus} from './types';

@Entity()
export class Club {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column()
  public name!: string;

  @Column({name: 'club_code', unique: true})
  public clubCode!: string;

  @Column()
  public description!: string;

  @Column()
  public status!: ClubStatus;

  @Column({
    name: 'balance',
    type: 'decimal',
    precision: 8,
    scale: 2,
    default: 0,
  })
  public balance!: number;

  @DbAwareUpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  public updatedAt!: Date;

  @ManyToOne(type => Player, {nullable: false, eager: true})
  @JoinColumn({name: 'owner_id'})
  public owner!: Player | Promise<Player | undefined>;

  @OneToMany(type => ClubMember, clubMember => clubMember.club)
  @JoinColumn()
  public members!: Array<ClubMember>;
}

@Entity()
export class ClubMember {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Index('club-idx')
  @ManyToOne(type => Club)
  @JoinColumn({name: 'club_id'})
  public club!: Club;

  @Index('player-idx')
  @ManyToOne(type => Player, {eager: true})
  @JoinColumn({name: 'player_id'})
  public player!: Player;

  @Column('int')
  public status!: ClubMemberStatus;

  @Column({name: 'is_manager', default: false})
  public isManager!: boolean;

  @Column({name: 'is_owner', default: false})
  public isOwner!: boolean;

  @Column({name: 'contact_info', default: ''})
  public contactInfo!: string;

  @Column({name: 'referred_by', default: ''})
  public referredBy!: string;

  @Column({name: 'owner_notes', default: ''})
  public ownerNotes!: string;

  @DbAwareColumn({name: 'last_played_date', type: 'timestamp', nullable: true})
  public lastGamePlayedDate!: Date;

  @DbAwareColumn({
    name: 'join_date',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  public joinedDate!: Date;

  @DbAwareColumn({name: 'left_date', type: 'timestamp', nullable: true})
  public leftDate!: Date;

  @Column({name: 'view_allowed', default: true})
  public viewAllowed!: boolean;

  @Column({name: 'play_allowed', default: true})
  public playAllowed!: boolean;

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

  @Column({
    name: 'total_buyins',
    type: 'decimal',
    precision: 8,
    scale: 2,
    default: 0,
  })
  public totalBuyins!: number;

  @Column({
    name: 'total_winnings',
    type: 'decimal',
    precision: 8,
    scale: 2,
    default: 0,
  })
  public totalWinnings!: number;

  @Column({
    name: 'balance',
    type: 'decimal',
    precision: 8,
    scale: 2,
    default: 0,
  })
  public balance!: number;

  @Column({name: 'notes', type: 'text', default: ''})
  public notes!: string;

  @Column({name: 'auto_buyin_approval', default: true})
  public autoBuyinApproval!: boolean;

  @Column({
    name: 'credit_limit',
    type: 'decimal',
    precision: 8,
    scale: 2,
    default: 0,
  })
  public creditLimit!: number;
}
