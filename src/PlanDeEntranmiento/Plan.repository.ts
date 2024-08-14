/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Plan } from './Plan.entity';
import { Check, ILike, In, Repository } from 'typeorm';
import { Category } from 'src/Category/Category.entity';
import { DifficultyLevel } from './difficultyLevel.enum';
import { PlanCreateDto } from './CreatePlan.dto';
import { Users } from 'src/User/User.entity';
import { UserRole } from 'src/User/User.enum';
import { Payment, Preference } from 'mercadopago';
import { Suscripciones } from 'src/Suscripciones/Suscripciones.entity';
import { SubscriptionsRepository } from 'src/Suscripciones/suscripciones.repository';
import { planClient } from 'config/mercadoPagoPlan.config';
import { Request, Response, response } from 'express';
import axios from 'axios';

@Injectable()
export class PlanRepository {
  constructor(
    @InjectRepository(Plan) private planRepository: Repository<Plan>,
    @InjectRepository(Users) private userRepository: Repository<Users>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    private readonly subscriptionsRepository: SubscriptionsRepository,
  ) {}

  async getPlan(
    page: number,
    limit: number,
    category?: string,
    location?: string,
    difficultyLevel?: DifficultyLevel,
    search?: string,
  ) {
    let whereConditions: any = { isActive: true };

    if (category) {
      const categoria = await this.categoryRepository.find({
        where: { id: category },
      });
      whereConditions.category = categoria;
    }

    if (location) {
      whereConditions.location = ILike(`%${location}`);
    }

    if (difficultyLevel) {
      whereConditions.difficultyLevel = difficultyLevel;
    }
    if (search) {
      const stopWords = new Set(['de', 'y', 'el', 'la', 'en', 'a', 'o']); // Lista de palabras de parada
      const arrSearch = search
        .split(' ')
        .filter(
          (term) => term.trim() !== '' && !stopWords.has(term.toLowerCase()),
        );

      whereConditions = arrSearch.map((term) => ({
        ...whereConditions,
        name: ILike(`%${term}%`),
      }));
    }
    return this.planRepository.find({
      where: whereConditions,
      skip: (page - 1) * limit,
      take: limit,
      relations: ['category'],
    });
  }

  async getPlanById(id) {
    return await this.planRepository.findOne({
      where: { id, isActive: true },
      relations: ['category'],
    });
  }

  //Validar que es profe
  async createPlan(plan: PlanCreateDto, admin: string) {
    const adm = await this.userRepository.findOne({ where: { id: admin } });
    if (!adm) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const category = await this.categoryRepository.find({
      where: { id: In(plan.category) },
    });
    if (category.length !== plan.category.length) {
      throw new NotFoundException('Categoria no encontrada');
    }

    console.log(category);

    const planCreado = await this.planRepository.create({
      ...plan,
      admin: adm,
      category: category,
    });
    await this.planRepository.save(planCreado);
    return planCreado;
  }
  async updatePlan(plan, admin, identificacion) {
    const userAdmin = await this.userRepository.findOne({
      where: { id: admin },
    });
    if (userAdmin.role !== UserRole.ADMIN) {
      const planToUpdate = await this.planRepository.findOne({
        where: { id: identificacion, admin: userAdmin },
      });
      if (!planToUpdate || planToUpdate.isActive === false) {
        throw new NotFoundException('Plan no encontrado o eliminado');
      }
      if (plan.categoryToUpdate) {
        const category = await this.categoryRepository.find({
          where: { id: In(plan.categoryToUpdate) },
        });
        if (category.length !== plan.categoryToUpdate.length) {
          throw new NotFoundException('Categoria no encontrada');
        }
        planToUpdate.category = category;
        await this.planRepository.save(planToUpdate);
      }
      const { categoryToUpdate, ...planSinCategory } = plan;
      console.log(planSinCategory);
      return await this.planRepository.update(identificacion, planSinCategory);
    } else if (userAdmin.role === UserRole.ADMIN) {
      const planToUpdate = await this.planRepository.findOne({
        where: { id: identificacion },
      });
      if (!planToUpdate || planToUpdate.isActive === false) {
        throw new NotFoundException('Plan no encontrado o eliminado');
      }
      if (plan.category) {
        const category = await this.categoryRepository.find({
          where: { id: In(plan.category) },
        });
        if (category.length !== plan.category.length) {
          throw new NotFoundException('Categoria no encontrada');
        }
        planToUpdate.category = category;
      }
      return await this.planRepository.update(identificacion, plan);
    }
  }

