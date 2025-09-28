import { PartialType } from '@nestjs/swagger';
import { CreateRoommateApplicationDto } from './create-roommate-application.dto';

export class UpdateRoommateApplicationDto extends PartialType(CreateRoommateApplicationDto) {}
