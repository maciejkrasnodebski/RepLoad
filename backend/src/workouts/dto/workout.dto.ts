import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class StartWorkoutDto {
  @IsOptional()
  @IsUUID('4')
  templateId?: string;

  @IsOptional()
  @IsUUID('4')
  weeklyPlanId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  @IsOptional()
  @IsString()
  name?: string;
}

export class SeriesInputDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  reps?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  weight?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationSeconds?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  distance?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  restSeconds?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(10)
  rpe?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  rir?: number | null;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @IsBoolean()
  isDone?: boolean;
}

export class AddExerciseDto {
  @IsOptional()
  @IsUUID('4')
  exerciseId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

export class UpdateExerciseDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

export class AddSeriesDto extends SeriesInputDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

export class UpdateSeriesDto extends SeriesInputDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

export class AutosaveSeriesDto extends SeriesInputDto {
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

export class AutosaveExerciseDto {
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AutosaveSeriesDto)
  series?: AutosaveSeriesDto[];
}

export class AutosaveWorkoutDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AutosaveExerciseDto)
  exercises?: AutosaveExerciseDto[];
}