  async deletePlan(id: string, user) {
    const plan = await this.planRepository.findOne({
      where: { id: id },
      relations: ['admin'],
    });
    if (!plan || plan.isActive === false) {
      throw new NotFoundException('Plan no encontrado o eliminado');
    }

    if (user.role !== UserRole.ADMIN) {
      const userSub = await this.userRepository.findOne({
        where: { id: user.sub },
      });
      console.log(userSub);
      console.log('--------------------');
      console.log(plan.admin);
      if (plan.admin.id !== userSub.id) {
        throw new BadRequestException(
          'No tines capacidad de eliminar este plan',
        );
      }
      await this.planRepository.update(id, { ...plan, isActive: false });
    } else {
      await this.planRepository.update(id, { ...plan, isActive: false });
    }
    return 'El plan de entrenamiento ha sido eliminado';
  }

  ////////////////////////////////Mercado Pago///////////////////////////////////////////

  // REVISAR EL CHEQUEO DE SI YA EXISTE EL PLAN DENTRO DEL USER. ASI NO COMPRADOS VECES. REVISAR EL INVOICE DE CADUCIDAD
  async createOrderPlan(req, res) {
    const userId = req.user.sub;
    const planId = req.body.planId;
    // const planYaComprado = await this.planRepository.findOne({
    //   where: { id: planId },
    // });
    // if (planYaComprado) {
    //   throw new BadRequestException('Usted ya posee este plan');
    // }
    console.log(userId, planId);
    try {
      // const existingSubscription =
      //   await this.subscriptionsRepository.getSubscriptionByUserAndPlan(
      //     userId,
      //     planId,
      //   );

      // if (existingSubscription) {
      //   throw new BadRequestException('Su suscripción aún no se ha vencido');
      // }

      const user = await this.userRepository.findOne({
        where: { id: userId, isActive: true },
      });
      
      if (!user) {
        throw new ConflictException('Usuario no encontrado');
      }

      const plan = await this.planRepository.findOne({ where: { id: planId } });

      if (!plan) {
        throw new ConflictException('Plan no encontrado');
      }
      
      const body = {
        items: [
          {
            id: req.user.sub,
            title: req.body.title,
            planId: req.body.planId,
            quantity: 1,
            unit_price: Number(req.body.unit_price),
            currency_id: 'ARS',
          },
        ],
        back_urls: {
          success: 'http://localhost:3000/success',
          failure: 'http://localhost:3000/failure',
        },
        auto_return: 'approved',
        notification_url: 'https://fithub-2mzr.onrender.com/plan/webhook',
      };

      const preference = new Preference(planClient);
      const result = await preference.create({ body }); 
      const paymentId = result.id;
      

    // Devuelve la preferencia creada al frontend para que se pueda redirigir a la URL de MercadoPago
    res.json({ id: result.id, init_point: result.init_point });
  } catch (error) {
    console.error('Error al crear la preferencia de pago:', error);
    res.status(500).send('Error al crear la preferencia de pago');
  }

      //aca es donde deberiamos cortar el metodo, enviar el res.json y que desde el webhook continuar con la suscripcion si es que el estado es exitoso
      // this.handlePaymentSuccess(userId, planId);
      // try {
      //   const response = await axios.get(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      //     headers: {
      //       'Authorization': `Bearer APP_USR-6795275057660122-073011-154dfa6cc6845f14ff72ae59d7723aa8-1289604664`,
      //     }
      //   });
    
      //   // Aquí puedes manejar la respuesta de la API
      //   console.log('Payment Status:', response.data.status);
      //   res.json({ id: result.id });
      // } catch (error) {
      //   console.error('Error fetching payment status:', error.response ? error.response.data : error.message);
      //   throw new Error('Error fetching payment status');
      // }
    // } catch (error) {
    //   console.error('Error al crear la preferencia de pago:', error);
    //   res.status(500).send('Error al crear la preferencia de pago');
    // }
  }

  async handlePaymentSuccess(userId: string, planId: string) {
    try {
      await this.subscriptionsRepository.createSubscription(userId, planId);
    } catch (error) {
      console.error('Error al crear la suscripción:', error);
    }
  }

  async webhook(req, res){
    const paymentId = req.body.data.id;

    try {
      const payment = await axios.get(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: {
          Authorization: `Bearer APP_USR-6795275057660122-073011-154dfa6cc6845f14ff72ae59d7723aa8-1289604664`, // Asegúrate de usar el token correcto
        },
      });

      if (payment.data.status === 'approved') {
        console.log('estoy probando la entrada por la ruta')
      }
      res.sendStatus(200);
    } catch (error) {
      console.error('Error in MercadoPago Webhook:', error);
      res.sendStatus(500);
    }
  }
}
