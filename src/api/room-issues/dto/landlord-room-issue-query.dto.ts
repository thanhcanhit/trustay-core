import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { RoomIssueQueryDto } from './room-issue-query.dto';

export class LandlordRoomIssueQueryDto extends RoomIssueQueryDto {
	@ApiPropertyOptional({
		description: 'Filter by tenant who reported the issue',
		example: '0e2c1f30-4d75-4d8d-9ecc-7f643fe81c23',
	})
	@IsOptional()
	@IsUUID()
	reporterId?: string;
}
