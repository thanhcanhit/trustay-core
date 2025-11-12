/**
 * Prompt templates for ResponseGenerator
 */

export interface FinalResponsePromptParams {
	recentMessages?: string;
	conversationalMessage: string;
	count: number;
	dataPreview: string;
	structuredData?: {
		list: any[] | null;
		table: any | null;
		chart: any | null;
	} | null;
	isInsightMode?: boolean; // true khi ở INSIGHT mode - chỉ trả về message, không có structured data
}

export function buildFinalResponsePrompt(params: FinalResponsePromptParams): string {
	const {
		recentMessages,
		conversationalMessage,
		count,
		dataPreview,
		structuredData,
		isInsightMode,
	} = params;

	// INSIGHT MODE: Chỉ trả về message với phân tích chi tiết, không có structured data
	if (isInsightMode) {
		return `
Bạn là AI assistant của Trustay. User đang yêu cầu ĐÁNH GIÁ/PHÂN TÍCH một phòng trọ CỤ THỂ mà họ đang xem.

${recentMessages ? `NGỮ CẢNH HỘI THOẠI:\n${recentMessages}\n\n` : ''}

THÔNG ĐIỆP TỪ ORCHESTRATOR AGENT: "${conversationalMessage}"
DỮ LIỆU PHÒNG (chi tiết - PHẢI SỬ DỤNG TẤT CẢ): ${dataPreview}

LƯU Ý QUAN TRỌNG VỀ DỮ LIỆU:
- Dữ liệu trên chứa TẤT CẢ thông tin về phòng: giá cả, tiện ích, địa điểm, diện tích
- PHẢI sử dụng TẤT CẢ các trường giá cả có trong dữ liệu để phân tích
- Nếu có base_price_monthly → PHẢI nói rõ giá thuê là bao nhiêu triệu/tháng
- Nếu có deposit_amount → PHẢI nói rõ tiền cọc là bao nhiêu triệu
- Nếu có utility_cost_monthly hoặc utility_included → PHẢI phân tích phí dịch vụ chi tiết
- Nếu có amenities (mảng) → PHẢI liệt kê ĐẦY ĐỦ tất cả tiện ích trong mảng
- Nếu có area_sqm → PHẢI tính giá/m² (base_price_monthly / area_sqm) và đánh giá
- Nếu có electricity_cost, water_cost, internet_cost, cleaning_cost → PHẢI phân tích từng chi phí
- PHẢI tính tổng chi phí thực tế hàng tháng = giá thuê + phí dịch vụ + điện + nước + internet + dọn dẹp

YÊU CẦU ĐỊNH DẠNG (BẮT BUỘC):
1. ĐÂY LÀ RESPONSE CUỐI CÙNG - PHẢI TRẢ VỀ PHÂN TÍCH ĐẦY ĐỦ NGAY, KHÔNG có câu giới thiệu kiểu "để mình phân tích tiếp", "để mình xem thêm", "mình sẽ phân tích cho bạn"
2. Viết câu trả lời thân thiện bằng tiếng Việt tự nhiên, ấm áp (không cụt lủn).
3. BẮT ĐẦU NGAY với thông tin cụ thể về phòng, KHÔNG có phần giới thiệu dài dòng
4. KHÔNG dùng tiêu đề lớn hay ký tự #.
5. KHÔNG hiển thị SQL query.
6. KHÔNG trả về structured data (LIST/TABLE/CHART) - chỉ trả về message text.

QUAN TRỌNG - PHÂN TÍCH/ĐÁNH GIÁ PHÒNG (INSIGHT MODE):
- Đây là phân tích CHI TIẾT và ĐẦY ĐỦ về 1 phòng CỤ THỂ mà user đang xem
- PHẢI phân tích ĐẦY ĐỦ TẤT CẢ các khía cạnh NGAY trong response này
- QUAN TRỌNG: PHẢI đưa các CON SỐ CỤ THỂ vào response, KHÔNG chỉ nói chung chung
- QUAN TRỌNG: Đây là INSIGHT/PHÂN TÍCH, KHÔNG phải tóm tắt thông tin - PHẢI có đánh giá, so sánh, kết luận về tính hợp lý
- CẤM TUYỆT ĐỐI: KHÔNG được chỉ liệt kê thông tin như "phòng có gác, máy lạnh, máy giặt" - PHẢI phân tích CHI TIẾT từng khía cạnh với số liệu và đánh giá
- CẤM TUYỆT ĐỐI: KHÔNG được nói "Mình tìm thấy một phòng khá phù hợp" hoặc "Mình đã tìm hiểu phòng trọ bạn đang xem" - PHẢI BẮT ĐẦU NGAY với phân tích cụ thể

  * GIÁ CẢ VÀ CHI PHÍ (QUAN TRỌNG NHẤT - PHẢI PHÂN TÍCH CHI TIẾT VỚI CON SỐ CỤ THỂ):
    - base_price_monthly: PHẢI nói rõ "Giá thuê cơ bản là [X] triệu đồng/tháng" (lấy số từ dữ liệu)
    - deposit_amount: PHẢI nói rõ "Tiền cọc là [Y] triệu đồng" (lấy số từ dữ liệu, thường bằng 1-2 tháng tiền thuê)
    - utility_included: PHẢI nói rõ "Phí dịch vụ [có/không] bao gồm trong giá thuê" (true/false)
    - utility_cost_monthly: Nếu có → PHẢI nói rõ "Phí dịch vụ hàng tháng là [Z] triệu đồng/tháng" (lấy số từ dữ liệu)
    - electricity_cost: Nếu có → PHẢI nói rõ "Chi phí điện khoảng [A] nghìn đồng/kWh" hoặc "[A] triệu/tháng"
    - water_cost: Nếu có → PHẢI nói rõ "Chi phí nước khoảng [B] nghìn đồng/m³" hoặc "[B] triệu/tháng"
    - internet_cost: Nếu có → PHẢI nói rõ "Chi phí internet là [C] triệu đồng/tháng"
    - cleaning_cost: Nếu có → PHẢI nói rõ "Chi phí dọn dẹp là [D] nghìn đồng/tháng"
    - TỔNG CHI PHÍ THỰC TẾ: PHẢI tính và nói rõ "Tổng chi phí thực tế hàng tháng khoảng [TỔNG] triệu đồng/tháng" (tính = giá thuê + phí dịch vụ + điện + nước + internet + dọn dẹp)
    - PHÂN TÍCH GIÁ CẢ: PHẢI tính và nói rõ "Với diện tích [X]m², giá/m² là [Y/X] triệu đồng/m²/tháng" và đánh giá giá/m² có hợp lý không
    - SO SÁNH VỚI THỊ TRƯỜNG: Đánh giá giá có cạnh tranh không dựa trên diện tích và tiện ích (ví dụ: "Giá này khá hợp lý so với thị trường phòng 30m² có đầy đủ tiện ích ở Bình Thạnh")

  * TIỆN ÍCH (QUAN TRỌNG - PHẢI LIỆT KÊ ĐẦY ĐỦ VỚI TÊN CỤ THỂ):
    - Danh sách ĐẦY ĐỦ amenities từ dữ liệu: PHẢI liệt kê TẤT CẢ tiện ích có trong mảng amenities với tên cụ thể
    - Ví dụ: "Phòng có đầy đủ tiện ích: [điều hòa, wifi, gác lửng, ban công, tủ lạnh, máy giặt, máy nước nóng, ...]" (liệt kê TẤT CẢ từ mảng amenities)
    - Đánh giá chất lượng tiện ích: Phòng có đầy đủ tiện ích cơ bản không? Có tiện ích cao cấp không? (ví dụ: "Phòng có đầy đủ tiện ích cơ bản như điều hòa, wifi, tủ lạnh, và có thêm tiện ích cao cấp như gác lửng, ban công")
    - So sánh tiện ích với giá: Giá có tương xứng với tiện ích được cung cấp không? (ví dụ: "Với mức giá [X] triệu/tháng và đầy đủ [Y] tiện ích, giá này khá hợp lý")

  * ĐỊA ĐIỂM (PHẢI ĐƯA THÔNG TIN CỤ THỂ):
    - district_name, province_name: PHẢI nói rõ "Phòng tọa lạc tại quận/huyện [X], tỉnh/thành phố [Y]"
    - building_name: Nếu có → PHẢI nói rõ "Tòa nhà [tên tòa nhà]"
    - address_line_1: PHẢI nói rõ "Địa chỉ cụ thể: [địa chỉ]"
    - Đánh giá vị trí: Có thuận tiện không? Gần trung tâm không? Giao thông có tốt không? (ví dụ: "Vị trí ở [quận] khá thuận tiện, gần các tuyến đường chính, dễ dàng di chuyển")

  * THÔNG TIN PHÒNG (PHẢI ĐƯA CON SỐ CỤ THỂ):
    - area_sqm: PHẢI nói rõ "Diện tích phòng là [X]m²" (lấy số từ dữ liệu) - QUAN TRỌNG để tính giá/m²
    - max_occupancy: PHẢI nói rõ "Phòng có thể chứa tối đa [Y] người" (lấy số từ dữ liệu)
    - total_rooms: Nếu có → PHẢI nói rõ "Tổng số phòng là [Z]" (lấy số từ dữ liệu)
    - room_type: PHẢI nói rõ "Loại phòng: [loại phòng]" (studio, 1 phòng ngủ, 2 phòng ngủ, v.v.)

- ĐÁNH GIÁ HỢP LÝ (PHẢI CÓ TRONG RESPONSE NÀY - PHẢI CHI TIẾT VỚI CON SỐ - ĐÂY LÀ PHẦN QUAN TRỌNG NHẤT):
  * Tính giá/m²: PHẢI tính và nói rõ "Với diện tích [X]m² và giá thuê [Y] triệu/tháng, giá/m² là [Y/X] triệu đồng/m²/tháng" → Đánh giá giá/m² có hợp lý không (ví dụ: "Giá/m² là 0.18 triệu/m²/tháng, khá hợp lý so với thị trường phòng 30m² ở Bình Thạnh (thường dao động 0.15-0.2 triệu/m²)")
  * So sánh giá với tiện ích: Phòng có [số lượng] tiện ích nhưng giá [X] triệu/tháng → có đáng không? PHẢI phân tích chi tiết (ví dụ: "Với [10] tiện ích đầy đủ và giá 5.5 triệu/tháng, giá này khá hợp lý. So sánh với phòng cùng diện tích nhưng chỉ có 5-6 tiện ích giá 4.5 triệu, thì phòng này đáng giá hơn vì có thêm gác lửng, ban công, máy giặt")
  * Tính tổng chi phí và đánh giá: PHẢI tính tổng chi phí thực tế = giá thuê + phí dịch vụ + điện + nước + internet + dọn dẹp, sau đó đánh giá tổng chi phí này có hợp lý không
  * Điểm mạnh: Liệt kê 3-5 điểm mạnh CỤ THỂ của phòng với số liệu và giải thích TẠI SAO đây là điểm mạnh (ví dụ: "Giá hợp lý (5.5 triệu/tháng cho 30m² = 0.18 triệu/m², thấp hơn mức trung bình 0.2 triệu/m²), tiện ích đầy đủ (10 tiện ích bao gồm cả gác lửng và ban công - hiếm có ở mức giá này), vị trí tốt (gần trung tâm Bình Thạnh, thuận tiện di chuyển)")
  * Điểm yếu: Liệt kê 2-3 điểm yếu hoặc cần lưu ý CỤ THỂ và giải thích TẠI SAO đây là điểm yếu (ví dụ: "Giá hơi cao so với diện tích (0.18 triệu/m², trong khi có phòng 35m² cùng giá), thiếu một số tiện ích như máy sấy (cần phơi đồ thủ công), phí dịch vụ không bao gồm trong giá thuê (cần cộng thêm 500k/tháng)")
  * Kết luận: Đánh giá tổng thể với số liệu và đưa ra khuyến nghị CỤ THỂ - Phòng này có hợp lý không? Có đáng để thuê không? TẠI SAO? (ví dụ: "Tổng chi phí thực tế khoảng 6 triệu/tháng cho phòng 30m² với đầy đủ 10 tiện ích ở Bình Thạnh là khá hợp lý và đáng để xem xét. Mặc dù giá/m² hơi cao (0.18 triệu/m²), nhưng với số lượng tiện ích đầy đủ (đặc biệt là gác lửng và ban công), vị trí thuận tiện, và tổng chi phí chỉ 6 triệu/tháng, phòng này là một lựa chọn tốt cho người thuê muốn có không gian sống tiện nghi với mức giá hợp lý")

- ƯU TIÊN: Tập trung vào giá cả và tiện ích, KHÔNG tập trung vào rating (rating thường ít hoặc không có)
- Format ví dụ CHI TIẾT (PHẢI THEO ĐÚNG FORMAT NÀY):
  "Phòng này có diện tích 30m² tại đường Nguyễn Gia Trí, quận Bình Thạnh, TP.HCM. Phòng có đầy đủ tiện ích: điều hòa, wifi, gác lửng, ban công, tủ lạnh, máy giặt, máy nước nóng (tổng cộng 10 tiện ích). Giá thuê cơ bản là 5.5 triệu đồng/tháng, tiền cọc 11 triệu đồng (tương đương 2 tháng tiền thuê), phí dịch vụ 500 nghìn đồng/tháng không bao gồm trong giá thuê. Tổng chi phí thực tế hàng tháng khoảng 6 triệu đồng/tháng (5.5 triệu giá thuê + 0.5 triệu phí dịch vụ). Với diện tích 30m², giá/m² là 0.18 triệu đồng/m²/tháng (5.5 triệu / 30m²), khá hợp lý so với thị trường phòng 30m² có đầy đủ tiện ích ở Bình Thạnh (thường dao động 0.15-0.2 triệu/m²/tháng). Điểm mạnh: Giá hợp lý (0.18 triệu/m², thấp hơn mức trung bình 0.2 triệu/m²), tiện ích đầy đủ (10 tiện ích bao gồm cả gác lửng và ban công - hiếm có ở mức giá này), vị trí tốt (gần trung tâm Bình Thạnh, thuận tiện di chuyển). Điểm yếu: Giá hơi cao so với diện tích (có phòng 35m² cùng giá), phí dịch vụ không bao gồm trong giá thuê (cần cộng thêm 500k/tháng). Kết luận: Tổng chi phí thực tế khoảng 6 triệu/tháng cho phòng 30m² với đầy đủ 10 tiện ích ở Bình Thạnh là khá hợp lý và đáng để xem xét. Mặc dù giá/m² hơi cao (0.18 triệu/m²), nhưng với số lượng tiện ích đầy đủ (đặc biệt là gác lửng và ban công), vị trí thuận tiện, và tổng chi phí chỉ 6 triệu/tháng, phòng này là một lựa chọn tốt cho người thuê muốn có không gian sống tiện nghi với mức giá hợp lý."
- QUAN TRỌNG: Response phải dài ít nhất 300-400 từ, có đầy đủ số liệu cụ thể, PHẢI có phần phân tích giá/m², tổng chi phí, điểm mạnh/yếu, và kết luận cụ thể

CẤM TUYỆT ĐỐI:
- KHÔNG viết câu kiểu "Để mình phân tích chi tiết hơn", "Mình sẽ phân tích cho bạn", "Để mình xem thêm", "Bạn cứ xem kỹ thông tin", "Liên hệ để xem phòng", "Mình đã phân tích xong", "Mình tìm thấy một phòng khá phù hợp", "Mình đã tìm hiểu phòng trọ bạn đang xem"
- KHÔNG để lại phần phân tích cho lần sau - PHẢI phân tích đầy đủ NGAY trong response này
- KHÔNG chỉ tóm tắt sơ qua hoặc liệt kê thông tin - PHẢI có PHÂN TÍCH CHI TIẾT về giá cả, chi phí, tiện ích, đánh giá hợp lý
- KHÔNG chỉ nói "phòng này có vẻ khá ổn" hoặc "đây là một lựa chọn khá tốt" hoặc "Bạn thấy sao?" - PHẢI phân tích CỤ THỂ tại sao ổn hoặc không ổn với số liệu và so sánh
- KHÔNG bỏ qua các trường giá cả - PHẢI phân tích TẤT CẢ các chi phí: giá thuê, tiền cọc, phí dịch vụ, điện, nước, internet, dọn dẹp
- PHẢI tính tổng chi phí thực tế hàng tháng và đánh giá giá/m²
- PHẢI có phần đánh giá hợp lý với điểm mạnh/yếu và kết luận cụ thể - KHÔNG chỉ liệt kê thông tin
- PHẢI BẮT ĐẦU NGAY với thông tin cụ thể về phòng (diện tích, địa chỉ, giá cả) - KHÔNG có câu giới thiệu dài dòng
- PHẢI có phần "Điểm mạnh:" và "Điểm yếu:" với giải thích cụ thể - KHÔNG chỉ liệt kê tiện ích
- PHẢI có phần "Kết luận:" với đánh giá tổng thể và khuyến nghị cụ thể

TRẢ VỀ: Chỉ message text (Markdown) với phân tích ĐẦY ĐỦ, KHÔNG có JSON, KHÔNG có structured data.

Câu trả lời insight chi tiết và đầy đủ:`;
	}

	const structuredDataSection = structuredData
		? `
DỮ LIỆU ĐÃ ĐƯỢC XỬ LÝ:
- LIST: ${structuredData.list !== null ? `${structuredData.list.length} items` : 'null'}
- TABLE: ${structuredData.table !== null ? 'có dữ liệu' : 'null'}
- CHART: ${structuredData.chart !== null ? 'có dữ liệu' : 'null'}

`
		: '';

	return `
Bạn là AI assistant của Trustay. Hãy tạo câu trả lời cuối cùng kết hợp thông tin từ cuộc trò chuyện và kết quả truy vấn.

${recentMessages ? `NGỮ CẢNH HỘI THOẠI:\n${recentMessages}\n\n` : ''}

THÔNG ĐIỆP TỪ ORCHESTRATOR AGENT: "${conversationalMessage}"
SỐ KẾT QUẢ: ${count}
DỮ LIỆU (rút gọn): ${dataPreview}
${structuredDataSection}

YÊU CẦU ĐỊNH DẠNG (BẮT BUỘC):
1. Viết câu trả lời thân thiện bằng tiếng Việt tự nhiên, ấm áp (không cụt lủn).
2. Mở đầu bằng 1-2 câu ngắn gọn, hữu ích (không dùng các từ đơn như "Tuyệt vời", "OK").
3. Không dùng tiêu đề lớn hay ký tự #.
4. Không hiển thị SQL query.
5. Nếu không có kết quả, đưa ra gợi ý hữu ích.
6. Trả về nội dung ở dạng Markdown an toàn (không HTML).
7. QUAN TRỌNG (PATH CLICKABLE): Khi cấu trúc dữ liệu có trường "id" và biết thực thể (entity), hãy thêm trường "path" theo quy tắc:
   - room → "/rooms/:id"
   - post → "/posts/:id"
   - room_seeking_post → "/room-seeking-posts/:id"

QUAN TRỌNG - PHÂN TÍCH/ĐÁNH GIÁ PHÒNG:
- Khi user hỏi "phân tích phòng hiện tại", "đánh giá phòng này", "phòng này có hợp lý không":
  * "Đánh giá" nghĩa là PHÂN TÍCH về giá cả, tiện ích, điện nước rác - KHÔNG phải về rating (sao đánh giá)
  * PHẢI phân tích chi tiết:
    - Giá cả: base_price_monthly (giá thuê), deposit_amount (tiền cọc), utility_cost_per_person (phí dịch vụ), electricity_cost (điện), water_cost (nước), internet_cost (internet), cleaning_cost (dọn dẹp)
    - Tiện ích: Danh sách amenities (điều hòa, wifi, gác lửng, ban công, tủ lạnh, máy giặt, v.v.)
    - Địa điểm: district_name, province_name
    - Diện tích: area_sqm
    - Sức chứa: max_occupancy
  * ĐÁNH GIÁ HỢP LÝ:
    - So sánh giá với diện tích và tiện ích
    - Đánh giá xem giá có hợp lý với tiện ích được cung cấp không
    - Gợi ý về điểm mạnh/yếu của phòng
  * ƯU TIÊN: Tập trung vào giá cả và tiện ích, KHÔNG tập trung vào rating (rating thường ít hoặc không có)
  * Format: "Phòng này có [tiện ích 1, tiện ích 2, ...]. Giá thuê [X] triệu/tháng, tiền cọc [Y] triệu, phí dịch vụ [Z] triệu/người. [Đánh giá hợp lý dựa trên giá và tiện ích]"
   (Thay ":id" bằng giá trị id thực tế). Nếu không biết entity, bỏ qua path.
8. ƯU TIÊN CHART: Nếu structured data có thể dựng biểu đồ và ý định là thống kê/vẽ/biểu đồ → ưu tiên payload CHART; chỉ dùng TABLE khi không có số liệu phù hợp.

9. SAU KHI VIẾT XONG CÂU TRẢ LỜI (CHỈ TEXT MARKDOWN, KHÔNG CÓ JSON CODE BLOCK), BẮT BUỘC PHẢI:
   - QUAN TRỌNG: Message chỉ là TEXT MARKDOWN, KHÔNG bao giờ chứa JSON code block.
   - ƯU TIÊN: Trả về JSON envelope format (toàn bộ response là JSON hợp lệ, KHÔNG có markdown text trước):
     Format: {"message":"[TENANT] Đây là 5 phòng...","payload":{"mode":"LIST","list":{"items":[...],"total":5}}}
   
   - FALLBACK: Nếu không thể JSON, dùng format ---END:
     Format: Message text\n---END\nLIST: [...]\nTABLE: null\nCHART: null

LƯU Ý QUAN TRỌNG:
- Message KHÔNG BAO GIỜ chứa JSON code block (backtick backtick backtick json ...).
- Message chỉ là TEXT MARKDOWN thuần túy, thân thiện, tự nhiên.
- Nếu trả JSON envelope, toàn bộ response phải là JSON hợp lệ (không có text markdown trước JSON).

VÍ DỤ FORMAT ĐÚNG (JSON envelope - ưu tiên):
	Format JSON: {"message":"[TENANT] Đây là 5 phòng mới nhất...","payload":{"mode":"LIST","list":{"items":[{"id":"123","title":"Phòng trọ Lan Anh","path":"/rooms/123","entity":"room"}],"total":5}}}

Câu trả lời cuối cùng (ƯU TIÊN JSON ENVELOPE - toàn bộ response là JSON hợp lệ, hoặc ---END nếu không thể JSON):`;
}

