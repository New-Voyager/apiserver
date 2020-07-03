import {Entity, PrimaryGeneratedColumn, Column, Index} from 'typeorm';
import {DbAwareCreateDateColumn} from './dbaware';

@Entity()
export class Message {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column()
  public messageType!: ClubMessageType;

  @Column()
  public text!: string;

  @Column('int')
  public gameNum!: number;
  
  @Column('int')
  public handNum!: number;

  @Column()
  public giphyLink!: string;

  @Column('int')
  public playerTags!: number;

  @DbAwareCreateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  public createdAt!: Date;
}
export enum ClubMessageType {
    TEXT,
    HAND,
    GIPHY,
}
