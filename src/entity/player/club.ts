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
} from '../dbaware';
import {Player} from './player';
import {ClubMemberStatus, ClubStatus} from '../types';

@Entity({name: 'club'})
export class Club {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column()
  public name!: string;

  @Index()
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

  @Column({name: 'next_game_num', type: 'int', default: 0})
  public nextGameNum!: number;

  @Column({name: 'firebase_notification_key_name', nullable: true})
  public firebaseNotificationKeyName!: string;

  @Column({name: 'firebase_notification_key', nullable: true})
  public firebaseNotificationKey!: string;

  @Column({name: 'pic_url', default: ''})
  public picUrl!: string;

  @Column({name: 'show_highrank_stats', default: true})
  public showHighRankStats!: boolean;
}

@Entity({name: 'club_setting'})
export class ClubSetting {
  @Column({name: 'club_id', primary: true})
  public clubId!: number;

  @Column({name: 'advance_features_activated', default: false})
  public advanceFeaturesActivated!: boolean;

  @Column({name: 'advance_features_enabled', default: false})
  public advanceFeaturesEnabled!: boolean;

  @Column({name: 'first_time', default: true})
  public first_time!: boolean;

  @Column({name: 'active_until', nullable: true})
  public activeUntil!: Date;

  @Column({name: 'email', nullable: true})
  public email!: string;
}

@Entity({name: 'club_member'})
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

  @DbAwareColumn({
    name: 'last_played_date',
    type: 'timestamptz',
    nullable: true,
  })
  public lastGamePlayedDate!: Date;

  @DbAwareColumn({
    name: 'join_date',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  public joinedDate!: Date;

  @DbAwareColumn({name: 'left_date', type: 'timestamptz', nullable: true})
  public leftDate!: Date;

  @DbAwareColumn({
    name: 'last_message_read',
    type: 'timestamptz',
    nullable: true,
  }) // used for getting unread message count
  public lastMessageRead!: Date;

  @Column({name: 'view_allowed', default: true})
  public viewAllowed!: boolean;

  @Column({name: 'play_allowed', default: true})
  public playAllowed!: boolean;

  /**
   * DB insert time.
   */
  @DbAwareCreateDateColumn({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  public createdAt!: Date;

  /**
   * DB last update time.
   */
  @DbAwareUpdateDateColumn({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  public updatedAt!: Date;

  @Column({name: 'notes', type: 'text', default: ''})
  public notes!: string;

  @Column({name: 'auto_buyin_approval', default: false})
  public autoBuyinApproval!: boolean;

  @Column({
    name: 'credit_limit',
    type: 'decimal',
    precision: 8,
    scale: 2,
    default: 0,
  })
  public creditLimit!: number;

  @Column({
    name: 'available_credits',
    type: 'decimal',
    precision: 8,
    scale: 2,
    default: 0,
  })
  public availableCredits!: number;

  @Column({
    name: 'balance',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  public balance!: number;
}

@Entity({name: 'club_member_stat'})
export class ClubMemberStat {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column({name: 'club_id', type: 'int'})
  public clubId!: number;

  @Column({name: 'player_id', type: 'int'})
  public playerId!: number;

  @Column({
    name: 'total_buyins',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  public totalBuyins!: number;

  @Column({
    name: 'total_winnings',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  public totalWinnings!: number;

  @Column({name: 'total_games', type: 'int', nullable: true, default: 0})
  public totalGames!: number;

  @Column({name: 'total_hands', type: 'int', nullable: true, default: 0})
  public totalHands!: number;

  @Column({name: 'won_hands', type: 'int', nullable: true, default: 0})
  public wonHands!: number;

  @Column({
    name: 'rake_paid',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  public rakePaid!: number;
}

@Entity({name: 'club_buyin_tracking'})
export class ClubBuyinTracking {
  @PrimaryGeneratedColumn()
  public id!: number;

  @ManyToOne(type => Club)
  @JoinColumn({name: 'club_id'})
  public club!: Club;

  @ManyToOne(type => Player)
  @JoinColumn({name: 'player_id'})
  public player!: Player;

  @Column({name: 'game_code', type: 'text'})
  public gameCode!: string;

  @Column({name: 'buyin_time'})
  public buyInTime!: Date;

  @Column({name: 'amount', type: 'decimal', precision: 8, scale: 2})
  public amount!: number;

  @Column({name: 'auto_approved', default: false})
  public autoApproved!: boolean;

  @Column({name: 'balance', type: 'decimal', precision: 8, scale: 2})
  public balance!: number;

  @Column({name: 'available_credits', type: 'decimal', precision: 8, scale: 2})
  public availableCredits!: number;

  @DbAwareUpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  public updatedAt!: Date;
}

@Entity({name: 'balance_updates'})
export class BalanceUpdates {
  @PrimaryGeneratedColumn()
  public id!: number;

  @ManyToOne(type => Club)
  @JoinColumn({name: 'club_id'})
  public club!: Club;

  @ManyToOne(type => Player)
  @JoinColumn({name: 'player_id'})
  public player!: Player;

  @Column({name: 'game_code', type: 'text', nullable: true})
  public gameCode!: string;

  @Column({name: 'update_type'})
  public updateType!: string;

  @Column({name: 'game_time', nullable: true})
  public gameTime!: Date;

  @Column({name: 'amount', type: 'decimal', precision: 8, scale: 2})
  public amount!: number;

  @Column({name: 'notes', type: 'text', nullable: true})
  public notes!: string;

  @Column({name: 'updated_balance', type: 'decimal', precision: 8, scale: 2})
  public updatedBalance!: number;

  @DbAwareUpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  public updatedAt!: Date;
}

/*
@Entity({name: 'club_chips_transaction'})
export class ClubChipsTransaction {
  @PrimaryGeneratedColumn()
  public id!: number;

  @ManyToOne(type => Club)
  @JoinColumn({name: 'club_id'})
  public club!: Club;

  @Column({name: 'description', type: 'text'})
  public description!: string;

  @Column({name: 'amount', type: 'decimal', precision: 8, scale: 2})
  public amount!: number;

  @Column({name: 'balance', type: 'decimal', precision: 8, scale: 2})
  public balance!: number;

  @DbAwareUpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  public updatedAt!: Date;
}
*/
