import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateWeeklyPlanDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/\S/)
  name!: string;
}
