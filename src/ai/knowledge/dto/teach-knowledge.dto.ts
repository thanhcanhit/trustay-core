import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * DTO for admin to teach the AI system with question and SQL pairs
 */
export class TeachKnowledgeDto {
	@ApiProperty({
		description: 'Câu hỏi bằng tiếng Việt mà người dùng có thể hỏi',
		example: 'Tìm tất cả các phòng có giá dưới 5 triệu ở quận 1',
		minLength: 1,
		maxLength: 500,
	})
	@IsString({ message: 'Câu hỏi phải là chuỗi ký tự' })
	@IsNotEmpty({ message: 'Câu hỏi không được để trống' })
	question: string;

	@ApiProperty({
		description: 'Câu lệnh SQL tương ứng với câu hỏi (sử dụng PostgreSQL syntax)',
		example:
			"SELECT r.* FROM rooms r JOIN buildings b ON r.building_id = b.id JOIN districts d ON b.district_id = d.id WHERE r.price < 5000000 AND d.name ILIKE '%Quận 1%'",
		minLength: 1,
	})
	@IsString({ message: 'SQL phải là chuỗi ký tự' })
	@IsNotEmpty({ message: 'SQL không được để trống' })
	sql: string;

	@ApiPropertyOptional({
		description: 'ID phiên làm việc (tùy chọn, dùng để tracking)',
		example: 'session-12345-abcde',
	})
	@IsString({ message: 'Session ID phải là chuỗi ký tự' })
	@IsOptional()
	sessionId?: string;

	@ApiPropertyOptional({
		description: 'ID người dùng (tùy chọn, dùng để tracking)',
		example: 'user-uuid-12345',
	})
	@IsString({ message: 'User ID phải là chuỗi ký tự' })
	@IsOptional()
	userId?: string;
}
