import {Column, Entity, PrimaryGeneratedColumn} from 'typeorm';
import {DbAwareUpdateDateColumn} from '../dbaware';

@Entity({name: 'feature_requests'})
export class FeatureRequest {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column({name: 'player_uuid'})
  public requestedPlayerUuid!: string;

  @Column({name: 'feature'})
  public feature!: string;

  @DbAwareUpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  public updatedAt!: Date;
}
