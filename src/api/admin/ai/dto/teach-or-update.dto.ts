import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

/**
 * DTO for teaching new knowledge or updating existing knowledge
 */
export class TeachOrUpdateDto {
	@ApiPropertyOptional({
		description: 'ID của SQL QA entry cần update (nếu có → update, không có → add mới)',
		example: 123,
	})
	@Type(() => Number)
	@IsInt({ message: 'ID phải là số nguyên' })
	@Min(1, { message: 'ID phải lớn hơn 0' })
	@IsOptional()
	id?: number;

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
