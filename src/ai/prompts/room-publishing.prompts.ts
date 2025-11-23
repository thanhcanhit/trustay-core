import {
	BuildingCandidate,
	RoomPublishingFieldRequirement,
	RoomPublishingStage,
} from '../types/room-publishing.types';

export function buildStageIntroPrompt(stage: RoomPublishingStage): string {
	if (stage === 'capture-context') {
		return `Chào bạn! Mình sẽ giúp bạn đăng phòng trọ nhanh chóng.`;
	}
	if (stage === 'ensure-building') {
		return `Bạn cho mình biết địa điểm (quận/huyện và tỉnh/thành) và giá thuê mỗi tháng nhé.`;
	}
	if (stage === 'collect-room-core') {
		return `Bạn cho mình biết giá thuê mỗi tháng và địa điểm nhé.`;
	}
	if (stage === 'enrich-room') {
		return `Tuyệt vời! Bạn có muốn thêm hình ảnh phòng không? (Không bắt buộc)`;
	}
	return `Hoàn tất! Mình sẽ tạo phòng trọ cho bạn ngay.`;
}

export function buildMissingFieldPrompt(field: RoomPublishingFieldRequirement): string {
	if (field.key === 'room.pricing.basePriceMonthly') {
		return '• Giá thuê mỗi tháng (ví dụ: 2 triệu, 3000000)';
	}
	if (field.key === 'room.pricing.depositAmount') {
		return '• Tiền cọc (ví dụ: 7 triệu, 7000000)';
	}
	if (field.key === 'room.roomType') {
		return '• Loại phòng (ví dụ: boarding_house, dormitory, apartment)';
	}
	if (field.key === 'room.totalRooms') {
		return '• Số lượng phòng (ví dụ: 1 phòng, 5 phòng)';
	}
	if (field.key === 'room.name') {
		return '• Tên phòng (ví dụ: Phòng 101, Phòng trọ ABC)';
	}
	if (field.key === 'building.name') {
		return '• Tên tòa nhà (ví dụ: Nhà trọ ABC, Chung cư XYZ)';
	}
	if (field.key === 'building.location') {
		return '• Địa điểm (ví dụ: Quận 1 TP.HCM, Gò Vấp Hồ Chí Minh)';
	}
	return `• ${field.description}`;
}

export function buildUtilitySuggestionPrompt(): string {
	return 'Để phòng của bạn nổi bật hơn, bạn chia sẻ giá điện, giá nước và các tiện ích nổi bật được không?';
}

