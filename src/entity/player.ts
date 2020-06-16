import {Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,} from "typeorm";

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
    @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)" })
    public createdAt: Date;

    /**
     * DB last update time.
     */
    @UpdateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)", onUpdate: "CURRENT_TIMESTAMP(6)" })
    public updatedAt: Date;  
}
