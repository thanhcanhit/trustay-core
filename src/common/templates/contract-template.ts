import { ContractData } from '../types/contract-metadata.types';

/**
 * Vietnamese Contract HTML Template
 * Compliant with Vietnamese legal document standards
 */

/**
 * Generate HTML for rental contract
 */
export function generateContractHTML(
	data: ContractData & {
		contractNumber: string;
		createdAt: Date;
		signedAt?: Date;
		verificationCode: string;
		signatures?: {
			landlord?: string;
			tenant?: string;
		};
	},
): string {
	return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hợp đồng thuê nhà trọ</title>
  <style>
    @page {
      size: A4;
      margin: 20mm;
    }
    
    body {
      font-family: 'Times New Roman', serif;
      font-size: 13pt;
      line-height: 1.6;
      color: #000;
      margin: 0;
      padding: 0;
    }
    
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    
    .socialist-header {
      font-weight: bold;
      margin-bottom: 5px;
    }
    
    .title {
      font-size: 16pt;
      font-weight: bold;
      text-transform: uppercase;
      margin: 20px 0;
      text-align: center;
    }
    
    .contract-number {
      font-style: italic;
      margin-bottom: 20px;
      text-align: center;
    }
    
    .section {
      margin-bottom: 15px;
      text-align: justify;
    }
    
    .article {
      margin-bottom: 15px;
    }
    
    .article-title {
      font-weight: bold;
      margin-bottom: 5px;
    }
    
    .party-info {
      margin-bottom: 20px;
    }
    
    .signature-section {
      margin-top: 50px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 20px;
    }
    
    .signature-box {
      flex: 1;
      text-align: center;
      min-width: 500px;
    }
    
    .signature-placeholder {
      width: 500px;
      height: 200px;
      margin: 20px auto;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .signature-image {
      width: 500px;
      height: 200px;
      object-fit: contain;
    }
    
    .footer {
      margin-top: 30px;
      font-size: 11pt;
      color: #666;
      text-align: center;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0;
    }
    
    th, td {
      border: 1px solid #000;
      padding: 8px;
      text-align: left;
    }
    
    th {
      background-color: #f5f5f5;
      font-weight: bold;
    }
    
    .indent {
      text-indent: 30px;
    }
    
    .highlight {
      font-weight: bold;
      color: #d32f2f;
    }
    
    .page-break {
      page-break-before: always;
    }
    
    ul {
      margin: 10px 0;
      padding-left: 20px;
    }
    
    li {
      margin-bottom: 5px;
    }
  </style>
</head>
<body>
  <!-- Header theo mẫu Việt Nam -->
  <div class="header">
    <div class="socialist-header">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
    <div class="socialist-header">Độc lập - Tự do - Hạnh phúc</div>
    <div style="margin: 10px 0;">---------------oOo---------------</div>
  </div>

  <div class="title">HỢP ĐỒNG THUÊ NHÀ TRỌ</div>
  <div class="contract-number">Số: ${data.contractNumber}</div>

  <div class="section">
    <p>Hôm nay, ngày ${formatDate(data.createdAt)}, tại ${data.parties.landlord.address}, chúng tôi gồm:</p>
  </div>

  <!-- Bên A -->
  <div class="party-info">
    <div class="article-title">BÊN CHO THUÊ (Bên A):</div>
    <p>Ông/Bà: <strong>${data.parties.landlord.name}</strong></p>
    <p>CCCD/CMND số: ${data.parties.landlord.idNumber} cấp ngày ${formatDate(data.parties.landlord.idIssuedDate)} tại ${data.parties.landlord.idIssuedPlace}</p>
    <p>Địa chỉ thường trú: ${data.parties.landlord.address}</p>
    <p>Số điện thoại: ${data.parties.landlord.phone}</p>
    ${data.parties.landlord.email ? `<p>Email: ${data.parties.landlord.email}</p>` : ''}
  </div>

  <!-- Bên B -->
  <div class="party-info">
    <div class="article-title">BÊN THUÊ (Bên B):</div>
    <p>Ông/Bà: <strong>${data.parties.tenant.name}</strong></p>
    <p>CCCD/CMND số: ${data.parties.tenant.idNumber} cấp ngày ${formatDate(data.parties.tenant.idIssuedDate)} tại ${data.parties.tenant.idIssuedPlace}</p>
    <p>Địa chỉ thường trú: ${data.parties.tenant.address}</p>
    <p>Số điện thoại: ${data.parties.tenant.phone}</p>
    ${data.parties.tenant.email ? `<p>Email: ${data.parties.tenant.email}</p>` : ''}
  </div>

  <div class="section">
    <p>Hai bên cùng thỏa thuận và thống nhất ký kết hợp đồng thuê nhà với các điều khoản sau:</p>
  </div>

  <!-- Điều 1: Đối tượng hợp đồng -->
  <div class="article">
    <div class="article-title">Điều 1: ĐỐI TƯỢNG CỦA HỢP ĐỒNG</div>
    <p class="indent">Bên A đồng ý cho Bên B thuê phòng trọ với thông tin như sau:</p>
    <ul>
      <li>Địa chỉ: ${data.room.address}</li>
      <li>Phòng số: ${data.room.roomNumber}</li>
      <li>Diện tích: ${data.room.area} m²</li>
      <li>Loại phòng: ${data.room.roomType}</li>
    </ul>
    
    ${
			data.room.amenities && data.room.amenities.length > 0
				? `
      <p class="indent">Trang thiết bị đi kèm:</p>
      <ul>
        ${data.room.amenities.map((item) => `<li>${item}</li>`).join('')}
      </ul>
    `
				: ''
		}
  </div>

  <!-- Điều 2: Thời hạn thuê -->
  <div class="article">
    <div class="article-title">Điều 2: THỜI HẠN THUÊ</div>
    <p class="indent">Thời hạn thuê là ${data.duration.rentalMonths || 12} tháng, bắt đầu từ ngày ${formatDate(data.duration.startDate)} đến ngày ${formatDate(data.duration.endDate)}.</p>
    <p class="indent">Sau khi hết hạn, nếu Bên B có nhu cầu tiếp tục thuê thì phải báo trước cho Bên A ít nhất 30 ngày để hai bên thỏa thuận ký hợp đồng mới.</p>
  </div>

  <!-- Điều 3: Giá thuê và phương thức thanh toán -->
  <div class="article">
    <div class="article-title">Điều 3: GIÁ THUÊ VÀ PHƯƠNG THỨC THANH TOÁN</div>
    <p class="indent">1. Giá thuê phòng: <span class="highlight">${formatCurrency(data.financial.monthlyRent)}</span>/tháng</p>
    <p class="indent">2. Tiền đặt cọc: <span class="highlight">${formatCurrency(data.financial.deposit)}</span> (tương đương ${data.financial.depositMonths || 1} tháng tiền thuê)</p>
    
    <p class="indent">3. Chi phí dịch vụ khác:</p>
    <table>
      <tr>
        <th>Dịch vụ</th>
        <th>Đơn giá</th>
        <th>Đơn vị</th>
        <th>Ghi chú</th>
      </tr>
      <tr>
        <td>Điện</td>
        <td>${formatCurrency(data.financial.electricityPrice || 0)}</td>
        <td>kWh</td>
        <td>Theo đồng hồ</td>
      </tr>
      <tr>
        <td>Nước</td>
        <td>${formatCurrency(data.financial.waterPrice || 0)}</td>
        <td>m³</td>
        <td>Theo đồng hồ</td>
      </tr>
      ${
				data.financial.internetPrice
					? `
        <tr>
          <td>Internet</td>
          <td>${formatCurrency(data.financial.internetPrice)}</td>
          <td>tháng</td>
          <td>Cố định</td>
        </tr>
      `
					: ''
			}
      ${
				data.financial.parkingFee
					? `
        <tr>
          <td>Gửi xe</td>
          <td>${formatCurrency(data.financial.parkingFee)}</td>
          <td>xe/tháng</td>
          <td>Mỗi xe</td>
        </tr>
      `
					: ''
			}
    </table>
    
    <p class="indent">4. Hình thức thanh toán: ${data.financial.paymentMethod}</p>
    <p class="indent">5. Thời hạn thanh toán: Trước ngày ${data.financial.paymentDueDate} hàng tháng</p>
  </div>

  <!-- Điều 4: Quyền và nghĩa vụ của Bên A -->
  <div class="article">
    <div class="article-title">Điều 4: QUYỀN VÀ NGHĨA VỤ CỦA BÊN A</div>
    <p class="indent"><strong>Quyền của Bên A:</strong></p>
    <ul>
      <li>Nhận đủ tiền thuê nhà đúng thời hạn đã thỏa thuận</li>
      <li>Đơn phương chấm dứt hợp đồng khi Bên B vi phạm các điều khoản đã ký kết</li>
      <li>Kiểm tra việc sử dụng phòng định kỳ</li>
      <li>Yêu cầu Bên B bồi thường thiệt hại nếu có vi phạm</li>
    </ul>
    
    <p class="indent"><strong>Nghĩa vụ của Bên A:</strong></p>
    <ul>
      <li>Giao phòng và trang thiết bị cho Bên B đúng thời hạn</li>
      <li>Đảm bảo việc sử dụng phòng của Bên B ổn định trong suốt thời hạn thuê</li>
      <li>Cung cấp các dịch vụ điện, nước liên tục</li>
      <li>Hoàn trả tiền đặt cọc cho Bên B khi hết hạn hợp đồng (trừ các khoản phát sinh)</li>
      <li>Thông báo trước 30 ngày nếu có thay đổi về giá thuê</li>
    </ul>
  </div>

  <!-- Điều 5: Quyền và nghĩa vụ của Bên B -->
  <div class="article">
    <div class="article-title">Điều 5: QUYỀN VÀ NGHĨA VỤ CỦA BÊN B</div>
    <p class="indent"><strong>Quyền của Bên B:</strong></p>
    <ul>
      <li>Nhận phòng và trang thiết bị theo đúng thỏa thuận</li>
      <li>Được sử dụng phòng ổn định trong thời hạn thuê</li>
      <li>Được nhận lại tiền đặt cọc khi hết hạn hợp đồng (trừ các khoản phát sinh)</li>
      <li>Yêu cầu Bên A sửa chữa các hư hỏng không do lỗi của mình</li>
    </ul>
    
    <p class="indent"><strong>Nghĩa vụ của Bên B:</strong></p>
    <ul>
      <li>Trả tiền thuê đầy đủ, đúng hạn</li>
      <li>Sử dụng phòng đúng mục đích, không được chuyển nhượng</li>
      <li>Giữ gìn phòng và trang thiết bị</li>
      <li>Chấp hành nội quy của nơi thuê trọ</li>
      <li>Báo cho Bên A trước 30 ngày nếu không tiếp tục thuê</li>
      <li>Bồi thường thiệt hại nếu có vi phạm</li>
    </ul>
  </div>

  <!-- Điều 6: Nội quy -->
  ${
		data.terms?.rules && data.terms.rules.length > 0
			? `
    <div class="article">
      <div class="article-title">Điều 6: NỘI QUY</div>
      <ul>
        ${data.terms.rules.map((rule) => `<li>${rule}</li>`).join('')}
      </ul>
    </div>
  `
			: ''
	}

  <!-- Điều 7: Điều khoản chung -->
  <div class="article">
    <div class="article-title">Điều ${data.terms?.rules && data.terms.rules.length > 0 ? '7' : '6'}: ĐIỀU KHOẢN CHUNG</div>
    <p class="indent">Hai bên cam kết thực hiện đúng và đầy đủ những điều khoản đã thỏa thuận trong hợp đồng.</p>
    <p class="indent">Mọi tranh chấp phát sinh từ hợp đồng này sẽ được hai bên giải quyết thông qua thương lượng. Nếu không thương lượng được, tranh chấp sẽ được giải quyết tại Tòa án có thẩm quyền.</p>
    <p class="indent">Hợp đồng được lập thành 02 bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản.</p>
    <p class="indent">Hợp đồng có hiệu lực kể từ ngày ký và được thực hiện cho đến khi hết hạn hoặc được chấm dứt theo thỏa thuận của hai bên.</p>
  </div>

  <!-- Chữ ký -->
  <div class="signature-section">
    <div class="signature-box">
      <p><strong>BÊN A</strong></p>
      <p style="font-size: 11pt;">(Ký, ghi rõ họ tên)</p>
      <div class="signature-placeholder" id="landlord-signature">
        ${
					data.signatures?.landlord
						? `<img src="${data.signatures.landlord}" class="signature-image" alt="Chữ ký Bên A">`
						: '<span style="color: #999;">Chữ ký Bên A</span>'
				}
      </div>
      <p><strong>${data.parties.landlord.name}</strong></p>
    </div>
    
    <div class="signature-box">
      <p><strong>BÊN B</strong></p>
      <p style="font-size: 11pt;">(Ký, ghi rõ họ tên)</p>
      <div class="signature-placeholder" id="tenant-signature">
        ${
					data.signatures?.tenant
						? `<img src="${data.signatures.tenant}" class="signature-image" alt="Chữ ký Bên B">`
						: '<span style="color: #999;">Chữ ký Bên B</span>'
				}
      </div>
      <p><strong>${data.parties.tenant.name}</strong></p>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <p>Hợp đồng điện tử được ký kết trên hệ thống TrustStay</p>
    <p>Mã xác thực: ${data.verificationCode}</p>
    <p>Thời gian tạo: ${formatDateTime(data.createdAt)}</p>
    ${data.signedAt ? `<p>Thời gian ký: ${formatDateTime(data.signedAt)}</p>` : ''}
    <p>Hash bảo mật: ${generateContractHash(data)}</p>
  </div>
</body>
</html>
    `;
}

/**
 * Format date to Vietnamese format
 */
function formatDate(date: Date | string): string {
	const d = new Date(date);
	const day = d.getDate().toString().padStart(2, '0');
	const month = (d.getMonth() + 1).toString().padStart(2, '0');
	const year = d.getFullYear();
	return `${day}/${month}/${year}`;
}

/**
 * Format date and time to Vietnamese format
 */
function formatDateTime(date: Date | string): string {
	const d = new Date(date);
	const day = d.getDate().toString().padStart(2, '0');
	const month = (d.getMonth() + 1).toString().padStart(2, '0');
	const year = d.getFullYear();
	const hours = d.getHours().toString().padStart(2, '0');
	const minutes = d.getMinutes().toString().padStart(2, '0');
	return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Format currency to Vietnamese format
 */
function formatCurrency(amount: number): string {
	return new Intl.NumberFormat('vi-VN', {
		style: 'currency',
		currency: 'VND',
	}).format(amount);
}

/**
 * Generate contract hash for security
 */
function generateContractHash(data: any): string {
	const crypto = require('crypto');
	const content = JSON.stringify({
		contractNumber: data.contractNumber,
		landlord: data.parties.landlord.name,
		tenant: data.parties.tenant.name,
		monthlyRent: data.financial.monthlyRent,
		startDate: data.duration.startDate,
		createdAt: data.createdAt,
	});

	return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
}
