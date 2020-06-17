import {Entity, PrimaryGeneratedColumn, Column, 
  OneToMany, 
  JoinColumn, ManyToOne,
  Index} from "typeorm";
import {DbAwareColumn, DbAwareCreateDateColumn, DbAwareUpdateDateColumn} from './dbaware';
import  {Player} from "./player";

@Entity()
export class Club {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;

    @Column({name: "display_id"})
    displayId: string;

    @Column()
    description: string;

    @ManyToOne(type => Player, {nullable: false, eager: true})
    @JoinColumn()
    owner: Player|Promise<Player|undefined>;

    @OneToMany(type => ClubMember, clubMember => clubMember.club)
    @JoinColumn()
    members: Array<ClubMember>
}

export enum ClubMemberStatus {
  UNKNOWNN,
  INVITED,
  PENDING,
  DENIED,
  APPROVED,
  LEFT,
  KICKEDOUT,
}

@Entity()
export class ClubMember {
    @PrimaryGeneratedColumn()
    id: number;

    @Index("club-idx")
    @ManyToOne(type => Club)
    @JoinColumn({name: "club_id"})
    club: Club;

    @Index("player-idx")
    @ManyToOne(type => Player, {eager: true})
    @JoinColumn({name: "player_id"})
    player: Player;

    @Column('int')
    status: ClubMemberStatus;

    @Column({name: "is_manager", default: false})
    isManager: boolean

    @Column({name: "is_owner", default: false})
    isOwner: boolean

    @DbAwareColumn({ name: "last_played_date", type: "timestamp", nullable: true })
    lastGamePlayedDate: Date

    @DbAwareColumn({ name: "join_date", type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
    joinedDate: Date

    @DbAwareColumn({ name: "left_date", type: "timestamp", nullable: true})
    leftDate: Date

    @Column({name: "view_allowed", default: true})
    viewAllowed: boolean

    @Column({name: "play_allowed", default: true})
    playAllowed: boolean

    /**
     * DB insert time.
     */
    @DbAwareCreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
    public createdAt: Date;

    /**
     * DB last update time.
     */
    @DbAwareUpdateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP", onUpdate: "CURRENT_TIMESTAMP" })
    public updatedAt: Date;  
}