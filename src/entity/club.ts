import {Entity, PrimaryGeneratedColumn, Column, 
  OneToMany, 
  JoinColumn, ManyToOne,
  CreateDateColumn, UpdateDateColumn,
  Index} from "typeorm";
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

    @ManyToOne(type => Player)
    @JoinColumn()
    owner: Promise<Player|undefined>;

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
    club: Club;

    @Index("player-idx")
    @ManyToOne(type => Player, {eager: true})
    player: Player;

    @Column('int')
    status: ClubMemberStatus;

    @Column({name: "is_manager", default: false})
    isManager: boolean

    @Column({name: "is_owner", default: false})
    isOwner: boolean

    @CreateDateColumn({ name: "last_played_date", type: "timestamp", nullable: true })
    lastGamePlayedDate: Date

    @CreateDateColumn({ name: "join_date", type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)" })
    joinedDate: Date

    @CreateDateColumn({ name: "left_date", type: "timestamp", nullable: true})
    leftDate: Date

    @Column({name: "view_allowed", default: true})
    viewAllowed: boolean

    @Column({name: "play_allowed", default: true})
    playAllowed: boolean

    /**
     * DB insert time.
     */
    @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)" })
    public createdAt: Date;

    /**
     * DB last update time.
     */
    @UpdateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)", onUpdate: "CURRENT_TIMESTAMP(6)" })
    public updatedAt: Date;  
}