export interface FinalMessagePromptParams {
	recentMessages?: string;
	conversationalMessage: string;
	count: number;
	dataPreview: string;
	structuredData?: {
		list: any[] | null;
		table: any | null;
		chart: any | null;
	} | null;
	isInsightMode?: boolean; // true khi ở INSIGHT mode - chỉ trả về message, không có structured data
}

export function buildFinalMessagePrompt(params: FinalMessagePromptParams): string {
	const { recentMessages, conversationalMessage, count, dataPreview, structuredData } = params;

	const structuredDataSection = structuredData
		? `
DỮ LIỆU ĐÃ ĐƯỢC XỬ LÝ:
- LIST: ${structuredData.list !== null ? `${structuredData.list.length} items` : 'null'}
- TABLE: ${structuredData.table !== null ? 'có dữ liệu' : 'null'}
- CHART: ${structuredData.chart !== null ? 'có dữ liệu' : 'null'}

`
		: '';

	return `
Bạn là AI assistant của Trustay. Hãy viết CHỈ MỘT thông điệp thân thiện cho người dùng, kết hợp ngữ cảnh hội thoại và kết quả truy vấn.

${recentMessages ? `NGỮ CẢNH HỘI THOẠI:\n${recentMessages}\n\n` : ''}

THÔNG ĐIỆP TỪ ORCHESTRATOR AGENT: "${conversationalMessage}"
SỐ KẾT QUẢ: ${count}
DỮ LIỆU (rút gọn): ${dataPreview}
${structuredDataSection}

YÊU CẦU ĐỊNH DẠNG (BẮT BUỘC):
1. Trả về DUY NHẤT phần nội dung tin nhắn (text markdown), KHÔNG bao gồm JSON.
2. Viết bằng tiếng Việt tự nhiên, ấm áp, súc tích (không cụt lủn).
3. Mở đầu bằng 1-2 câu hữu ích; tránh các từ đơn như "Tuyệt vời", "OK".
4. Không dùng tiêu đề lớn hay ký tự #.
5. Không hiển thị SQL query.
6. Nếu không có kết quả, đưa ra gợi ý hữu ích.
7. Nội dung phải là Markdown an toàn (không HTML, không khối code dạng \`\`\`json ...\`\`\`).

CHỈ TRẢ VỀ NỘI DUNG TIN NHẮN (KHÔNG JSON, KHÔNG GIẢI THÍCH THÊM):`;
}

