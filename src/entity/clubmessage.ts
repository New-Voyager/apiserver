import {Entity, Column, PrimaryGeneratedColumn} from 'typeorm';

export enum ClubMessageType {
  TEXT,
  HAND,
  GIPHY,
}

@Entity()
export class ClubMessageInput {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column('int')
  public messageType!: ClubMessageType;

  @Column({name: 'text', nullable: true})
  public text!: string;

  @Column({name: 'club_code', nullable: false})
  public clubCode!: string;

  @Column({name: 'hand_number', type: 'int', nullable: true})
  public handNum!: number;

  @Column({name: 'giphy_link', nullable: true})
  public giphyLink!: string;

  @Column({name: 'game_number', nullable: true})
  public gameNum!: number;

  @Column({name: 'player_tags'})
  public playerTags!: string;
}
