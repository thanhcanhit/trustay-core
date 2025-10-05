import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SignContractDto {
	@ApiProperty({ description: 'Chữ ký dạng base64 PNG từ canvas' })
	@IsNotEmpty()
	@IsString()
	signatureImage: string;

	@ApiProperty({ description: 'Mã OTP xác thực (6 chữ số)' })
	@IsNotEmpty()
	@IsString()
	otpCode: string;
}
