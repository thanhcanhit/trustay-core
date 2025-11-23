import {
	BuildingCandidate,
	RoomPublishingFieldRequirement,
	RoomPublishingStage,
} from '../types/room-publishing.types';

export function buildStageIntroPrompt(stage: RoomPublishingStage): string {
	switch (stage) {
		case 'capture-context':
			return `Chào bạn! Mình là trợ lý ảo Trustay. Mình sẽ giúp bạn đăng tin phòng trọ chỉ trong vài bước đơn giản nhé.`;
		case 'ensure-building':
			return `Đầu tiên, bạn cho mình biết **địa chỉ chính xác** (Quận/Huyện, Tỉnh/Thành) và **tên tòa nhà** (nếu có) nhé?`;
		case 'collect-room-core':
			return `Bây giờ đến phần quan trọng nhất: **Giá thuê** và **Diện tích** (hoặc loại phòng) bạn mong muốn là bao nhiêu?`;
		case 'enrich-room':
			return `Sắp xong rồi! Bạn có muốn tải lên vài tấm **hình ảnh** để phòng thu hút hơn không? (Bạn có thể bỏ qua nếu chưa có ảnh ngay)`;
		default:
			return `Tuyệt vời! Thông tin đã đủ. Mình đang tạo phòng cho bạn đây...`;
	}
}

export function buildMissingFieldPrompt(field: RoomPublishingFieldRequirement): string {
	const prompts: Record<string, string> = {
		'room.pricing.basePriceMonthly': '• Giá thuê phòng 1 tháng là bao nhiêu?',
		'room.pricing.depositAmount': '• Tiền cọc là bao nhiêu? (Thường là 1 tháng tiền nhà)',
		'room.roomType': '• Đây là loại hình gì? (Ví dụ: Phòng trọ, Ký túc xá, Căn hộ dịch vụ)',
		'room.totalRooms': '• Bạn có bao nhiêu phòng trống loại này?',
		'room.name': '• Bạn muốn đặt tên phòng là gì? (Ví dụ: Phòng 101, Phòng ban công)',
		'building.name': '• Tên tòa nhà/khu trọ là gì?',
		'building.location': '• Địa chỉ cụ thể ở đâu (Quận, Thành phố)?',
	};
	return prompts[field.key] || `• ${field.description}`;
}

