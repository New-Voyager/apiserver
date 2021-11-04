import {Column, Entity, PrimaryGeneratedColumn} from 'typeorm';
import {DbAwareColumn} from '../dbaware';

@Entity({name: 'hand_analysis'})
export class HandAnalysis {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column({name: 'game_code'})
  public gameCode!: string;

  @DbAwareColumn({
    name: 'ended_at',
    type: 'timestamp',
    nullable: true,
  })
  public endedAt!: Date;

  @Column({name: 'hands_dealt', nullable: false, default: 0})
  public handsDealt!: number;

  @Column({name: 'fh_count', nullable: false, default: 0})
  public fullHouseCount!: number;

  @Column({name: 'fok_count', nullable: false, default: 0})
  public fourOfKindCount!: number;

  @Column({name: 'sf_count', nullable: false, default: 0})
  public straightFlushesCount!: number;

  @Column({name: 'paired_boards_count', nullable: false, default: 0})
  public pairedBoardsCount!: number;

  @Column({name: 'paired_second_boards_count', nullable: false, default: 0})
  public pairedSecondBoardsCount!: number;

  @Column({name: 'same_hole_cards_count', nullable: false, default: 0})
  public sameHoleCardsCount!: number;

  @Column({name: 'second_boards_count', nullable: false, default: 0})
  public secondBoardsCount!: number;

  @Column({name: 'balance_mismatch', nullable: false, default: false})
  public balanceMismatch!: boolean;

  @Column({name: 'issue_hands', nullable: false, default: '[]'})
  public issueHands!: string;

  @Column({name: 'hands_link', nullable: false, default: ''})
  public handsLink!: string;

  @Column({name: 'analysis_data', nullable: false, default: '{}'})
  public analysisData!: string;

  @Column({name: 'result_table', nullable: false, default: '{}'})
  public resultTable!: string;
}
