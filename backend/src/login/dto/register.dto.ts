import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString({ message: 'Podaj nazwę użytkownika.' })
  @MinLength(3, { message: 'Nazwa użytkownika musi mieć co najmniej 3 znaki.' })
  @MaxLength(30, { message: 'Nazwa użytkownika może mieć maksymalnie 30 znaków.' })
  @Matches(/^[a-zA-Z0-9_.-]+$/, {
    message: 'Nazwa użytkownika może zawierać tylko litery, cyfry oraz znaki _ . -',
  })
  username: string;

  @IsString({ message: 'Podaj hasło.' })
  @MinLength(8, { message: 'Hasło musi mieć co najmniej 8 znaków.' })
  @MaxLength(72, { message: 'Hasło może mieć maksymalnie 72 znaki.' })
  password: string;
}