export function buildUtilitySuggestionPrompt(): string {
	return '💡 Mẹo: Tin đăng có chi tiết giá điện, nước và tiện ích (Wifi, máy lạnh...) thường được thuê nhanh hơn 30%. Bạn có muốn bổ sung không?';
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
		userName,
		systemCostTypes = [],
		systemAmenities = [],
		systemRules = [],
	} = params;

	// Serialize data để tiết kiệm token và dễ đọc hơn cho LLM
	const contextData = JSON.stringify(
		{
			current_building: {
				name: currentDraft.building.name,
				locationHint: currentDraft.building.locationHint,
				districtId: currentDraft.building.districtId,
				provinceId: currentDraft.building.provinceId,
			},
			current_room: {
				name: currentDraft.room.name,
				roomType: currentDraft.room.roomType,
				totalRooms: currentDraft.room.totalRooms,
				pricing: currentDraft.room.pricing,
				costs: currentDraft.room.costs,
			},
			defaults: {
				userName: userName || 'Chủ nhà',
				roomType: 'boarding_house',
				currency: 'VND',
			},
		},
		null,
		2,
	);

	const referenceData = JSON.stringify(
		{
			valid_cost_types: systemCostTypes.map((c) => ({
				id: c.id,
				names: [c.name],
				category: c.category,
				default_unit: c.defaultUnit,
			})),
			valid_amenities: systemAmenities.map((a) => ({
				id: a.id,
				name: a.name,
				category: a.category,
			})),
			valid_rules: systemRules.map((r) => ({
				id: r.id,
				name: r.name,
				category: r.category,
			})),
		},
		null,
		2,
	);

	return `Bạn là AI Assistant chuyên trích xuất thông tin đăng phòng trọ.
Nhiệm vụ: Phân tích tin nhắn người dùng, kết hợp với dữ liệu hiện có để tạo ra JSON cập nhật.

### INPUT DATA

<user_message>
"${userMessage}"
</user_message>

<current_state>
${contextData}
</current_state>

<reference_system_data>
${referenceData}
</reference_system_data>

### HƯỚNG DẪN XỬ LÝ (PROCESSING RULES)

1. **Nguyên tắc trích xuất:**
   - Ưu tiên thông tin mới nhất từ <user_message>.
   - Nếu <user_message> không có, giữ nguyên thông tin từ <current_state>.
   - Nếu cả hai đều không có, sử dụng logic "Tự động tạo" (Autofill) dưới đây.

2. **Autofill & Defaults (Chỉ khi thiếu thông tin):**
   - \`room.roomType\`: Mặc định là "boarding_house".
   - \`room.totalRooms\`: Mặc định là 1.
   - \`building.name\`: Tự tạo theo format "Trọ + [Địa điểm] + [Tên chủ]" hoặc "Nhà trọ + [Địa điểm] - [Tên chủ]".
   - \`room.name\`: Tự tạo theo format "Phòng trọ + [Mã/Tên Building]".
   - \`room.description\`: Tự viết một đoạn HTML ngắn (200-300 từ) quảng cáo phòng dựa trên các thông tin đã có (giá, địa điểm, tiện ích). Dùng thẻ <h3>, <p>, <ul>, <li>, <strong>, <em>.
   - \`room.pricing.depositAmount\`: Nếu không có, mặc định = \`basePriceMonthly\`.
   - Các trường khác: maxOccupancy=2, floorNumber=1, depositMonths=1, minimumStayMonths=1, priceNegotiable=false, utilityIncluded=false.

3. **Xử lý Tiền tệ & Đơn vị:**
   - Mọi số tiền phải quy đổi về VNĐ (số nguyên). Ví dụ: "3 triệu" -> 3000000, "500k" -> 500000, "2.5 triệu" -> 2500000.
   - Các đơn vị (k, tr, củ, nghìn) phải được hiểu đúng theo văn nói tiếng Việt.
   - LƯU Ý: PHẢI trả về số VNĐ đầy đủ, KHÔNG trả về số nhỏ (ví dụ: "5 triệu" phải là 5000000, KHÔNG phải 5).

4. **Mapping Logic (Quan trọng):**
   - **Costs:** Dựa vào <reference_system_data>. Tìm cost type có tên gần đúng nhất với input (fuzzy matching).
     - *Lưu ý về costType và unit:*
       - Nếu user nói "điện 3k", "điện 3.5k", "điện 3k/số" → hiểu là giá theo kWh (metered, per_kwh).
       - Nếu user nói "điện 200k/tháng" → hiểu là giá cố định theo tháng (fixed, per_month).
       - Nếu user nói "nước 50k", "nước 50k/người", "nước 50k 1 người" → hiểu là giá theo đầu người (per_unit, per_person).
       - Nếu user nói "nước 100k/tháng" → hiểu là giá cố định theo tháng (fixed, per_month).
       - Các chi phí khác (internet, gửi xe, rác) → thường là fixed, per_month.
     - CHỈ tạo cost nếu tìm thấy systemCostTypeId hợp lệ trong <reference_system_data>. Nếu không tìm thấy → bỏ qua (không báo lỗi).
   
   - **Amenities:** Fuzzy match từ khóa trong user message với danh sách trong <reference_system_data>.
     - Ví dụ: "có điều hòa" → tìm amenity có name chứa "điều hòa" hoặc "máy lạnh".
     - CHỈ tạo amenity nếu tìm thấy systemAmenityId hợp lệ. Nếu không tìm thấy → bỏ qua.
   
   - **Rules:** Fuzzy match từ khóa trong user message với danh sách trong <reference_system_data>.
     - Ví dụ: "không hút thuốc" → tìm rule có name chứa "hút thuốc" hoặc "smoking".
     - CHỈ tạo rule nếu tìm thấy systemRuleId hợp lệ. Nếu không tìm thấy → bỏ qua.

5. **Xử lý các cách viết khác nhau:**
   - Địa điểm: "Quận 1", "Q.1", "Gò Vấp", "Gò vấp Hồ Chí Minh", "TP.HCM", "HCM", "gò vấp hồ chí minh", "Ở gò vấp"
   - Tên tòa nhà: "toà nhà Kahn", "tòa nhà ABC", "nhà trọ XYZ", "Kahn"
   - Giá: "2 triệu", "2tr", "2000000", "2M", "phòng 2 triệu", "giá 2 triệu/tháng", "2.5 triệu"
   - Cọc: "cọc 1 triệu", "tiền cọc 1tr", "deposit 1 triệu"
   - Điện: "điện 3k", "điện 3.5k", "điện 3000", "điện 3k/số", "điện 3 nghìn", "Điện 3k", "điện 200k/tháng"
   - Nước: "nước 50k", "nước 50000", "nước 50k/người", "nước 50 nghìn", "Nước 5k", "nước 50k 1 người", "nước 100k/tháng"
   - Số phòng: "1 phòng", "5 phòng", "một phòng", "phòng bình thường" (có thể là 1 phòng)
   - Loại phòng: "phòng trọ" → boarding_house, "phòng bình thường" → boarding_house

### OUTPUT FORMAT

Trả về **duy nhất** một JSON object hợp lệ (không markdown, không text dẫn dắt).

Cấu trúc JSON bắt buộc tuân thủ interface sau:

\`\`\`json
{
  "building": {
    "name": "string (bắt buộc, tự tạo nếu thiếu)",
    "location": "string | null (trích xuất địa điểm thô từ text, null nếu không có)"
  },
  "room": {
    "name": "string (bắt buộc, tự tạo nếu thiếu)",
    "roomType": "boarding_house" | "dormitory" | "apartment" | "sleepbox" | "whole_house",
    "totalRooms": "number (>= 1, mặc định 1)",
    "areaSqm": "number | null (optional)",
    "maxOccupancy": "number | null (optional, mặc định 2)",
    "floorNumber": "number | null (optional, mặc định 1)",
    "description": "string | null (HTML, optional, tự tạo nếu thiếu)",
    "pricing": {
      "basePriceMonthly": "number | null (VNĐ, null nếu chưa có thông tin)",
      "depositAmount": "number | null (VNĐ, optional)",
      "depositMonths": "number | null (optional, mặc định 1)",
      "utilityIncluded": "boolean | null (optional, mặc định false)",
      "utilityCostMonthly": "number | null (VNĐ, optional)",
      "minimumStayMonths": "number | null (optional, mặc định 1)",
      "maximumStayMonths": "number | null (optional)",
      "priceNegotiable": "boolean | null (optional, mặc định false)"
    },
    "costs": [
      {
        "systemCostTypeId": "string (BẮT BUỘC, ID từ reference_system_data)",
        "value": "number (VNĐ, >= 0)",
        "costType": "fixed" | "per_unit" | "metered" | "percentage" | "tiered",
        "unit": "string (ví dụ: per_kwh, per_person, per_month)",
        "billingCycle": "daily" | "weekly" | "monthly" | "quarterly" | "yearly" | "per_use" | null (mặc định monthly)",
        "includedInRent": "boolean | null (optional, mặc định false)",
        "isOptional": "boolean | null (optional, mặc định false)",
        "notes": "string | null (optional)"
      }
    ],
    "amenities": [
      {
        "systemAmenityId": "string (BẮT BUỘC, ID từ reference_system_data)",
        "customValue": "string | null (optional)",
        "notes": "string | null (optional)"
      }
    ],
    "rules": [
      {
        "systemRuleId": "string (BẮT BUỘC, ID từ reference_system_data)",
        "customValue": "string | null (optional)",
        "isEnforced": "boolean | null (optional, mặc định true)",
        "notes": "string | null (optional)"
      }
    ]
  }
}
\`\`\`

### QUAN TRỌNG

- TẤT CẢ các field phải đúng kiểu dữ liệu (string, number, boolean, array, object).
- Các field bắt buộc KHÔNG được null hoặc undefined.
- Các field optional có thể null hoặc không có trong JSON.
- Enum values PHẢI đúng với các giá trị được định nghĩa.
- Numbers PHẢI là số nguyên hoặc số thập phân hợp lệ (không có dấu phẩy, không có ký tự).
- Arrays PHẢI là mảng hợp lệ (có thể rỗng []).
- CHỈ trả về JSON, KHÔNG có text giải thích.
- Đảm bảo JSON hợp lệ, có thể parse được.

JSON:`;
}
