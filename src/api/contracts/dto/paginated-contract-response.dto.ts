import { ApiProperty } from '@nestjs/swagger';
import { PaginatedResponseDto } from '../../../common/dto/pagination.dto';
import { ContractResponseDto } from './contract-response.dto';

export class PaginatedContractResponseDto extends PaginatedResponseDto<ContractResponseDto> {
	@ApiProperty({ type: [ContractResponseDto] })
	declare data: ContractResponseDto[];
}
