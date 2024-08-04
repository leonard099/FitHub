import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Users } from 'src/User/User.entity';
import { AuthController } from './Auth.controller';
import { AuthService } from './Auth.Sevice';
import { AuthRepository } from './Auth.Repository';
import { UsersRepository } from 'src/User/User.repository';
import { PasswordService } from './Auth.randonPass';

@Module({
  imports: [TypeOrmModule.forFeature([Users])],
  controllers: [AuthController],
  providers: [AuthService, AuthRepository, UsersRepository, PasswordService],
  exports: [AuthService],
})
export class AuthModule {}
