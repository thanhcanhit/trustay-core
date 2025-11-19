import {
	BuildingDraftState,
	RoomDraftState,
	RoomPublishingDraft,
	RoomPublishingExecutionPlan,
	RoomPublishingFieldRequirement,
	RoomPublishingStage,
} from '../types/room-publishing.types';

const BUILDING_REQUIREMENTS: RoomPublishingFieldRequirement[] = [
	{
		key: 'building.name',
		label: 'Tên tòa nhà',
		description: 'Tên giúp người thuê nhận diện tòa nhà của bạn.',
		stage: 'ensure-building',
		isOptional: false,
	},
	{
		key: 'building.location',
		label: 'Quận/Huyện và Tỉnh/Thành',
		description: 'Cần để tự động điền districtId và provinceId.',
		stage: 'ensure-building',
		isOptional: false,
	},
];

const ROOM_REQUIREMENTS: RoomPublishingFieldRequirement[] = [
	{
		key: 'room.name',
		label: 'Tên loại phòng',
		description: 'Hiển thị trên trang chi tiết và danh sách.',
		stage: 'collect-room-core',
		isOptional: false,
	},
	{
		key: 'room.roomType',
		label: 'Loại phòng',
		description: 'Phân loại (boarding_house, dormitory, ...).',
		stage: 'collect-room-core',
		isOptional: false,
	},
	{
		key: 'room.totalRooms',
		label: 'Số lượng phòng',
		description: 'Dùng để tạo room instances và tồn kho.',
		stage: 'collect-room-core',
		isOptional: false,
	},
	{
		key: 'room.pricing.basePriceMonthly',
		label: 'Giá thuê',
		description: 'Giá thuê theo tháng (VND).',
		stage: 'collect-room-core',
		isOptional: false,
	},
	{
		key: 'room.pricing.depositAmount',
		label: 'Tiền cọc',
		description: 'Tiền đặt cọc (VND).',
		stage: 'collect-room-core',
		isOptional: false,
	},
];

export const ROOM_PUBLISHING_STAGE_ORDER: RoomPublishingStage[] = [
	'capture-context',
	'ensure-building',
	'collect-room-core',
	'enrich-room',
	'finalize-room',
];

export const ROOM_MVP_QUESTIONS: RoomPublishingFieldRequirement[] = [
	{
		key: 'room.name',
		label: 'Tên loại phòng',
		description: 'Phòng này tên gì để người thuê dễ phân biệt?',
		stage: 'collect-room-core',
		isOptional: false,
	},
	{
		key: 'room.roomType',
		label: 'Loại phòng',
		description: 'Phòng thuộc loại nào (boarding_house, dormitory, ...)?',
		stage: 'collect-room-core',
		isOptional: false,
	},
	{
		key: 'room.totalRooms',
		label: 'Số lượng phòng',
		description: 'Có bao nhiêu phòng tương tự để mở bán?',
		stage: 'collect-room-core',
		isOptional: false,
	},
	{
		key: 'room.pricing.basePriceMonthly',
		label: 'Giá thuê',
		description: 'Giá thuê mỗi tháng là bao nhiêu?',
		stage: 'collect-room-core',
		isOptional: false,
	},
	{
		key: 'room.pricing.depositAmount',
		label: 'Tiền cọc',
		description: 'Tiền cọc cần thu là bao nhiêu?',
		stage: 'collect-room-core',
		isOptional: false,
	},
];

export function createEmptyRoomPublishingDraft(userId?: string): RoomPublishingDraft {
	return {
		stage: 'capture-context',
		userId,
		building: {},
		room: {
			pricing: {},
			amenities: [],
			costs: [],
			rules: [],
			images: [],
		},
		isReadyForSql: false,
		isReadyForExecution: false,
	};
}

export function listMissingBuildingFields(
	building: BuildingDraftState,
): RoomPublishingFieldRequirement[] {
	const missing: RoomPublishingFieldRequirement[] = [];
	if (!building.name) {
		missing.push(BUILDING_REQUIREMENTS[0]);
	}
	if (!building.districtId || !building.provinceId) {
		missing.push(BUILDING_REQUIREMENTS[1]);
	}
	return missing;
}

