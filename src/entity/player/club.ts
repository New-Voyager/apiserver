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
import {ClubMemberStatus, ClubStatus, CreditUpdateType} from '../types';

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

  @Column({name: 'track_member_credit', default: false})
  public trackMemberCredit!: boolean;

  @Column({name: 'credit_tracking_enabled', default: false})
  public creditTrackingEnabled!: boolean;

  @Column({name: 'show_game_result', default: true})
  public showGameResult!: boolean;

  @Column({name: 'invitation_code', nullable: true})
  public invitationCode!: string;

  @Column({name: 'agents_can_see_player_tips', default: true})
  public agentsCanSeePlayerTips!: boolean;
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

  @Column({name: 'main_owner', default: false})
  public isMainOwner!: boolean;

  @Column({name: 'is_agent', default: false})
  public isAgent!: boolean;

  @Column({name: 'contact_info', default: ''})
  public contactInfo!: string;

  @Column({name: 'referred_by', default: ''})
  public referredBy!: string;

  @ManyToOne(type => Player, {eager: false, nullable: true})
  @JoinColumn({name: 'agent_id'})
  public agent!: Player;

  @Column({name: 'owner_notes', default: ''})
  public ownerNotes!: string;

  @Column({name: 'tips_back', type: 'int', nullable: true, default: 0})
  public tipsBack!: number;

  @DbAwareColumn({
    name: 'last_played_date',
    type: 'timestamptz',
    nullable: true,
  })
  public lastPlayedDate!: Date;

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
    name: 'available_credit',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  public availableCredit!: number;

  @Column({
    name: 'followup',
    nullable: true,
    default: false,
  })
  public followup!: boolean;
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

@Entity({name: 'credit_tracking'})
@Index(['clubId', 'playerId'])
export class CreditTracking {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column({name: 'club_id', type: 'int'})
  public clubId!: number;

  @Column({name: 'player_id', type: 'int'})
  public playerId!: number;

  @Column({name: 'update_type'})
  public updateType!: CreditUpdateType;

  @Column({name: 'game_code', nullable: true})
  public gameCode!: string;

  @Column({name: 'admin_name', nullable: true})
  public adminName!: string;

  @Column({
    name: 'amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: false,
  })
  public amount!: number;

  @Column({name: 'notes', nullable: true})
  public notes!: string;

  @Column({
    name: 'updated_credits',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: false,
  })
  public updatedCredits!: number;

  @Column({
    name: 'tips',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    default: 0,
  })
  public tips!: number;

  @Column({
    name: 'followup',
    nullable: true,
    default: false,
  })
  public followup!: boolean;

  /**
   * DB insert time.
   */
  @DbAwareCreateDateColumn({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  public createdAt!: Date;
}

@Entity({name: 'club_manager_roles'})
export class ClubManagerRoles {
  @Column({name: 'club_id', primary: true})
  public clubId!: number;

  @Column({name: 'approve_members', default: false})
  public approveMembers!: boolean;

  @Column({name: 'see_tips', default: false})
  public seeTips!: boolean;

  @Column({name: 'make_annoucement', default: false})
  public makeAnnouncement!: boolean;

  @Column({name: 'private_msg', default: false})
  public sendPrivateMessage!: boolean;

  @Column({name: 'host_games', default: true})
  public hostGames!: boolean;

  @Column({name: 'approve_buyin', default: true})
  public approveBuyin!: boolean;

  @Column({name: 'view_member_activities', default: false})
  public viewMemberActivities!: boolean;

  @Column({name: 'can_update_credits', default: false})
  public canUpdateCredits!: boolean;
}

@Entity({name: 'club_invitations'})
export class ClubInvitations {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column({name: 'invitation_code', unique: true})
  public invitationCode!: string;

  @Column({name: 'used', default: false})
  public used!: boolean;

  @Column({name: 'never_expires', default: false})
  public neverExpires!: boolean;

  /**
   * DB insert time.
   */
  @DbAwareCreateDateColumn({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  public createdAt!: Date;
}

@Entity({name: 'member_tips_tracking'})
@Index(['clubId', 'playerId'])
export class MemberTipsTracking {
  @PrimaryGeneratedColumn({type: 'bigint'})
  public id!: number;

  @Column({name: 'club_id'})
  public clubId!: number;

  @Column({name: 'player_id'})
  public playerId!: number;

  @Column({name: 'game_code'})
  public gameCode!: string;

  @DbAwareColumn({
    name: 'game_ended_datetime',
    type: 'timestamp',
    nullable: true,
  })
  public gameEndedAt!: Date;

  @Column({
    name: 'tips_paid',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    default: 0,
  })
  public tipsPaid!: number;

  @Column({
    name: 'number_of_hands_played',
    type: 'int',
    nullable: true,
  })
  public numberOfHands!: number;

  @Column({
    name: 'buyin',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    default: 0,
  })
  public buyin!: number;

  @Column({
    name: 'profit',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    default: 0,
  })
  public profit!: number;
}
