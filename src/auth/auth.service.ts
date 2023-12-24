/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import * as bcryptjs from 'bcryptjs';
import { Model } from 'mongoose';
import { CreateUserDto, LoginDto, RegisterUserDto } from './dto';
import { User } from './entities/user.entity';
import { JwtPayload } from './interfaces/jwt-payload';
import { LoginResponse } from './interfaces/login-response';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<User>,

    private jwtService: JwtService,
  ) {}

  //Método: Crear un usuario
  async create(createUserDto: CreateUserDto): Promise<User> {
    try {
      //1. encriptar la contraseña
      const { password, ...userData } = createUserDto;
      const newUser = new this.userModel({
        password: bcryptjs.hashSync(password, 10),
        ...userData,
      });

      await newUser.save();
      const { password: _, ...user } = newUser.toJSON();
      return user;

      //2. generar el JWT
    } catch (error) {
      if (error.code === 11000) {
        throw new BadRequestException(
          `${createUserDto.email} ya está registrado.`,
        );
      }
      throw new InternalServerErrorException(
        'Error mientras se intentó guardar.',
      );
    }
  }

  //Método: Login de un usuario
  async login(loginDto: LoginDto): Promise<LoginResponse> {
    const { email, password } = loginDto;
    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new UnauthorizedException(`Credenciales no válidas - ${email}`);
    }

    if (!bcryptjs.compareSync(password, user.password)) {
      throw new UnauthorizedException(`Credenciales no válidas - ${password}`);
    }

    const { password: _, ...rest } = user.toJSON();

    return {
      user: rest,
      token: this.getJwtToken({ id: user._id }),
    };
  }

  //Método: Registro de un usuario
  async register(registerDto: RegisterUserDto): Promise<LoginResponse> {
    const user = await this.create(registerDto);
    return {
      user: user,
      token: this.getJwtToken({ id: user._id }),
    };
  }

  findAll(): Promise<User[]> {
    return this.userModel.find();
  }

  //Metodo: Obtener un usuario por id.
  async findUserId(id: string): Promise<User | null> {
    const user = await this.userModel.findById(id);
    const { password, ...rest } = user.toJSON();
    return rest;
  }

  //Método: Actualizar un usuario

  /* update(id: number, updateUserDto: UpdateUserDto) {
    return `This action updates a #${id} auth ${updateUserDto}`;
  }*/

  //Método: Eliminar un usuario
  async deleteById(id: string): Promise<object> {
    const user = await this.findUserId(id);

    if (!user || user == null)
      throw new UnauthorizedException('El usuario no existe');

    this.userModel.findByIdAndDelete(id).exec();

    return {
      user: user,
      messaje: 'Usuario eliminado exitosamente',
    };
  }

  getJwtToken(payload: JwtPayload) {
    const token = this.jwtService.sign(payload);
    return token;
  }
}
