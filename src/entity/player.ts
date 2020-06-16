import {Entity, PrimaryGeneratedColumn, Column,} from "typeorm";
import {DbAwareColumn, DbAwareCreateDateColumn, DbAwareUpdateDateColumn} from './dbaware';

@Entity()
export class Player {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({unique: true})
    uuid: string;

    @Column()
    name: string;

    @Column({name: "device_id"})
    deviceId: string;

    @Column({name: "is_active"})
    isActive: boolean;
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
