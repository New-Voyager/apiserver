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

export enum ClubStatus {
  UNKNOWN,
  ACTIVE,
  DEFUNCT,
}

@Entity()
export class Club {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column()
  public name!: string;

  @Column({name: 'display_id'})
  public displayId!: string;

  @Column()
  public description!: string;

  @Column()
  public status!: ClubStatus;

  @ManyToOne(type => Player, {nullable: false, eager: true})
  @JoinColumn()
  public owner!: Player | Promise<Player | undefined>;

  @OneToMany(type => ClubMember, clubMember => clubMember.club)
  @JoinColumn()
  public members!: Array<ClubMember>;
}

export enum ClubMemberStatus {
  UNKNOWN,
  INVITED,
  PENDING,
  DENIED,
  ACTIVE,
  LEFT,
  KICKEDOUT,
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
}
