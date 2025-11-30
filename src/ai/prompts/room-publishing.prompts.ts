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

/**
 * Build a natural, conversational prompt to ask for missing essential information
 * Strategy: Ask in a friendly, human-like way, combining all missing info in one question
 * @deprecated Use buildConversationalResponsePrompt instead for AI-generated responses
 */
export function buildNaturalMissingInfoPrompt(
	missingFields: RoomPublishingFieldRequirement[],
): string {
	const needsLocation = missingFields.some((f) => f.key === 'building.location');
	const needsPrice = missingFields.some((f) => f.key === 'room.pricing.basePriceMonthly');
	const needsBoth = needsLocation && needsPrice;
	if (needsBoth) {
		return `Phòng mình ở quận mấy vậy bạn? À cho mình xin giá thuê mỗi tháng luôn để khách dễ hình dung nhé!`;
	}
	if (needsLocation) {
		return `Phòng mình ở quận/huyện nào vậy bạn?`;
	}
	if (needsPrice) {
		return `Giá thuê mỗi tháng là bao nhiêu vậy bạn?`;
	}
	// Fallback for other missing fields
	const fieldLabels = missingFields.map((f) => f.label).join(', ');
	return `Mình cần thêm thông tin về ${fieldLabels} để hoàn tất đăng phòng cho bạn.`;
}

/**
 * Tạo prompt để LLM đóng vai trợ lý, tự sinh câu hỏi tiếp theo dựa trên ngữ cảnh
 * Thay thế hoàn toàn các logic if/else cứng nhắc.
 * Strategy: AI-Native conversation generation
 */
