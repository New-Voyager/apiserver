import {Entity, Column, PrimaryGeneratedColumn} from 'typeorm';

@Entity()
export class FavouriteMessage {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column({name: 'club_code', nullable: true})
  public clubCode!: string;

  @Column({name: 'player_id', nullable: true})
  public playerId!: string;

  @Column({name: 'text', nullable: true})
  public text!: string;

  @Column({name: 'audio_link', nullable: true})
  public audioLink!: string;

  @Column({name: 'image_link', nullable: true})
  public imageLink!: string;
}
