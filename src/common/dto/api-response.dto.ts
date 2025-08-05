import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiResponseDto<T = any> {
	@ApiProperty({ description: 'Response status' })
	success: boolean;

	@ApiPropertyOptional({ description: 'Response message' })
	message?: string;

	@ApiProperty({ description: 'Response data' })
	data: T;

	@ApiPropertyOptional({ description: 'Error details' })
	error?: any;

	@ApiProperty({ description: 'Response timestamp' })
	timestamp: string;

	constructor(data: T, message?: string, success: boolean = true) {
		this.success = success;
		this.message = message;
		this.data = data;
		this.timestamp = new Date().toISOString();
	}

	static success<T>(data: T, message?: string): ApiResponseDto<T> {
		return new ApiResponseDto(data, message, true);
	}

	static error<T = any>(error: any, message?: string): ApiResponseDto<T> {
		const response = new ApiResponseDto(null as T, message, false);
		response.error = error;
		return response;
	}
}