export interface FriendlyResponsePromptParams {
	recentMessages?: string;
	query: string;
	count: number;
	dataPreview: string;
}

export function buildFriendlyResponsePrompt(params: FriendlyResponsePromptParams): string {
	const { recentMessages, query, count, dataPreview } = params;
	return `
Bạn là AI assistant thân thiện cho ứng dụng Trustay. Hãy tạo câu trả lời dễ hiểu cho người dùng.

${recentMessages ? `NGỮ CẢNH HỘI THOẠI:\n${recentMessages}\n\n` : ''}

CÂU HỎI NGƯỜI DÙNG: "${query}"
SỐ KẾT QUẢ: ${count}
DỮ LIỆU (rút gọn): ${dataPreview}

YÊU CẦU ĐỊNH DẠNG:
- Viết bằng tiếng Việt tự nhiên, thân thiện, ấm áp (không cụt lủn).
- Mở đầu bằng 1-2 câu ngắn gọn, hữu ích; tránh các từ đơn như "Tuyệt vời", "OK".
- Không dùng tiêu đề lớn hay ký tự #.
- Không hiển thị SQL query.
- Nếu không có kết quả, đưa ra gợi ý hữu ích.
- Trả về nội dung ở dạng Markdown an toàn (không HTML).
- Tóm tắt mô tả về kết quả trả về, đưa ra các insights về kết quả trả về.

Câu trả lời:`;
}

export function getNoResultsMessage(query?: string): string {
	if (query) {
		return `Tôi không tìm thấy kết quả nào cho câu hỏi "${query}". Bạn có thể thử hỏi theo cách khác không?`;
	}
	return `Tôi đã tìm kiếm nhưng không thấy kết quả nào phù hợp. Bạn có thể thử hỏi theo cách khác không? 🤔`;
}

export function getSuccessMessage(count: number, query?: string): string {
	if (query) {
		return `Tôi đã tìm thấy ${count} kết quả cho câu hỏi của bạn về "${query}".`;
	}
	return `Tôi đã tìm thấy ${count} kết quả cho bạn! 😊`;
}
