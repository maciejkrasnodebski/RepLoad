import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateExerciseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/\S/)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  exerciseType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  equipment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  muscleGroup?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  difficultyLevel?: string;
}
