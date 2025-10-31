export function buildFieldGuidelines(limit: number): string {
	return `
YÊU CẦU TRUY VẤN DỮ LIỆU (BẮT BUỘC):
1. Phân biệt loại câu hỏi:
   - THỐNG KÊ/HÓA ĐƠN/REVENUE (từ khóa: thống kê, hóa đơn, doanh thu, revenue, invoice, tổng, theo tháng/năm, top):
     * Dùng aggregate functions: SUM(), COUNT(), AVG(), MAX(), MIN()
     * GROUP BY theo nhóm (ví dụ: theo tháng, theo loại, theo trạng thái)
     * SELECT: label (nhóm), value (số liệu aggregate), alias rõ ràng: label, value
     * ORDER BY value DESC
     * LIMIT 10
     * KHÔNG trả về danh sách phòng/bài đăng chi tiết
     * Ví dụ: SELECT DATE_TRUNC('month', created_at) AS label, SUM(amount) AS value FROM invoices GROUP BY label ORDER BY value DESC LIMIT 10;
   
   - TÌM KIẾM DANH SÁCH (từ khóa: tìm, phòng, room, bài đăng, post, ở, gần):
     * Chỉ SELECT các trường gọn nhẹ: id, name/title AS title, thumbnail/image_url (nếu có), url/link (nếu có)
     * Bổ sung constant column: 'room' AS entity (cho rooms) hoặc 'post' AS entity (cho posts)
     * KHÔNG SELECT: description, content, body, hay bất kỳ trường text dài nào
     * LIMIT ${Math.max(1, Math.min(50, limit))}
     * Ví dụ: SELECT r.id, r.name AS title, r.thumbnail_url, 'room' AS entity FROM rooms r WHERE ... LIMIT ${Math.max(1, Math.min(50, limit))};

2. Luôn dùng alias nhất quán: title cho tiêu đề, thumbnail cho ảnh, url cho liên kết, entity cho loại, label cho nhóm, value cho số liệu.

3. Tuyệt đối không trả về dữ liệu nhạy cảm hoặc không cần thiết.`;
}
