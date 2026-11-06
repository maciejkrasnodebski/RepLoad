import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  type ValidationArguments,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { Type } from 'class-transformer';

@ValidatorConstraint({ name: 'validWeeklyPlanAssignment', async: false })
class ValidWeeklyPlanAssignment implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments) {
    const assignment = args.object as {
      templateId?: unknown;
      isRestDay?: unknown;
    };
    const hasTemplateId = Object.prototype.hasOwnProperty.call(
      assignment,
      'templateId',
    );
    const validTemplateId =
      assignment.templateId === null ||
      (typeof assignment.templateId === 'string' &&
        assignment.templateId.trim().length > 0);

    return (
      hasTemplateId &&
      validTemplateId &&
      (assignment.isRestDay !== true || assignment.templateId === null)
    );
  }

  defaultMessage() {
    return 'A rest day cannot have a template, and templateId must be a non-empty ID or null.';
  }
}

export class UpdateWeeklyPlanAssignmentDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @Validate(ValidWeeklyPlanAssignment)
  templateId!: string | null;

  @IsBoolean()
  isRestDay!: boolean;
}

export class UpdateWeeklyPlanDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/\S/)
  name?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique(
    (assignment: UpdateWeeklyPlanAssignmentDto) => assignment.dayOfWeek,
  )
  @ValidateNested({ each: true })
  @Type(() => UpdateWeeklyPlanAssignmentDto)
  assignments?: UpdateWeeklyPlanAssignmentDto[];
}
