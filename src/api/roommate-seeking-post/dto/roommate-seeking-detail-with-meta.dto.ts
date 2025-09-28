import { ApiProperty } from '@nestjs/swagger';
import { RoommateSeekingPostResponseDto } from './roommate-seeking-post-response.dto';

export class RoommateSeekingDetailWithMetaResponseDto extends RoommateSeekingPostResponseDto {
	@ApiProperty({ description: 'Có phải chủ bài đăng không' })
	isOwner: boolean;

	@ApiProperty({ description: 'Có thể chỉnh sửa không' })
	canEdit: boolean;

	@ApiProperty({ description: 'Có thể apply không' })
	canApply: boolean;
}