export function listMissingRoomFields(room: RoomDraftState): RoomPublishingFieldRequirement[] {
	const missing: RoomPublishingFieldRequirement[] = [];
	if (!room.name) {
		missing.push(ROOM_REQUIREMENTS[0]);
	}
	if (!room.roomType) {
		missing.push(ROOM_REQUIREMENTS[1]);
	}
	if (!room.totalRooms) {
		missing.push(ROOM_REQUIREMENTS[2]);
	}
	if (!room.pricing.basePriceMonthly) {
		missing.push(ROOM_REQUIREMENTS[3]);
	}
	if (!room.pricing.depositAmount) {
		missing.push(ROOM_REQUIREMENTS[4]);
	}
	return missing;
}

export function determineNextStage(draft: RoomPublishingDraft): RoomPublishingStage {
	if (listMissingBuildingFields(draft.building).length > 0) {
		return 'ensure-building';
	}
	if (listMissingRoomFields(draft.room).length > 0) {
		return 'collect-room-core';
	}
	if (!draft.isReadyForExecution) {
		return 'enrich-room';
	}
	return 'finalize-room';
}

export function markSqlReadiness(draft: RoomPublishingDraft): RoomPublishingDraft {
	const hasBuilding = listMissingBuildingFields(draft.building).length === 0;
	const hasRoom = listMissingRoomFields(draft.room).length === 0;
	draft.isReadyForSql = hasBuilding && hasRoom;
	return draft;
}

export function markExecutionReadiness(draft: RoomPublishingDraft): RoomPublishingDraft {
	const hasBuilding = listMissingBuildingFields(draft.building).length === 0;
	const hasRoom = listMissingRoomFields(draft.room).length === 0;
	draft.isReadyForExecution = hasBuilding && hasRoom;
	return draft;
}

export function applyRoomDefaults(room: RoomDraftState): RoomDraftState {
	room.maxOccupancy = room.maxOccupancy ?? 1;
	room.roomNumberStart = room.roomNumberStart ?? 1;
	room.pricing.depositMonths = room.pricing.depositMonths ?? 1;
	room.pricing.utilityIncluded = room.pricing.utilityIncluded ?? false;
	room.pricing.priceNegotiable = room.pricing.priceNegotiable ?? false;
	room.pricing.minimumStayMonths = room.pricing.minimumStayMonths ?? 1;
	return room;
}

export function getNextMandatoryQuestion(
	draft: RoomPublishingDraft,
): RoomPublishingFieldRequirement | null {
	const missingBuilding = listMissingBuildingFields(draft.building);
	if (missingBuilding.length > 0 && draft.stage === 'ensure-building') {
		return missingBuilding[0];
	}
	const missingRoom = listMissingRoomFields(draft.room);
	if (missingRoom.length > 0) {
		return missingRoom[0];
	}
	return null;
}

export function buildExecutionPlan(draft: RoomPublishingDraft): RoomPublishingExecutionPlan | null {
	if (!draft.isReadyForExecution) {
		return null;
	}
	const buildingPayload = draft.building.isExisting
		? undefined
		: {
				name: draft.building.name,
				addressLine1: draft.building.addressLine1 || `${draft.building.name}`,
				districtId: draft.building.districtId ?? 0,
				provinceId: draft.building.provinceId ?? 0,
				wardId: draft.building.wardId,
				country: draft.building.country || 'Vietnam',
			};
	const roomPayload = {
		name: draft.room.name!,
		description: draft.room.description,
		roomType: draft.room.roomType!,
		totalRooms: draft.room.totalRooms!,
		maxOccupancy: draft.room.maxOccupancy ?? 1,
		areaSqm: draft.room.areaSqm,
		floorNumber: draft.room.floorNumber,
		roomNumberPrefix: draft.room.roomNumberPrefix,
		roomNumberStart: draft.room.roomNumberStart ?? 1,
		pricing: {
			basePriceMonthly: draft.room.pricing.basePriceMonthly!,
			depositAmount: draft.room.pricing.depositAmount!,
			depositMonths: draft.room.pricing.depositMonths ?? 1,
			utilityIncluded: draft.room.pricing.utilityIncluded ?? false,
			utilityCostMonthly: draft.room.pricing.utilityCostMonthly,
			minimumStayMonths: draft.room.pricing.minimumStayMonths ?? 1,
			maximumStayMonths: draft.room.pricing.maximumStayMonths,
			priceNegotiable: draft.room.pricing.priceNegotiable ?? false,
		},
		amenities: draft.room.amenities,
		costs: draft.room.costs,
		rules: draft.room.rules,
		images: { images: draft.room.images },
	};
	return {
		shouldCreateBuilding: !draft.building.isExisting,
		buildingPayload,
		roomPayload,
		description: 'Create building (if needed) then create room with collected draft data.',
	};
}
