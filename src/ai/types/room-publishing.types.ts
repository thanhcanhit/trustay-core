import { RoomType } from '@prisma/client';
import type { CreateBuildingDto } from '../../api/buildings/dto';
import type { CreateRoomDto } from '../../api/rooms/dto';
export type RoomPublishingStage =
	| 'capture-context'
	| 'ensure-building'
	| 'collect-room-core'
	| 'enrich-room'
	| 'finalize-room';

export interface BuildingDraftState {
	id?: string;
	name?: string;
	addressLine1?: string;
	wardId?: number;
	districtId?: number;
	provinceId?: number;
	country?: string;
	locationHint?: string;
	locationResolved?: LocationResolutionResult;
	locationCacheKey?: string;
	notes?: string;
	isExisting?: boolean;
	candidates?: BuildingCandidate[];
	selectionMessage?: string;
}

export interface BuildingCandidate {
	id: string;
	name: string;
	slug?: string;
	addressLine1?: string;
	districtId?: number;
	provinceId?: number;
	wardId?: number;
	districtName?: string;
	provinceName?: string;
	wardName?: string;
	matchScore?: number;
}

export interface RoomPricingDraft {
	basePriceMonthly?: number;
	depositAmount?: number;
	depositMonths?: number;
	utilityIncluded?: boolean;
	utilityCostMonthly?: number;
	minimumStayMonths?: number;
	maximumStayMonths?: number;
	priceNegotiable?: boolean;
}

export interface RoomAmenityDraft {
	systemAmenityId: string;
	customValue?: string;
	notes?: string;
}

export interface RoomCostDraft {
	systemCostTypeId: string;
	value: number;
	costType?: string;
	unit?: string;
	billingCycle?: string;
	includedInRent?: boolean;
	isOptional?: boolean;
	notes?: string;
}

export interface RoomRuleDraft {
	systemRuleId: string;
	customValue?: string;
	isEnforced?: boolean;
	notes?: string;
}

export interface RoomImageDraft {
	path: string;
	alt?: string;
	isPrimary?: boolean;
	sortOrder?: number;
}

export interface RoomDraftState {
	name?: string;
	description?: string;
	roomType?: RoomType;
	totalRooms?: number;
	maxOccupancy?: number;
	areaSqm?: number;
	floorNumber?: number;
	roomNumberPrefix?: string;
	roomNumberStart?: number;
	pricing: RoomPricingDraft;
	amenities: RoomAmenityDraft[];
	costs: RoomCostDraft[];
	rules: RoomRuleDraft[];
	images: RoomImageDraft[];
}

export interface RoomPublishingDraft {
	stage: RoomPublishingStage;
	userId?: string;
	building: BuildingDraftState;
	room: RoomDraftState;
	lastPrompt?: string;
	pendingConfirmation?: string;
	isReadyForSql: boolean;
	isReadyForExecution: boolean;
	lastActions?: RoomPublishingAction[];
}

export interface RoomPublishingFieldRequirement {
	key: string;
	label: string;
	description: string;
	stage: RoomPublishingStage;
	isOptional: boolean;
}

export interface LocationLookupInstruction {
	normalizedDistrict?: string;
	normalizedProvince?: string;
	sql: string;
	cacheKey?: string;
}

export interface LocationResolutionResult {
	wardId?: number;
	districtId?: number;
	provinceId?: number;
	confidence: number;
	explanation: string;
}

export interface RoomPublishingExecutionPlan {
	shouldCreateBuilding: boolean;
	buildingId?: string;
	buildingPayload?: CreateBuildingDto;
	roomPayload: CreateRoomDto;
	description: string;
}

export type RoomPublishingActionType = 'LOOKUP_LOCATION' | 'LIST_OWNER_BUILDINGS';

export interface RoomPublishingAction {
	type: RoomPublishingActionType;
	sql: string;
	description: string;
	cacheKey?: string;
}
