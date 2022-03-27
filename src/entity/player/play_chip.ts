import {Entity, Column, PrimaryColumn} from 'typeorm';

@Entity()
export class PlayChip {
  @PrimaryColumn({name: 'player_uuid'})
  public uuid!: string;

  @Column({name: 'player_chips', type: 'int'})
  public playerChips!: number;
}
