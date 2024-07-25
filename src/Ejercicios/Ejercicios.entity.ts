/* eslint-disable @typescript-eslint/no-unused-vars */
import { Plan } from 'src/PlanDeEntranmiento/Plan.entity';
import { Rutina } from 'src/Rutina/Rutina.entity';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({
  name: 'ejercicio',
})
export class Ejercicio {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  titulo: string;

  @Column({ type: 'varchar', length: 300 })
  descripcion: string;

  @Column('text', {
    array: true,
    default: () =>
      `'{"https://png.pngtree.com/png-clipart/20190630/original/pngtree-img-file-document-icon-png-image_4166554.jpg"}'`,
  })
  imgUrl: string[];

  @ManyToOne(() => Rutina, (rutina) => rutina.exercise, { nullable: true })
  @JoinColumn({ name: 'rutina' })
  rutina: Rutina;

  //@ManyToOne(() => Plan, (plan) => plan.exercise, { nullable: true })
  //@JoinColumn({ name: 'plan' })
  //plan: Rutina;
}
