import { PartialType } from '@nestjs/swagger';
import { CreateRoomSeekingPostDto } from './create-room-seeking-post.dto';

export class UpdateRoomSeekingPostDto extends PartialType(CreateRoomSeekingPostDto) {}
