import { RoomType } from '@prisma/client';

export interface ContractTemplateVariable {
	key: string;
	label: string;
	type: 'string' | 'number' | 'date' | 'boolean' | 'array';
	required: boolean;
	defaultValue?: any;
}

export interface ContractClause {
	id: string;
	title: string;
	content: string;
	variables: string[];
	isMandatory: boolean;
	order: number;
}

export interface ContractTemplate {
	id: string;
	name: string;
	description?: string;
	roomTypes: RoomType[];
	variables: ContractTemplateVariable[];
	clauses: ContractClause[];
	htmlTemplate: string;
	isActive: boolean;
	version: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface ContractData {
	// Parties
	landlordName: string;
	landlordId: string;
	landlordPhone?: string;
	landlordEmail: string;

	tenantName: string;
	tenantId: string;
	tenantPhone?: string;
	tenantEmail: string;

	// Property
	roomName: string;
	roomNumber: string;
	roomType: RoomType;
	areaSqm?: number;
	fullAddress: string;
	buildingName: string;

	// Financial
	monthlyRent: number;
	depositAmount: number;
	currency: string;
	electricityRate?: number;
	waterRate?: number;

	// Lease terms
	startDate: Date;
	endDate?: Date;
	leaseDurationMonths?: number;

	// Additional data
	amenities: string[];
	rules: string[];
	contractNumber: string;
	createdDate: Date;

	// Custom variables
	[key: string]: any;
}
