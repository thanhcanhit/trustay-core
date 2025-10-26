import { ApiProperty } from '@nestjs/swagger';
import { PaginatedResponseDto } from '../../../common/dto/pagination.dto';
import { BillResponseDto } from './bill-response.dto';

export class PaginatedBillResponseDto extends PaginatedResponseDto<BillResponseDto> {
	@ApiProperty({ type: [BillResponseDto], description: 'Danh sách hóa đơn' })
	declare data: BillResponseDto[];
}
