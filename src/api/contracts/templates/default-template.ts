import { RoomType } from '@prisma/client';
import { ContractTemplate } from './contract-template.interface';

export const DEFAULT_CONTRACT_TEMPLATE: ContractTemplate = {
	id: 'default-vietnamese-rental-v1',
	name: 'Hợp đồng thuê phòng trọ tiêu chuẩn',
	description: 'Template chuẩn cho hợp đồng thuê phòng trọ tại Việt Nam',
	roomTypes: [
		RoomType.boarding_house,
		RoomType.dormitory,
		RoomType.apartment,
		RoomType.whole_house,
	],
	version: '1.0.0',
	isActive: true,
	createdAt: new Date(),
	updatedAt: new Date(),

	variables: [
		{ key: 'contractNumber', label: 'Số hợp đồng', type: 'string', required: true },
		{ key: 'createdDate', label: 'Ngày tạo hợp đồng', type: 'date', required: true },
		{ key: 'landlordName', label: 'Tên chủ nhà', type: 'string', required: true },
		{ key: 'landlordId', label: 'CMND/CCCD chủ nhà', type: 'string', required: true },
		{ key: 'landlordPhone', label: 'SĐT chủ nhà', type: 'string', required: false },
		{ key: 'landlordEmail', label: 'Email chủ nhà', type: 'string', required: true },
		{ key: 'tenantName', label: 'Tên khách thuê', type: 'string', required: true },
		{ key: 'tenantId', label: 'CMND/CCCD khách thuê', type: 'string', required: true },
		{ key: 'tenantPhone', label: 'SĐT khách thuê', type: 'string', required: false },
		{ key: 'tenantEmail', label: 'Email khách thuê', type: 'string', required: true },
		{ key: 'roomName', label: 'Tên phòng', type: 'string', required: true },
		{ key: 'roomNumber', label: 'Số phòng', type: 'string', required: true },
		{ key: 'fullAddress', label: 'Địa chỉ đầy đủ', type: 'string', required: true },
		{ key: 'buildingName', label: 'Tên tòa nhà', type: 'string', required: true },
		{ key: 'areaSqm', label: 'Diện tích (m²)', type: 'number', required: false },
		{ key: 'monthlyRent', label: 'Tiền thuê hàng tháng', type: 'number', required: true },
		{ key: 'depositAmount', label: 'Tiền đặt cọc', type: 'number', required: true },
		{ key: 'electricityRate', label: 'Giá điện (VND/kWh)', type: 'number', required: false },
		{ key: 'waterRate', label: 'Giá nước (VND/m³)', type: 'number', required: false },
		{ key: 'startDate', label: 'Ngày bắt đầu thuê', type: 'date', required: true },
		{ key: 'endDate', label: 'Ngày kết thúc thuê', type: 'date', required: false },
		{
			key: 'leaseDurationMonths',
			label: 'Thời gian thuê (tháng)',
			type: 'number',
			required: false,
		},
		{ key: 'amenities', label: 'Tiện ích', type: 'array', required: false },
		{ key: 'rules', label: 'Quy định', type: 'array', required: false },
	],

	clauses: [
		{
			id: 'header',
			title: 'Tiêu đề hợp đồng',
			content: 'HỢP ĐỒNG THUÊ PHÒNG TRỌ',
			variables: ['contractNumber', 'createdDate'],
			isMandatory: true,
			order: 1,
		},
		{
			id: 'parties',
			title: 'Các bên tham gia',
			content: 'Hai bên tham gia hợp đồng gồm: Bên cho thuê và Bên thuê',
			variables: [
				'landlordName',
				'landlordId',
				'landlordPhone',
				'landlordEmail',
				'tenantName',
				'tenantId',
				'tenantPhone',
				'tenantEmail',
			],
			isMandatory: true,
			order: 2,
		},
		{
			id: 'property',
			title: 'Thông tin bất động sản',
			content: 'Thông tin chi tiết về phòng trọ được thuê',
			variables: ['roomName', 'roomNumber', 'fullAddress', 'buildingName', 'areaSqm'],
			isMandatory: true,
			order: 3,
		},
		{
			id: 'financial',
			title: 'Điều khoản tài chính',
			content: 'Các điều khoản liên quan đến tiền thuê, đặt cọc và chi phí phát sinh',
			variables: ['monthlyRent', 'depositAmount', 'electricityRate', 'waterRate'],
			isMandatory: true,
			order: 4,
		},
		{
			id: 'lease_terms',
			title: 'Thời gian thuê',
			content: 'Thời gian bắt đầu và kết thúc hợp đồng thuê',
			variables: ['startDate', 'endDate', 'leaseDurationMonths'],
			isMandatory: true,
			order: 5,
		},
		{
			id: 'amenities',
			title: 'Tiện ích đi kèm',
			content: 'Các tiện ích được cung cấp kèm theo phòng',
			variables: ['amenities'],
			isMandatory: false,
			order: 6,
		},
		{
			id: 'rules',
			title: 'Quy định chung',
			content: 'Các quy định mà bên thuê cần tuân thủ',
			variables: ['rules'],
			isMandatory: false,
			order: 7,
		},
		{
			id: 'responsibilities',
			title: 'Trách nhiệm các bên',
			content: 'Quy định trách nhiệm của bên cho thuê và bên thuê',
			variables: [],
			isMandatory: true,
			order: 8,
		},
		{
			id: 'signatures',
			title: 'Chữ ký các bên',
			content: 'Chữ ký xác nhận của các bên tham gia hợp đồng',
			variables: ['landlordName', 'tenantName', 'createdDate'],
			isMandatory: true,
			order: 9,
		},
	],

	htmlTemplate: `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hợp đồng thuê phòng trọ</title>
    <style>
        body { font-family: 'Times New Roman', serif; line-height: 1.6; margin: 40px; }
        .header { text-align: center; margin-bottom: 30px; }
        .contract-title { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
        .contract-number { font-size: 14px; margin-bottom: 5px; }
        .section { margin-bottom: 25px; }
        .section-title { font-size: 16px; font-weight: bold; margin-bottom: 15px; }
        .parties { display: flex; justify-content: space-between; margin-bottom: 20px; }
        .party { width: 45%; }
        .party-title { font-weight: bold; margin-bottom: 10px; }
        .property-info, .financial-info { margin-bottom: 15px; }
        .amenities-list, .rules-list { margin-left: 20px; }
        .signatures { display: flex; justify-content: space-between; margin-top: 50px; }
        .signature { text-align: center; width: 40%; }
        .signature-line { border-bottom: 1px solid #000; margin: 50px 0 10px 0; }
    </style>
</head>
<body>
    <div class="header">
        <div class="contract-title">{{contractNumber}}</div>
        <div class="contract-number">Ngày {{createdDate}}</div>
    </div>

    <div class="section">
        <div class="section-title">CÁC BÊN THAM GIA HỢP ĐỒNG</div>
        <div class="parties">
            <div class="party">
                <div class="party-title">BÊN CHO THUÊ (Bên A):</div>
                <p>Ông/bà: <strong>{{landlordName}}</strong></p>
                <p>CMND/CCCD số: <strong>{{landlordId}}</strong></p>
                {{#if landlordPhone}}<p>Điện thoại: <strong>{{landlordPhone}}</strong></p>{{/if}}
                <p>Email: <strong>{{landlordEmail}}</strong></p>
            </div>
            <div class="party">
                <div class="party-title">BÊN THUÊ (Bên B):</div>
                <p>Ông/bà: <strong>{{tenantName}}</strong></p>
                <p>CMND/CCCD số: <strong>{{tenantId}}</strong></p>
                {{#if tenantPhone}}<p>Điện thoại: <strong>{{tenantPhone}}</strong></p>{{/if}}
                <p>Email: <strong>{{tenantEmail}}</strong></p>
            </div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">THÔNG TIN BẤT ĐỘNG SAN CHO THUÊ</div>
        <div class="property-info">
            <p>Tên phòng: <strong>{{roomName}}</strong></p>
            <p>Số phòng: <strong>{{roomNumber}}</strong></p>
            <p>Thuộc: <strong>{{buildingName}}</strong></p>
            <p>Địa chỉ: <strong>{{fullAddress}}</strong></p>
            {{#if areaSqm}}<p>Diện tích: <strong>{{areaSqm}} m²</strong></p>{{/if}}
        </div>
    </div>

    <div class="section">
        <div class="section-title">ĐIỀU KHOẢN TÀI CHÍNH</div>
        <div class="financial-info">
            <p>Tiền thuê hàng tháng: <strong>{{formatCurrency monthlyRent}} VND</strong></p>
            <p>Tiền đặt cọc: <strong>{{formatCurrency depositAmount}} VND</strong></p>
            {{#if electricityRate}}<p>Giá điện: <strong>{{electricityRate}} VND/kWh</strong></p>{{/if}}
            {{#if waterRate}}<p>Giá nước: <strong>{{waterRate}} VND/m³</strong></p>{{/if}}
        </div>
    </div>

    <div class="section">
        <div class="section-title">THỜI GIAN THUÊ</div>
        <p>Ngày bắt đầu thuê: <strong>{{formatDate startDate}}</strong></p>
        {{#if endDate}}<p>Ngày kết thúc thuê: <strong>{{formatDate endDate}}</strong></p>{{/if}}
        {{#if leaseDurationMonths}}<p>Thời gian thuê: <strong>{{leaseDurationMonths}} tháng</strong></p>{{/if}}
    </div>

    {{#if amenities}}
    <div class="section">
        <div class="section-title">TIỆN ÍCH ĐI KÈM</div>
        <ul class="amenities-list">
            {{#each amenities}}
            <li>{{this}}</li>
            {{/each}}
        </ul>
    </div>
    {{/if}}

    {{#if rules}}
    <div class="section">
        <div class="section-title">QUY ĐỊNH CHUNG</div>
        <ul class="rules-list">
            {{#each rules}}
            <li>{{this}}</li>
            {{/each}}
        </ul>
    </div>
    {{/if}}

    <div class="section">
        <div class="section-title">TRÁCH NHIỆM CÁC BÊN</div>
        <p><strong>Trách nhiệm của Bên A (Chủ nhà):</strong></p>
        <ul>
            <li>Giao phòng đúng thời hạn, đảm bảo phòng sạch sẽ, trang thiết bị đầy đủ theo thỏa thuận.</li>
            <li>Đảm bảo các tiện ích chung như điện, nước, internet hoạt động bình thường.</li>
            <li>Không được tự ý vào phòng khi chưa có sự đồng ý của Bên B.</li>
            <li>Thông báo trước khi có sự thay đổi về giá cả hoặc quy định.</li>
        </ul>
        
        <p><strong>Trách nhiệm của Bên B (Khách thuê):</strong></p>
        <ul>
            <li>Thanh toán tiền thuê đầy đủ, đúng hạn theo thỏa thuận.</li>
            <li>Sử dụng phòng đúng mục đích, giữ gìn vệ sinh và trật tự.</li>
            <li>Tuân thủ các quy định chung của tòa nhà và pháp luật.</li>
            <li>Thông báo kịp thời khi có hỏng hóc cần sửa chữa.</li>
            <li>Bồi thường thiệt hại nếu làm hỏng tài sản của Bên A.</li>
        </ul>
    </div>

    <div class="section">
        <div class="section-title">ĐIỀU KHOẢN CHUNG</div>
        <ul>
            <li>Hợp đồng này có hiệu lực kể từ ngày ký.</li>
            <li>Mọi thay đổi, bổ sung phải được ghi thành văn bản và có chữ ký của cả hai bên.</li>
            <li>Tranh chấp phát sinh sẽ được giải quyết thông qua thương lượng, hòa giải hoặc theo pháp luật.</li>
            <li>Hợp đồng được lập thành 02 bản, mỗi bên giữ 01 bản có giá trị pháp lý như nhau.</li>
        </ul>
    </div>

    <div class="signatures">
        <div class="signature">
            <strong>BÊN CHO THUÊ</strong>
            <div class="signature-line"></div>
            <p>{{landlordName}}</p>
        </div>
        <div class="signature">
            <strong>BÊN THUÊ</strong>
            <div class="signature-line"></div>
            <p>{{tenantName}}</p>
        </div>
    </div>
</body>
</html>
	`,
};