export function buildImageSuggestionPrompt(): string {
	return 'Bạn có thể gửi hình ảnh phòng để mình thêm vào phần hình ảnh của phòng.';
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

// ==================== ROOM PUBLISHING EXTRACTION & ENRICHMENT ====================

export interface RoomPublishingExtractionParams {
	userMessage: string;
	currentDraft: {
		building: {
			name?: string;
			locationHint?: string;
			districtId?: number;
			provinceId?: number;
		};
		room: {
			name?: string;
			roomType?: string;
			totalRooms?: number;
			pricing: {
				basePriceMonthly?: number;
				depositAmount?: number;
			};
			costs: Array<{
				costType?: string;
				value?: number;
				unit?: string;
			}>;
		};
	};
	missingFields: Array<{
		key: string;
		label: string;
		description: string;
	}>;
	userName?: string; // Tên người dùng để tạo tên building nếu không có
}

/**
 * Build prompt for LLM to extract information from user message and auto-generate missing fields
 * Strategy: Only ask for essential info (price, location, images), auto-generate the rest
 */
export function buildRoomPublishingExtractionPrompt(
	params: RoomPublishingExtractionParams,
): string {
	const { userMessage, currentDraft, missingFields, userName } = params;

	// Chỉ hỏi những field thật sự cần thiết: giá cả, vị trí (chỉ khi không có buildingId)
	// building.name sẽ được tự động tạo từ địa chỉ + tên người dùng
	const essentialFields = missingFields.filter(
		(f) =>
			f.key === 'room.pricing.basePriceMonthly' ||
			f.key === 'room.pricing.depositAmount' ||
			f.key === 'building.location', // Chỉ hỏi location nếu không có buildingId
	);

	return `Bạn là AI Agent chuyên trích xuất và TỰ ĐỘNG TẠO thông tin cho việc đăng phòng trọ.

NHIỆM VỤ:
1. Trích xuất thông tin từ tin nhắn người dùng
2. TỰ ĐỘNG TẠO các thông tin còn thiếu (description, tên phòng, loại phòng, số phòng, etc.)
3. CHỈ hỏi lại những gì THẬT SỰ CẦN THIẾT: giá cả, vị trí địa lý, hình ảnh

TIN NHẮN NGƯỜI DÙNG:
"${userMessage}"

THÔNG TIN HIỆN TẠI (đã có):
- Tên tòa nhà: ${currentDraft.building.name || 'Chưa có'}
- Địa điểm: ${currentDraft.building.locationHint || 'Chưa có'} ${
		currentDraft.building.districtId && currentDraft.building.provinceId ? '(Đã xác định)' : ''
	}
- Tên phòng: ${currentDraft.room.name || 'Chưa có'}
- Loại phòng: ${currentDraft.room.roomType || 'Chưa có'}
- Số lượng phòng: ${currentDraft.room.totalRooms || 'Chưa có'}
- Giá thuê/tháng: ${
		currentDraft.room.pricing.basePriceMonthly
			? `${currentDraft.room.pricing.basePriceMonthly.toLocaleString('vi-VN')} VNĐ`
			: 'Chưa có'
	}
- Tiền cọc: ${
		currentDraft.room.pricing.depositAmount
			? `${currentDraft.room.pricing.depositAmount.toLocaleString('vi-VN')} VNĐ`
			: 'Chưa có'
	}
- Chi phí khác: ${
		currentDraft.room.costs.length > 0
			? currentDraft.room.costs.map((c) => `${c.costType}: ${c.value}`).join(', ')
			: 'Chưa có'
	}

THÔNG TIN CẦN THIẾT (CHỈ những gì thật sự cần hỏi):
${essentialFields.map((f) => `- ${f.label}: ${f.description}`).join('\n')}

QUY TẮC TRÍCH XUẤT VÀ TỰ ĐỘNG TẠO (QUAN TRỌNG - FLOW NHANH CHO NGƯỜI ÍT DÙNG CÔNG NGHỆ):
1. TỰ TỔNG HỢP THÔNG TIN - QUAN TRỌNG NHẤT:
   - Nếu thông tin đã có trong "THÔNG TIN HIỆN TẠI" → PHẢI trả về giá trị đó (KHÔNG để null)
   - Ví dụ: THÔNG TIN HIỆN TẠI có "Giá thuê/tháng: 2,000,000 VNĐ" → basePriceMonthly phải là 2000000

2. TỰ ĐỘNG TẠO CÁC THÔNG TIN CÒN THIẾU (MẶC ĐỊNH CHO PHÒNG TRỌ):
   - Loại phòng: LUÔN là "boarding_house" (phòng trọ) - KHÔNG BAO GIỜ hỏi
   - Số lượng phòng: Mặc định 1 - KHÔNG BAO GIỜ hỏi
   - Tên tòa nhà: Nếu không có → tự tạo từ địa chỉ + tên người dùng
     Ví dụ: "Nhà trọ Gò Vấp - ${userName || 'Chủ nhà'}" hoặc "Trọ Quận 1 - ${userName || 'Chủ nhà'}"
   - Tên phòng: Nếu không có → "Phòng trọ ${currentDraft.building.name || 'ABC'}"
   - Tiền cọc: Nếu không có → mặc định = 1 tháng tiền thuê (basePriceMonthly)
   - Description: Tự tạo mô tả HTML DÀI VÀ SÁNG TẠO (200-500 từ) dựa trên thông tin có sẵn
     * PHẢI là HTML hợp lệ với các thẻ: <p>, <h3>, <ul>, <li>, <strong>, <em>
     * Bao gồm: Giới thiệu phòng, Vị trí thuận lợi, Tiện ích, Giá cả
     * Ví dụ format:
       <h3>🏠 Giới thiệu phòng trọ</h3>
       <p>Phòng trọ <strong>${currentDraft.room.pricing.basePriceMonthly ? `${(currentDraft.room.pricing.basePriceMonthly / 1000000).toFixed(1)} triệu/tháng` : 'giá rẻ'}</strong> tại <strong>${currentDraft.building.locationHint || 'khu vực đẹp'}</strong>...</p>
       <h3>📍 Vị trí thuận lợi</h3>
       <p>...</p>
       <h3>✨ Tiện ích</h3>
       <ul>...</ul>
   - Các trường mặc định khác (KHÔNG BAO GIỜ hỏi):
     * maxOccupancy: 2 người
     * floorNumber: 1
     * roomNumberPrefix: "P"
     * roomNumberStart: 1
     * depositMonths: 1
     * minimumStayMonths: 1
     * priceNegotiable: false
     * utilityIncluded: false

3. CHỈ HỎI LẠI NHỮNG GÌ THẬT SỰ CẦN THIẾT (TỐI THIỂU):
   - Giá thuê/tháng (basePriceMonthly) - BẮT BUỘC DUY NHẤT
   - Vị trí địa lý (building.location) - BẮT BUỘC (chỉ khi không có buildingId)
   - Hình ảnh - Khuyến khích nhưng không bắt buộc, có thể bỏ qua
   - TẤT CẢ các thông tin khác → TỰ ĐỘNG TẠO, KHÔNG BAO GIỜ HỎI
   - LƯU Ý: Đây là flow NHANH cho người ít dùng công nghệ, cần đơn giản tối đa

4. Xử lý các cách viết khác nhau:
   - Địa điểm: "Quận 1", "Q.1", "Gò Vấp", "Gò vấp Hồ Chí Minh", "TP.HCM", "HCM", "gò vấp hồ chí minh", "Ở gò vấp"
   - Tên tòa nhà: "toà nhà Kahn", "tòa nhà ABC", "nhà trọ XYZ", "Kahn"
   - Giá: "2 triệu", "2tr", "2000000", "2M", "phòng 2 triệu", "giá 2 triệu/tháng", "2.5 triệu"
   - Cọc: "cọc 1 triệu", "tiền cọc 1tr", "deposit 1 triệu"
   - Điện: "điện 3k", "điện 3000", "điện 3k/số", "điện 3 nghìn", "Điện 3k"
   - Nước: "nước 50k", "nước 50000", "nước 50k/người", "nước 50 nghìn", "Nước 5k"
   - Số phòng: "1 phòng", "5 phòng", "một phòng", "phòng bình thường" (có thể là 1 phòng)
   - Loại phòng: "phòng trọ" → boarding_house, "phòng bình thường" → boarding_house

5. Chuẩn hóa đơn vị:
   - "triệu", "tr", "M", "million" → nhân 1,000,000
   - "k", "nghìn", "thousand" → nhân 1,000
   - Giá điện/nước: luôn tính theo VNĐ (nếu có "k" → nhân 1,000)

6. TỰ ĐỘNG SUY LUẬN:
   - Nếu có "phòng trọ" → roomType = "boarding_house"
   - Nếu có "phòng bình thường" → roomType = "boarding_house", totalRooms = 1
   - Nếu có "1 phòng" → totalRooms = 1
   - Nếu có tên tòa nhà trong tin nhắn → building.name
   - Nếu có "Ở gò vấp" → location = "Gò Vấp Hồ Chí Minh"

TRẢ VỀ THEO FORMAT JSON:
{
  "building": {
    "name": "Tên tòa nhà nếu có trong tin nhắn HOẶC đã có trong THÔNG TIN HIỆN TẠI, HOẶC tự tạo từ địa chỉ + tên người dùng nếu không có (ví dụ: 'Nhà trọ Gò Vấp - ${userName || 'Chủ nhà'}' hoặc 'Trọ Quận 1 - ${userName || 'Chủ nhà'}')",
    "location": "Địa điểm nếu có trong tin nhắn HOẶC đã có trong THÔNG TIN HIỆN TẠI, null nếu không có cả hai (CẦN HỎI nếu không có buildingId)"
  },
  "room": {
    "name": "Tên phòng nếu có trong tin nhắn HOẶC đã có trong THÔNG TIN HIỆN TẠI, HOẶC tự tạo nếu không có (ví dụ: 'Phòng trọ ABC' hoặc 'Phòng 1 - Tòa nhà XYZ')",
    "roomType": "Loại phòng nếu có trong tin nhắn HOẶC đã có trong THÔNG TIN HIỆN TẠI, HOẶC mặc định 'boarding_house' nếu không có",
    "totalRooms": "Số lượng phòng nếu có trong tin nhắn HOẶC đã có trong THÔNG TIN HIỆN TẠI, HOẶC mặc định 1 nếu không có",
    "description": "Mô tả HTML DÀI VÀ SÁNG TẠO (200-500 từ) tự tạo dựa trên thông tin có sẵn. PHẢI là HTML hợp lệ với các thẻ: <h3>, <p>, <ul>, <li>, <strong>, <em>. Bao gồm: Giới thiệu phòng, Vị trí thuận lợi, Tiện ích, Giá cả. Ví dụ: '<h3>🏠 Giới thiệu phòng trọ</h3><p>Phòng trọ <strong>2.5 triệu/tháng</strong> tại <strong>Gò Vấp Hồ Chí Minh</strong>...</p><h3>📍 Vị trí thuận lợi</h3><p>...</p><h3>✨ Tiện ích</h3><ul><li>...</li></ul>'",
    "pricing": {
      "basePriceMonthly": "Giá thuê/tháng nếu có trong tin nhắn HOẶC đã có trong THÔNG TIN HIỆN TẠI (số nguyên, đơn vị VNĐ), null nếu không có cả hai (CẦN HỎI)",
      "depositAmount": "Tiền cọc nếu có trong tin nhắn HOẶC đã có trong THÔNG TIN HIỆN TẠI (số nguyên, đơn vị VNĐ), null nếu không có cả hai"
    },
    "costs": [
      {
        "costType": "ELECTRICITY" hoặc "WATER",
        "value": "Giá trị (số nguyên, đơn vị VNĐ)",
        "unit": "per_kwh" cho điện, "per_person" cho nước
      }
    ]
  }
}

QUAN TRỌNG - TỰ TỔNG HỢP VÀ TỰ TẠO:
- Nếu thông tin đã có trong "THÔNG TIN HIỆN TẠI" → PHẢI trả về giá trị đó (KHÔNG để null)
- Nếu thông tin có trong tin nhắn → trích xuất và trả về
- Nếu thông tin KHÔNG có trong cả hai → TỰ ĐỘNG TẠO (name, roomType, totalRooms, description)
- CHỈ để null cho: basePriceMonthly (nếu không có), building.location (nếu không có) - đây là những gì CẦN HỎI

VÍ DỤ:
- THÔNG TIN HIỆN TẠI: "Giá thuê/tháng: 2,000,000 VNĐ", "Địa điểm: Gò Vấp Hồ Chí Minh"
- Tin nhắn: "1 phòng 2 triệu, cọc 1 triệu, toà nhà Kahn, gò vấp hồ chí minh. Điện 3k nước 5k"
- → basePriceMonthly = 2000000 (giữ nguyên), location = "Gò Vấp Hồ Chí Minh" (giữ nguyên)
- → name = "Phòng trọ Kahn" (tự tạo), roomType = "boarding_house" (tự tạo), totalRooms = 1 (từ tin nhắn)
- → description = "Phòng trọ 2 triệu tại Gò Vấp Hồ Chí Minh. Điện 3k/số, nước 5k/người. Giá hợp lý, tiện nghi." (tự tạo)

LƯU Ý:
- CHỈ trả về JSON, KHÔNG có text giải thích
- Đảm bảo JSON hợp lệ, có thể parse được
- TỰ TỔNG HỢP: Giữ nguyên thông tin đã có, chỉ cập nhật thông tin mới
- TỰ TẠO: Tạo các thông tin còn thiếu (name, description, roomType, totalRooms) nếu không có

JSON:`;
}
