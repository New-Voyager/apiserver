import {
    Entity,
    Column,
    PrimaryGeneratedColumn
  } from 'typeorm';

  
export enum ClubMessageType {
    TEXT,
    HAND,
    GIPHY,
    } 


  @Entity()
  export class ClubMessageInput {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

    @Column('int')
    public messageType!: ClubMessageType;
  
    @Column({name: 'text'})
    public text!: string;
  
    @Column({name: 'game-number'})
    public gameNum!: number;
  
    @Column({name: 'hand-number', type: 'int'})
    public handNum!: number;

    @Column({name: 'giphy-link'})
    public giphyLink!: string;

    @Column({name: 'player-tags'})
    public playerTags!: string;
}
  
  