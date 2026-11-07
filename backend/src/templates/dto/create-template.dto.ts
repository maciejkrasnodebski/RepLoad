import {
  ArrayUnique,
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  IsNumber,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TemplateExerciseInputDto {
  @IsInt()
  @Min(1)
  exerciseId!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  sets?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  reps?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationSeconds?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  restSeconds?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  distance?: number | null;
}

export class CreateTemplateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/\S/)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  color?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[a-zA-Z0-9_-]+$/)
  icon?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  daysOfWeek?: number[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  exerciseIds?: number[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateExerciseInputDto)
  exercises?: TemplateExerciseInputDto[];
}
