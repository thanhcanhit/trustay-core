import { PartialType } from '@nestjs/swagger';
import { CreateRoomRequestDto } from './create-room-seeking-post.dto';

export class UpdateRoomRequestDto extends PartialType(CreateRoomRequestDto) {}
