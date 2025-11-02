import { ApiProperty } from '@nestjs/swagger';

export class GenerateInviteLinkResponseDto {
	@ApiProperty({
		description: 'Invite link để chia sẻ',
		example: 'https://app.example.com/invite?token=...',
	})
	inviteLink: string;

	@ApiProperty({
		description: 'Token invite (nếu cần sử dụng trực tiếp)',
		example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
	})
	token: string;

	@ApiProperty({
		description: 'ID của rental hiện tại',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	rentalId: string;

	@ApiProperty({
		description: 'ID của roommate seeking post (nếu có)',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	roommateSeekingPostId?: string;

	@ApiProperty({
		description: 'Thời gian hết hạn của link (ISO string)',
		example: '2024-12-31T23:59:59.000Z',
	})
	expiresAt: string;
}
