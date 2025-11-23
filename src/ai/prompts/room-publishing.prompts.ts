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
	systemCostTypes?: Array<{
		id: string;
		name: string;
		category: string;
		defaultUnit?: string;
	}>; // System cost types có sẵn
	systemAmenities?: Array<{
		id: string;
		name: string;
		category: string;
		description?: string;
	}>; // System amenities có sẵn
	systemRules?: Array<{
		id: string;
		name: string;
		category: string;
		description?: string;
	}>; // System rules có sẵn
}

/**
 * Build prompt for LLM to extract information from user message and auto-generate missing fields
 * Strategy: Only ask for essential info (price, location, images), auto-generate the rest
 */
export function buildRoomPublishingExtractionPrompt(
	params: RoomPublishingExtractionParams,
): string {
	const {
		userMessage,
		currentDraft,
		missingFields,
		userName,
		systemCostTypes = [],
		systemAmenities = [],
		systemRules = [],
	} = params;

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

SYSTEM_COST_TYPES (CHỈ SỬ DỤNG CÁC COST TYPES NÀY - BẮT BUỘC):
${
	systemCostTypes.length > 0
		? systemCostTypes
				.map(
					(ct) =>
						`- ID: ${ct.id}, Tên: ${ct.name}, Category: ${ct.category}, Default Unit: ${ct.defaultUnit || 'N/A'}`,
				)
				.join('\n')
		: '- Không có system cost types (KHÔNG tạo costs)'
}

SYSTEM_AMENITIES (CHỈ SỬ DỤNG CÁC AMENITIES NÀY - BẮT BUỘC):
${
	systemAmenities.length > 0
		? systemAmenities
				.map(
					(a) =>
						`- ID: ${a.id}, Tên: ${a.name}, Category: ${a.category}${a.description ? `, Mô tả: ${a.description}` : ''}`,
				)
				.join('\n')
		: '- Không có system amenities (KHÔNG tạo amenities)'
}

SYSTEM_RULES (CHỈ SỬ DỤNG CÁC RULES NÀY - BẮT BUỘC):
${
	systemRules.length > 0
		? systemRules
				.map(
					(r) =>
						`- ID: ${r.id}, Tên: ${r.name}, Category: ${r.category}${r.description ? `, Mô tả: ${r.description}` : ''}`,
				)
				.join('\n')
		: '- Không có system rules (KHÔNG tạo rules)'
}

QUAN TRỌNG VỀ COSTS - PHÂN TÍCH VÀ MAP ĐÚNG:
1. PHÂN TÍCH USER INPUT:
   - "điện 3k", "điện 3k/số", "điện 3000", "Điện 3k" → Tìm cost type có name chứa "điện" hoặc "electricity" trong SYSTEM_COST_TYPES
   - "nước 50k", "nước 50k/người", "nước 50000", "Nước 5k" → Tìm cost type có name chứa "nước" hoặc "water" trong SYSTEM_COST_TYPES
   - "internet 200k", "wifi 200k" → Tìm cost type có name chứa "internet", "wifi", "mạng" trong SYSTEM_COST_TYPES
   - "gửi xe 100k", "parking 100k" → Tìm cost type có name chứa "xe", "parking", "gửi xe" trong SYSTEM_COST_TYPES
   - "rác 50k", "waste 50k" → Tìm cost type có name chứa "rác", "waste", "garbage" trong SYSTEM_COST_TYPES

2. MAP ĐÚNG SYSTEM_COST_TYPE_ID:
   - PHẢI tìm kiếm trong danh sách SYSTEM_COST_TYPES ở trên
   - So sánh tên user input với name/nameEn của từng cost type
   - Chọn cost type có độ tương đồng cao nhất
   - Nếu không tìm thấy cost type phù hợp → KHÔNG tạo cost đó (bỏ qua)

3. XÁC ĐỊNH COST_TYPE VÀ UNIT:
   - costType: 
     * "metered" cho điện (theo số điện/kWh)
     * "per_unit" cho nước (theo người)
     * "fixed" cho các chi phí cố định (internet, gửi xe, rác, etc.)
   - unit:
     * "per_kwh" cho điện (metered)
     * "per_person" cho nước (per_unit)
     * "per_month" cho các chi phí cố định (fixed)
     * Hoặc sử dụng defaultUnit từ system cost type nếu có

4. VÍ DỤ MAP:
   - User: "điện 3k/số" → Tìm cost type "Điện" → systemCostTypeId = ID của cost type đó, costType = "metered", unit = "per_kwh", value = 3000
   - User: "nước 50k/người" → Tìm cost type "Nước" → systemCostTypeId = ID của cost type đó, costType = "per_unit", unit = "per_person", value = 50000
   - User: "internet 200k" → Tìm cost type "Internet" → systemCostTypeId = ID của cost type đó, costType = "fixed", unit = "per_month", value = 200000

5. LƯU Ý:
   - CHỈ tạo cost nếu tìm thấy systemCostTypeId hợp lệ trong SYSTEM_COST_TYPES
   - Nếu không tìm thấy → KHÔNG tạo cost đó (không báo lỗi, chỉ bỏ qua)
   - PHẢI phân tích kỹ user input để map đúng cost type

QUAN TRỌNG VỀ AMENITIES - PHÂN TÍCH VÀ MAP ĐÚNG:
1. PHÂN TÍCH USER INPUT:
   - Nếu user nói về tiện ích (ví dụ: "có điều hòa", "có wifi", "có máy nước nóng", "có tủ lạnh", "có ban công", "có WC riêng")
   - Tìm kiếm trong SYSTEM_AMENITIES để tìm amenity phù hợp
   - Map user input với tên amenity (có thể tìm theo từ khóa: "điều hòa" → "Điều hòa", "wifi" → "WiFi", "nước nóng" → "Máy nước nóng")

2. MAP ĐÚNG SYSTEM_AMENITY_ID:
   - PHẢI tìm kiếm trong danh sách SYSTEM_AMENITIES ở trên
   - So sánh tên user input với name của từng amenity
   - Chọn amenity có độ tương đồng cao nhất
   - Nếu không tìm thấy amenity phù hợp → KHÔNG tạo amenity đó (bỏ qua)

3. VÍ DỤ MAP:
   - User: "có điều hòa" → Tìm amenity "Điều hòa" → systemAmenityId = ID của amenity đó
   - User: "có wifi" → Tìm amenity "WiFi" → systemAmenityId = ID của amenity đó
   - User: "có máy nước nóng" → Tìm amenity "Máy nước nóng" → systemAmenityId = ID của amenity đó

QUAN TRỌNG VỀ RULES - PHÂN TÍCH VÀ MAP ĐÚNG:
1. PHÂN TÍCH USER INPUT:
   - Nếu user nói về quy tắc (ví dụ: "không hút thuốc", "không nuôi thú cưng", "giữ yên lặng sau 22h", "không được nấu ăn")
   - Tìm kiếm trong SYSTEM_RULES để tìm rule phù hợp
   - Map user input với tên rule (có thể tìm theo từ khóa: "hút thuốc" → "Không hút thuốc", "thú cưng" → "Không nuôi thú cưng")

2. MAP ĐÚNG SYSTEM_RULE_ID:
   - PHẢI tìm kiếm trong danh sách SYSTEM_RULES ở trên
   - So sánh tên user input với name của từng rule
   - Chọn rule có độ tương đồng cao nhất
   - Nếu không tìm thấy rule phù hợp → KHÔNG tạo rule đó (bỏ qua)

3. VÍ DỤ MAP:
   - User: "không hút thuốc" → Tìm rule "Không hút thuốc" → systemRuleId = ID của rule đó
   - User: "không nuôi thú cưng" → Tìm rule "Không nuôi thú cưng" → systemRuleId = ID của rule đó

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

5. Chuẩn hóa đơn vị (QUAN TRỌNG - PHẢI TRẢ VỀ SỐ VNĐ):
   - "triệu", "tr", "M", "million" → nhân 1,000,000 (ví dụ: "5 triệu" → 5000000, "2.5 triệu" → 2500000)
   - "k", "nghìn", "thousand" → nhân 1,000 (ví dụ: "3k" → 3000, "50k" → 50000)
   - Giá điện/nước: luôn tính theo VNĐ (nếu có "k" → nhân 1,000)
   - LƯU Ý: PHẢI trả về số VNĐ đầy đủ, KHÔNG trả về số nhỏ (ví dụ: "5 triệu" phải là 5000000, KHÔNG phải 5)

6. TỰ ĐỘNG SUY LUẬN:
   - Nếu có "phòng trọ" → roomType = "boarding_house"
   - Nếu có "phòng bình thường" → roomType = "boarding_house", totalRooms = 1
   - Nếu có "1 phòng" → totalRooms = 1
   - Nếu có tên tòa nhà trong tin nhắn → building.name
   - Nếu có "Ở gò vấp" → location = "Gò Vấp Hồ Chí Minh"

TRẢ VỀ THEO FORMAT JSON (PHẢI KHỚP VỚI DTO STRUCTURE):
{
  "building": {
    "name": "Tên tòa nhà (string, bắt buộc nếu không có buildingId). Tự tạo từ địa chỉ + tên người dùng nếu không có (ví dụ: 'Nhà trọ Gò Vấp - ${userName || 'Chủ nhà'}')",
    "location": "Địa điểm dạng text (string, null nếu không có). Ví dụ: 'Gò Vấp Hồ Chí Minh', 'Quận 1 TP.HCM'. Sẽ được resolve thành districtId, provinceId sau"
  },
  "room": {
    "name": "Tên phòng (string, bắt buộc). Tự tạo nếu không có (ví dụ: 'Phòng trọ ABC')",
    "roomType": "Loại phòng (string enum: 'boarding_house' | 'dormitory' | 'sleepbox' | 'apartment' | 'whole_house'). Mặc định 'boarding_house'",
    "totalRooms": "Số lượng phòng (number, bắt buộc, >= 1). Mặc định 1",
    "areaSqm": "Diện tích phòng (number, optional, đơn vị m²). Ví dụ: 20, 25.5",
    "maxOccupancy": "Số người ở tối đa (number, optional, >= 1). Mặc định 2",
    "floorNumber": "Số tầng (number, optional, >= 0). Mặc định 1",
    "description": "Mô tả HTML (string, optional, max 1000 ký tự). Tự tạo HTML dài 200-500 từ với các thẻ: <h3>, <p>, <ul>, <li>, <strong>, <em>",
    "pricing": {
      "basePriceMonthly": "Giá thuê/tháng (number, bắt buộc, đơn vị VNĐ, >= 0). null nếu không có (CẦN HỎI)",
      "depositAmount": "Tiền cọc (number, optional, đơn vị VNĐ, >= 0). Mặc định = basePriceMonthly nếu không có",
      "depositMonths": "Số tháng cọc (number, optional, 1-12). Mặc định 1",
      "utilityIncluded": "Tiện ích đã bao trong giá (boolean, optional). Mặc định false",
      "utilityCostMonthly": "Chi phí tiện ích/tháng (number, optional, đơn vị VNĐ, >= 0)",
      "minimumStayMonths": "Số tháng ở tối thiểu (number, optional, 1-60). Mặc định 1",
      "maximumStayMonths": "Số tháng ở tối đa (number, optional, 1-60)",
      "priceNegotiable": "Có thể thương lượng (boolean, optional). Mặc định false"
    },
    "costs": [
      {
        "systemCostTypeId": "ID của system cost type (string, BẮT BUỘC, PHẢI là một trong các ID có sẵn trong SYSTEM_COST_TYPES)",
        "value": "Giá trị chi phí (number, bắt buộc, đơn vị VNĐ, >= 0)",
        "costType": "Loại tính phí (string enum: 'fixed' | 'per_unit' | 'metered' | 'percentage' | 'tiered'). Mặc định 'fixed'",
        "unit": "Đơn vị (string, optional, max 50 ký tự). Ví dụ: 'per_kwh', 'per_person', 'per_month', 'kWh'",
        "billingCycle": "Chu kỳ thanh toán (string enum: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'per_use'). Mặc định 'monthly'",
        "includedInRent": "Bao gồm trong tiền thuê (boolean, optional). Mặc định false",
        "isOptional": "Tùy chọn (boolean, optional). Mặc định false",
        "notes": "Ghi chú (string, optional, max 500 ký tự)"
      }
    ],
    "amenities": [
      {
        "systemAmenityId": "ID của system amenity (string, bắt buộc)",
        "customValue": "Giá trị tùy chỉnh (string, optional, max 255 ký tự). Ví dụ: '2 chiếc'",
        "notes": "Ghi chú (string, optional, max 500 ký tự)"
      }
    ],
    "rules": [
      {
        "systemRuleId": "ID của system rule (string, bắt buộc)",
        "customValue": "Giá trị tùy chỉnh (string, optional, max 255 ký tự). Ví dụ: 'Sau 22h00'",
        "isEnforced": "Có được thực thi (boolean, optional). Mặc định true",
        "notes": "Ghi chú (string, optional, max 500 ký tự)"
      }
    ]
  }
}

QUAN TRỌNG VỀ FORMAT JSON:
- TẤT CẢ các field phải đúng kiểu dữ liệu (string, number, boolean, array, object)
- Các field bắt buộc KHÔNG được null hoặc undefined
- Các field optional có thể null hoặc không có trong JSON
- Enum values PHẢI đúng với các giá trị được định nghĩa
- Numbers PHẢI là số nguyên hoặc số thập phân hợp lệ (không có dấu phẩy, không có ký tự)
- Arrays PHẢI là mảng hợp lệ (có thể rỗng [])
- Objects PHẢI có cấu trúc đúng với DTO structure

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