export function buildConversationalResponsePrompt(params: RoomPublishingExtractionParams): string {
	const { userMessage, currentDraft, missingFields, userName = 'bạn' } = params;

	// 1. Tóm tắt trạng thái hiện tại cho AI hiểu
	// QUAN TRỌNG: Location chỉ coi là "Đã có" khi có districtId VÀ provinceId, không phải chỉ locationHint
	const hasLocationResolved = !!(
		currentDraft.building.districtId && currentDraft.building.provinceId
	);
	const hasLocationHint = !!(currentDraft.building.locationHint || currentDraft.building.name);
	const locationLookupFailed = currentDraft.building.locationLookupFailed === true;
	const locationHintText = currentDraft.building.locationHint || currentDraft.building.name || '';

	// Xác định status location một cách chi tiết để AI hiểu rõ tình huống
	let locationStatus: string;
	if (hasLocationResolved) {
		locationStatus = 'Đã có (đã xác định quận/huyện và tỉnh/thành)';
	} else if (locationLookupFailed && hasLocationHint) {
		locationStatus = `Đã có text nhưng không tìm được ID (địa chỉ: "${locationHintText}") - Cần xử lý thông minh`;
	} else if (hasLocationHint) {
		locationStatus = 'Đang xử lý (đã có địa chỉ nhưng chưa xác định quận/huyện)';
	} else {
		locationStatus = 'Chưa có';
	}

	// Filter out location field nếu đã có locationHint (đang được xử lý)
	// QUAN TRỌNG: Nếu đã có text địa chỉ (locationHint) dù chưa có ID, vẫn coi như đã có
	const filteredMissingFields = missingFields.filter((f) => {
		// Nếu hệ thống báo thiếu Location, nhưng trong draft đã có text "Quận..." -> Bỏ qua, không hỏi nữa
		if (f.key === 'building.location' && hasLocationHint && locationHintText.length > 3) {
			// Đã có locationHint (text) → đang được xử lý để map sang ID, không hỏi lại
			return false;
		}
		// Nếu hệ thống báo thiếu Giá, nhưng draft đã có số > 0 -> Bỏ qua
		if (
			f.key === 'room.pricing.basePriceMonthly' &&
			currentDraft.room.pricing.basePriceMonthly &&
			currentDraft.room.pricing.basePriceMonthly > 0
		) {
			return false;
		}
		return true;
	});

	const contextSummary = JSON.stringify(
		{
			user_just_said: userMessage,
			we_have: {
				location: locationStatus,
				location_hint_text: locationHintText || null,
				location_lookup_failed: locationLookupFailed,
				price: currentDraft.room.pricing.basePriceMonthly ? 'Đã có' : 'Chưa có',
				room_type: currentDraft.room.roomType || 'Chưa rõ',
			},
			missing_info_needed: filteredMissingFields.map((f) => ({
				key: f.key,
				description: f.description, // VD: "Giá thuê phòng"
				priority: ['room.pricing.basePriceMonthly', 'building.location'].includes(f.key)
					? 'HIGH'
					: 'LOW',
			})),
		},
		null,
		2,
	);

	// 2. Prompt tập trung vào kỹ năng giao tiếp (Soft Skills)
	return `SYSTEM ROLE:
Bạn là Trustay - Trợ lý ảo hỗ trợ đăng tin phòng trọ thân thiện, nhiệt tình và thông minh.
Bạn đang nói chuyện với người dùng tên là "${userName}".

CONTEXT & GOAL:

Bạn vừa phân tích tin nhắn của người dùng. Dưới đây là trạng thái hiện tại của hồ sơ:

${contextSummary}

NHIỆM VỤ CỦA BẠN:

Hãy viết câu phản hồi tiếp theo (Response Message) gửi cho người dùng.

NGUYÊN TẮC GIAO TIẾP (QUAN TRỌNG):

1. **Xác nhận thông tin (Acknowledge):** Nếu người dùng vừa cung cấp thông tin gì đó, hãy xác nhận nhẹ nhàng là bạn đã hiểu. (VD: "Dạ, em đã lưu giá phòng là 3 triệu rồi ạ.")

2. **Hỏi thông tin thiếu (Ask Missing Info):** Dựa vào danh sách "missing_info_needed", hãy chọn ra 1-2 thông tin quan trọng nhất (Priority HIGH) để hỏi tiếp.
   - ĐỪNG hỏi quá 2 câu hỏi cùng lúc (người dùng sẽ bị ngợp).
   - ĐỪNG hỏi lại những gì đã có ("we_have": "Đã có").
   - ĐỪNG hỏi lại location nếu status là "Đang xử lý" (đã có địa chỉ, đang được xử lý tự động).

3. **Văn phong tự nhiên (Natural Tone):**
   - Dùng từ ngữ đời thường, gần gũi của người Việt (dạ, vâng, nhé, ạ, à, ơi).
   - Tránh văn mẫu kiểu robot ("Vui lòng nhập...", "Bạn hãy cung cấp...").

4. **Xử lý tình huống đặc biệt - Location lookup failed (QUAN TRỌNG):**
   - Nếu \`location_lookup_failed: true\` và có \`location_hint_text\`:
     * **KHÔNG hỏi lại địa chỉ** (user đã cung cấp rồi)
     * **Xác nhận địa chỉ** user đã cung cấp một cách tự nhiên (VD: "Dạ, em đã lưu địa chỉ [location_hint_text] rồi ạ")
     * **Đưa ra giải pháp thông minh:**
       - Nếu địa chỉ có vẻ hợp lý (có tên Quận/Huyện): "Địa chỉ này có thể chưa có trong hệ thống, nhưng không sao, mình sẽ lưu tạm và admin sẽ xử lý sau. Bây giờ mình cần thêm..."
       - Nếu địa chỉ mơ hồ: "Địa chỉ này hơi mơ hồ, bạn có thể cho mình biết rõ hơn Quận/Huyện và Tỉnh/Thành được không?"
     * **Tiếp tục hỏi các thông tin còn thiếu** (giá, loại phòng, etc.) một cách tự nhiên
     * **Tạo cảm giác tích cực** - không để user cảm thấy lỗi do họ

5. **Xử lý tình huống thông thường:**
   - Nếu thiếu Giá & Địa chỉ (quan trọng nhất): Hãy hỏi khéo léo. (VD: "Phòng mình ở khu vực nào thế ạ? Cho em xin giá thuê luôn để khách dễ tìm nhé!")
   - Nếu chỉ còn thiếu thông tin phụ (ảnh, mô tả): Hãy gợi ý nhẹ nhàng.

OUTPUT FORMAT:

Chỉ trả về text câu trả lời (string). Không có JSON, không có markdown.`;
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
			locationLookupFailed?: boolean;
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

1. **CHIẾN THUẬT BẮT ĐỊA CHỈ (QUAN TRỌNG NHẤT):**
   - **Ưu tiên 1 (Metadata):** Tìm dòng bắt đầu bằng "Địa chỉ:", "Vị trí & bản đồ", "Location:", "Địa chỉ cụ thể:".
     - Ví dụ text: "Vị trí & bản đồ\n Địa chỉ: 33a Đường Ngô Quyền..." -> LẤY NGAY "33a Đường Ngô Quyền..." làm \`building.location\`.
     - Đây là địa chỉ chính xác nhất, bỏ qua các địa chỉ chi nhánh khác trong bài viết.
   - **Ưu tiên 2 (Body):** Nếu không có metadata, mới tìm trong nội dung bài viết.
   - **Lưu ý:** Nếu bài viết liệt kê nhiều cơ sở (Cơ sở 1, Cơ sở 2...), hãy lấy địa chỉ của cơ sở được nhắc đến trong phần "Địa chỉ:" hoặc cơ sở đầu tiên.
   - **TUYỆT ĐỐI KHÔNG TRẢ VỀ NULL** nếu trong text có xuất hiện tên Quận/Huyện. Thà trả về string thô còn hơn là null.

   - **CHUẨN HÓA ĐỊA CHỈ (BẮT BUỘC TRƯỚC KHI TRẢ VỀ):**
     * **Quận/Huyện:** "Q9", "Q.9", "Q 9", "quận 9" -> CHUẨN HÓA thành "Quận 9"
     * **Thành phố:** "HCM", "TP.HCM", "TP HCM", "Hồ Chí Minh" -> CHUẨN HÓA thành "Hồ Chí Minh" hoặc "Thành phố Hồ Chí Minh"
     * **Tỉnh:** "Bình Dương", "BD" -> CHUẨN HÓA thành "Tỉnh Bình Dương" (nếu là tỉnh)
     * **Quy tắc:**
       - Luôn viết hoa chữ cái đầu: "Quận", "Huyện", "Thành phố", "Tỉnh"
       - Số quận/huyện: "Q1" -> "Quận 1", "Q12" -> "Quận 12"
       - Tên quận/huyện: "Gò Vấp" -> "Quận Gò Vấp" (nếu là quận), "Củ Chi" -> "Huyện Củ Chi" (nếu là huyện)
     * **Ví dụ chuẩn hóa:**
       - Input: "Q9, HCM" -> Output: "Quận 9, Hồ Chí Minh"
       - Input: "Gò Vấp TP.HCM" -> Output: "Quận Gò Vấp, Thành phố Hồ Chí Minh"
       - Input: "33a Ngô Quyền, Q.9, HCM" -> Output: "33a Đường Ngô Quyền, Quận 9, Hồ Chí Minh"
       - Input: "Quận 9, Hồ Chí Minh" -> Output: "Quận 9, Hồ Chí Minh" (giữ nguyên nếu đã chuẩn)

2. **XỬ LÝ GIÁ THUÊ (PHỨC TẠP):**
   - Bài viết có thể có giá theo tuần (600k/tuần) và theo tháng (1.75 triệu/tháng).
   - Logic: Luôn ưu tiên **GIÁ THEO THÁNG** làm \`basePriceMonthly\`.
   - Tìm cụm từ: "tháng", "/tháng", "30 ngày", "mỗi tháng".
   - Ví dụ: "1.75 triệu/tháng" -> \`basePriceMonthly\` = 1750000.
   - Các giá theo tuần/ngày -> Bỏ qua hoặc đưa vào \`description\`.

3. **Phân loại phòng (Room Type Logic):**
   - User nói: "chung cư mini", "ccmn", "căn hộ" -> Output: "apartment"
   - User nói: "giường tầng", "homestay", "sleepbox" -> Output: "dormitory" hoặc "sleepbox"
   - User nói: "nguyên căn" -> Output: "whole_house"
   - Mặc định: "boarding_house"

4. **Chuẩn hóa Giá & Đơn vị (Unit Normalization):**
   - Luôn đổi về VNĐ số nguyên (Ví dụ: "3 triệu 5" -> 3500000).
   - Xử lý nhập nhằng số liệu (Ambiguity Handling):
     - Nếu context là giá điện/nước: "3 nghìn", "3k", "số 3" -> 3000.
     - Nếu context là giá phòng: "3", "3 đồng" (cách nói tắt) -> 3000000.
   - Hiểu các đơn vị lóng: "củ" = triệu, "lít" = trăm nghìn, "k" = nghìn.

5. **Tự động điền thiếu (Smart Autofill):**
   - Nếu thiếu tên tòa nhà: Tự tạo chuỗi "Trọ + [Tên chủ/Khu vực]".
   - Nếu thiếu mô tả (description): Tự viết 1 đoạn HTML ngắn (<ul><li>) liệt kê các tiện ích và giá đã trích xuất được.
   - Nếu user nói "Full đồ": Tự động map vào các amenity IDs của Giường, Tủ, Điều hòa trong <SystemReference>.

6. **Mapping Chi phí (Cost Mapping):**
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
