import {
	BuildingCandidate,
	RoomPublishingFieldRequirement,
	RoomPublishingStage,
} from '../types/room-publishing.types';

const STAGE_TITLES: Record<RoomPublishingStage, string> = {
	'capture-context': 'Bắt đầu đăng phòng',
	'ensure-building': 'Xác nhận tòa nhà',
	'collect-room-core': 'Thu thập thông tin phòng',
	'enrich-room': 'Làm phòng nổi bật hơn',
	'finalize-room': 'Xác nhận đăng phòng',
};

export function buildStageIntroPrompt(stage: RoomPublishingStage): string {
	const title = STAGE_TITLES[stage];
	if (stage === 'capture-context') {
		return `${title}: Mình sẽ giúp bạn đăng phòng mới. Bạn đang muốn đăng phòng cho tòa nhà nào vậy?`;
	}
	if (stage === 'ensure-building') {
		return `${title}: Cho mình biết tên tòa nhà và quận/tỉnh để mình tự gắn với hệ thống nhé.`;
	}
	if (stage === 'collect-room-core') {
		return `${title}: Mình cần vài thông tin cơ bản của phòng để có thể tạo bản nháp.`;
	}
	if (stage === 'enrich-room') {
		return `${title}: Để phòng của bạn nổi bật hơn, bạn có thể chia sẻ tiện ích, giá điện nước hoặc hình ảnh không?`;
	}
	return `${title}: Kiểm tra lại thông tin, mình sẽ gửi sang hệ thống để tạo phòng ngay.`;
}

export function buildMissingFieldPrompt(field: RoomPublishingFieldRequirement): string {
	if (field.key === 'room.pricing.basePriceMonthly') {
		return 'Giá thuê mỗi tháng là bao nhiêu để mình hiển thị cho người thuê?';
	}
	if (field.key === 'room.pricing.depositAmount') {
		return 'Bạn muốn thu tiền cọc bao nhiêu? Ví dụ: 7000000.';
	}
	if (field.key === 'room.roomType') {
		return 'Phòng thuộc loại nào (boarding_house, dormitory, apartment...)?';
	}
	if (field.key === 'room.totalRooms') {
		return 'Có bao nhiêu phòng giống nhau để mình tạo số phòng tương ứng?';
	}
	if (field.key === 'building.location') {
		return 'Bạn cho mình biết phòng ở quận/huyện nào và thuộc tỉnh/thành nào nhé.';
	}
	return field.description;
}

export function buildUtilitySuggestionPrompt(): string {
	return 'Để phòng của bạn nổi bật hơn, bạn chia sẻ giá điện, giá nước và các tiện ích nổi bật được không?';
}

export function buildImageSuggestionPrompt(): string {
	return 'Bạn có thể gửi đường dẫn hình ảnh hoặc mô tả ngắn để mình thêm vào phần hình ảnh của phòng.';
}

export function buildBuildingSelectionPrompt(candidates: BuildingCandidate[]): string {
	if (candidates.length === 0) {
		return 'Mình không tìm thấy tòa nhà nào trùng khớp. Bạn muốn tạo tòa nhà mới hay thử nhập lại tên khác?';
	}
	const optionLines = candidates
		.map((candidate, index) => {
			const location = [candidate.districtName, candidate.provinceName].filter(Boolean).join(', ');
			return `${index + 1}. ${candidate.name}${location ? ` (${location})` : ''}`;
		})
		.join('\n');
	return `Mình thấy vài tòa nhà có thể trùng với tên bạn cung cấp. Bạn chọn giúp mình số tương ứng hoặc gõ "mới" để tạo tòa nhà mới:\n${optionLines}`;
}
