import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '../../api/users/dto/user-response.dto';

export class AuthResponseDto {
	@ApiProperty({
		description: 'JWT access token',
		example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
	})
	access_token: string;

	@ApiProperty({
		description: 'User information',
		type: UserResponseDto,
	})
	user: UserResponseDto;

	@ApiProperty({
		description: 'Token type',
		example: 'Bearer',
	})
	token_type: string;

	@ApiProperty({
		description: 'Token expiration time in seconds',
		example: 3600,
	})
	expires_in: number;
}
