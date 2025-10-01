import { ApiProperty } from '@nestjs/swagger';
import { ContractStatus, SignerRole } from '@prisma/client';

export class SignerStatusDto {
	@ApiProperty({ description: 'Signer ID' })
	id: string;

	@ApiProperty({ description: 'Full name' })
	fullName: string;

	@ApiProperty({ description: 'Has signed the contract' })
	hasSigned: boolean;

	@ApiProperty({ description: 'Signed at timestamp', required: false })
	signedAt?: Date;
}

export class SignatureInfoDto {
	@ApiProperty({ enum: SignerRole, description: 'Signer role' })
	signerRole: SignerRole;

	@ApiProperty({ description: 'Signer name' })
	signerName: string;

	@ApiProperty({ description: 'Signed at timestamp' })
	signedAt: Date;
}

export class ContractStatusResponseDto {
	@ApiProperty({ description: 'Contract ID' })
	contractId: string;

	@ApiProperty({ description: 'Contract code' })
	contractCode: string;

	@ApiProperty({ enum: ContractStatus, description: 'Contract status' })
	status: ContractStatus;

	@ApiProperty({ type: SignerStatusDto, description: 'Landlord signing status' })
	landlord: SignerStatusDto;

	@ApiProperty({ type: SignerStatusDto, description: 'Tenant signing status' })
	tenant: SignerStatusDto;

	@ApiProperty({ type: [SignatureInfoDto], description: 'All signatures' })
	allSignatures: SignatureInfoDto[];

	@ApiProperty({ description: 'Fully signed at timestamp', required: false })
	fullySignedAt?: Date;

	@ApiProperty({ description: 'PDF download URL', required: false })
	pdfUrl?: string;
}
