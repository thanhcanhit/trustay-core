import { PartialType } from '@nestjs/swagger';
import { CreateRoommateSeekingPostDto } from './create-roommate-seeking-post.dto';

export class UpdateRoommateSeekingPostDto extends PartialType(CreateRoommateSeekingPostDto) {}
