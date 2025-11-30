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
 * Build prompt for LLM to extract information with Reasoning Capabilities
 * Strategy: Chain-of-Thought analysis -> Semantic Mapping -> JSON Construction
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

	// Serialize data reference
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
				currency: 'VND',
			},
		},
		null,
		2,
	);

	const referenceData = JSON.stringify(
		{
			cost_types: systemCostTypes.map((c) => ({
				id: c.id,
				names: [c.name],
				category: c.category,
				default_unit: c.defaultUnit,
			})),
			amenities: systemAmenities.map((a) => ({
				id: a.id,
				name: a.name,
			})),
			rules: systemRules.map((r) => ({
				id: r.id,
				name: r.name,
			})),
		},
		null,
		2,
	);

	return `SYSTEM ROLE:
Bạn là một "Data Extraction Engine" thông minh. Nhiệm vụ của bạn là chuyển đổi ngôn ngữ tự nhiên thành JSON cấu trúc.
KHÔNG được trả lời bằng văn bản. KHÔNG giải thích. CHỈ trả về JSON.

CONTEXT DATA:

<UserMessage>${userMessage}</UserMessage>

<CurrentState>${contextData}</CurrentState>

<SystemReference>${referenceData}</SystemReference>

PROCESSING LOGIC (SUY LUẬN THÔNG MINH):

Dù người dùng nói ngắn gọn, bạn phải hiểu sâu các ý sau để điền JSON chính xác:

1. **Phân loại phòng (Room Type Logic):**
   - User nói: "chung cư mini", "ccmn", "căn hộ" -> Output: "apartment"
   - User nói: "giường tầng", "homestay", "sleepbox" -> Output: "dormitory" hoặc "sleepbox"
   - User nói: "nguyên căn" -> Output: "whole_house"
   - Mặc định: "boarding_house"

2. **Chuẩn hóa Giá & Đơn vị (Unit Normalization):**
   - Luôn đổi về VNĐ số nguyên (Ví dụ: "3 triệu 5" -> 3500000).
   - Xử lý nhập nhằng số liệu (Ambiguity Handling):
     - Nếu context là giá điện/nước: "3 nghìn", "3k", "số 3" -> 3000.
     - Nếu context là giá phòng: "3", "3 đồng" (cách nói tắt) -> 3000000.
   - Hiểu các đơn vị lóng: "củ" = triệu, "lít" = trăm nghìn, "k" = nghìn.

3. **Tự động điền thiếu (Smart Autofill):**
   - Nếu thiếu tên tòa nhà: Tự tạo chuỗi "Trọ + [Tên chủ/Khu vực]".
   - Nếu thiếu mô tả (description): Tự viết 1 đoạn HTML ngắn (<ul><li>) liệt kê các tiện ích và giá đã trích xuất được.
   - Nếu user nói "Full đồ": Tự động map vào các amenity IDs của Giường, Tủ, Điều hòa trong <SystemReference>.

4. **Mapping Chi phí (Cost Mapping):**
   - So khớp từ khóa user với "names" trong <SystemReference>.
   - User nói "điện giá dân", "nước nhà nước" -> costType: "metered" (theo công tơ), unit: "per_kwh" / "per_m3".
   - User nói "bao điện nước", "miễn phí wifi" -> Tạo cost với value = 0 hoặc includedInRent = true.

OUTPUT SCHEMA (BẮT BUỘC):

Trả về 1 JSON object duy nhất khớp hoàn toàn với cấu trúc sau (giữ nguyên các key tiếng Anh).

LƯU Ý QUAN TRỌNG:

- Với "systemCostTypeId", "systemAmenityId", "systemRuleId": CHỈ ĐƯỢC dùng ID có trong <SystemReference>. Nếu không khớp ID nào, hãy BỎ QUA item đó, KHÔNG được tự bịa ID mới.

- Các trường số (number) phải là số nguyên (Integer), không dùng string "3000000". Ví dụ: 3000000 (đúng), "3000000" (sai).

- Các trường boolean phải là true/false (không phải "true"/"false" string).

\`\`\`json
{
  "building": {
    "name": "string (Tự tạo nếu thiếu)",
    "location": "string | null"
  },
  "room": {
    "name": "string (Tự tạo nếu thiếu)",
    "roomType": "boarding_house | dormitory | apartment | sleepbox | whole_house",
    "totalRooms": "number",
    "areaSqm": "number | null",
    "maxOccupancy": "number | null",
    "floorNumber": "number | null",
    "description": "string (HTML content)",
    "pricing": {
      "basePriceMonthly": "number | null",
      "depositAmount": "number | null",
      "depositMonths": "number | null",
      "utilityIncluded": "boolean | null",
      "utilityCostMonthly": "number | null",
      "minimumStayMonths": "number | null",
      "maximumStayMonths": "number | null",
      "priceNegotiable": "boolean | null"
    },
    "costs": [
      {
        "systemCostTypeId": "string (Lấy ID chính xác từ Reference)",
        "value": "number",
        "costType": "fixed | per_unit | metered | percentage | tiered",
        "unit": "string",
        "billingCycle": "monthly | daily | null",
        "includedInRent": "boolean | null",
        "isOptional": "boolean | null",
        "notes": "string | null"
      }
    ],
    "amenities": [
      {
        "systemAmenityId": "string (Lấy ID chính xác từ Reference)",
        "customValue": "string | null",
        "notes": "string | null"
      }
    ],
    "rules": [
      {
        "systemRuleId": "string (Lấy ID chính xác từ Reference)",
        "customValue": "string | null",
        "isEnforced": "boolean | null",
        "notes": "string | null"
      }
    ]
  }
}
\`\`\`

FINAL INSTRUCTION:

Phân tích kỹ lưỡng <UserMessage>, áp dụng PROCESSING LOGIC, sau đó điền vào OUTPUT SCHEMA.
Chỉ trả về JSON thuần.`;
}

/**
 * Helper function to safely parse AI JSON response
 * Removes markdown code blocks and handles parsing errors gracefully
 */
export function parseAIJsonResult(aiResponse: string): any {
	try {
		// 1. Xóa markdown code blocks nếu có (```json ... ```)
		const cleanString = aiResponse.replace(/```json\n?|```/g, '').trim();
		// 2. Parse JSON
		return JSON.parse(cleanString);
	} catch (err) {
		console.error('AI output invalid JSON:', aiResponse, err);
		// Fallback: Trả về null để app không crash
		return null;
	}
}
