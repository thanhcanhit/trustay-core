import { PartialType } from '@nestjs/swagger';
import { CreateRoomRequestDto } from './create-room-request.dto';

export class UpdateRoomRequestDto extends PartialType(CreateRoomRequestDto) {}
