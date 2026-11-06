import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: 'Podaj nazwę użytkownika.' })
  username: string;

  @IsString()
  @IsNotEmpty({ message: 'Podaj hasło.' })
  password: string;
}