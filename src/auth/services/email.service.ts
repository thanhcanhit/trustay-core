import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
	private resend: Resend;

	constructor(private readonly configService: ConfigService) {
		const apiKey = this.configService.get<string>('resend.apiKey');
		if (apiKey) {
			this.resend = new Resend(apiKey);
		}
	}

	/**
	 * Send verification email with code
	 */
	async sendVerificationEmail(email: string, code: string): Promise<boolean> {
		try {
			const nodeEnv = this.configService.get<string>('NODE_ENV');

			if (nodeEnv === 'development' || !this.resend) {
				// eslint-disable-next-line no-console
				console.log(`[Email Development] Verification code for ${email}: ${code}`);
				return true;
			}

			await this.resend.emails.send({
				from: 'noreply@trustay.life',
				to: email,
				subject: 'Mã xác thực Trustay',
				html: this.getVerificationEmailTemplate(code),
			});

			return true;
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error('Failed to send verification email:', error);
			return false;
		}
	}

	/**
	 * Send welcome email to new user
	 */
	async sendWelcomeEmail(email: string, firstName: string): Promise<boolean> {
		try {
			const nodeEnv = this.configService.get<string>('NODE_ENV');

			if (nodeEnv === 'development' || !this.resend) {
				// eslint-disable-next-line no-console
				console.log(`[Email Development] Welcome email sent to ${firstName} at ${email}`);
				return true;
			}

			await this.resend.emails.send({
				from: 'noreply@trustay.life',
				to: email,
				subject: 'Chào mừng đến với Trustay!',
				html: this.getWelcomeEmailTemplate(firstName),
			});

			return true;
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error('Failed to send welcome email:', error);
			return false;
		}
	}

	/**
	 * Send password reset email
	 */
	async sendPasswordResetEmail(email: string, code: string): Promise<boolean> {
		try {
			const nodeEnv = this.configService.get<string>('NODE_ENV');

			if (nodeEnv === 'development' || !this.resend) {
				// eslint-disable-next-line no-console
				console.log(`[Email Development] Password reset code for ${email}: ${code}`);
				return true;
			}

			await this.resend.emails.send({
				from: 'noreply@trustay.life',
				to: email,
				subject: 'Đặt lại mật khẩu Trustay',
				html: this.getPasswordResetEmailTemplate(code),
			});

			return true;
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error('Failed to send password reset email:', error);
			return false;
		}
	}

	/**
	 * Send change email verification code
	 */
	async sendChangeEmailVerification(email: string, code: string): Promise<boolean> {
		try {
			const nodeEnv = this.configService.get<string>('NODE_ENV');

			if (nodeEnv === 'development' || !this.resend) {
				// eslint-disable-next-line no-console
				console.log(`[Email Development] Change email verification code for ${email}: ${code}`);
				return true;
			}

			await this.resend.emails.send({
				from: 'noreply@trustay.life',
				to: email,
				subject: 'Xác nhận thay đổi email - Trustay',
				html: this.getChangeEmailTemplate(code),
			});

			return true;
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error('Failed to send change email verification:', error);
			return false;
		}
	}

	/**
	 * Verification email template
	 */
	private getVerificationEmailTemplate(code: string): string {
		return `
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<title>Xác thực tài khoản Trustay</title>
	<style>
		body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
		.container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
		.header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; }
		.content { padding: 30px; }
		.code { background-color: #f8f9fa; border: 2px dashed #6c757d; border-radius: 8px; font-size: 32px; font-weight: bold; text-align: center; padding: 20px; margin: 20px 0; letter-spacing: 3px; color: #495057; }
		.footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #6c757d; }
		.btn { display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 15px 0; }
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h1>🏠 Trustay</h1>
			<p>Xác thực địa chỉ email của bạn</p>
		</div>
		<div class="content">
			<h2>Chào bạn!</h2>
			<p>Cảm ơn bạn đã đăng ký tài khoản Trustay. Để hoàn tất quá trình đăng ký, vui lòng sử dụng mã xác thực dưới đây:</p>
			
			<div class="code">${code}</div>
			
			<p><strong>Lưu ý quan trọng:</strong></p>
			<ul>
				<li>Mã xác thực có hiệu lực trong <strong>5 phút</strong></li>
				<li>Không chia sẻ mã này với bất kỳ ai</li>
				<li>Nếu bạn không yêu cầu xác thực này, vui lòng bỏ qua email</li>
			</ul>
			
			<p>Sau khi xác thực thành công, bạn có thể bắt đầu sử dụng Trustay để tìm kiếm hoặc cho thuê nhà trọ một cách an toàn và tiện lợi.</p>
		</div>
		<div class="footer">
			<p>© 2025 Trustay. Nền tảng cho thuê nhà trọ uy tín.</p>
			<p>Email này được gửi tự động, vui lòng không phản hồi.</p>
		</div>
	</div>
</body>
</html>
		`;
	}

	/**
	 * Welcome email template
	 */
	private getWelcomeEmailTemplate(firstName: string): string {
		return `
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<title>Chào mừng đến với Trustay!</title>
	<style>
		body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
		.container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
		.header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; }
		.content { padding: 30px; }
		.footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #6c757d; }
		.btn { display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 15px 0; }
		.feature { background-color: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #10b981; }
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h1>🎉 Chào mừng đến với Trustay!</h1>
			<p>Tài khoản của bạn đã được tạo thành công</p>
		</div>
		<div class="content">
			<h2>Xin chào ${firstName}!</h2>
			<p>Cảm ơn bạn đã tin tưởng và tham gia cộng đồng Trustay. Chúng tôi rất vui mừng chào đón bạn!</p>
			
			<h3>🏠 Bạn có thể làm gì với Trustay?</h3>
			
			<div class="feature">
				<strong>🔍 Tìm kiếm nhà trọ:</strong>
				<p>Khám phá hàng ngàn phòng trọ chất lượng với thông tin minh bạch, hình ảnh thực tế.</p>
			</div>
			
			<div class="feature">
				<strong>🏘️ Cho thuê phòng trọ:</strong>
				<p>Đăng tin cho thuê dễ dàng, quản lý khách hàng và hợp đồng thuê một cách chuyên nghiệp.</p>
			</div>
			
			<div class="feature">
				<strong>🛡️ Bảo mật & An toàn:</strong>
				<p>Hệ thống xác thực danh tính, đánh giá uy tín giúp bạn an tâm trong mọi giao dịch.</p>
			</div>
			
			<div style="text-align: center; margin: 30px 0;">
				<a href="https://trustay.life" class="btn">Khám phá Trustay ngay</a>
			</div>
			
			<p><strong>Cần hỗ trợ?</strong> Đội ngũ của chúng tôi luôn sẵn sàng giúp đỡ bạn!</p>
		</div>
		<div class="footer">
			<p>© 2025 Trustay. Nền tảng cho thuê nhà trọ uy tín.</p>
			<p>Email này được gửi tự động, vui lòng không phản hồi.</p>
		</div>
	</div>
</body>
</html>
		`;
	}

	/**
	 * Password reset email template
	 */
	private getPasswordResetEmailTemplate(code: string): string {
		return `
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<title>Đặt lại mật khẩu Trustay</title>
	<style>
		body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
		.container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
		.header { background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 30px; text-align: center; }
		.content { padding: 30px; }
		.code { background-color: #fff3cd; border: 2px dashed #856404; border-radius: 8px; font-size: 32px; font-weight: bold; text-align: center; padding: 20px; margin: 20px 0; letter-spacing: 3px; color: #856404; }
		.footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #6c757d; }
		.warning { background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 5px; padding: 15px; margin: 15px 0; color: #721c24; }
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h1>🔐 Đặt lại mật khẩu</h1>
			<p>Yêu cầu đặt lại mật khẩu Trustay</p>
		</div>
		<div class="content">
			<h2>Xác nhận đặt lại mật khẩu</h2>
			<p>Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản Trustay. Sử dụng mã xác thực dưới đây để tiếp tục:</p>
			
			<div class="code">${code}</div>
			
			<div class="warning">
				<strong>⚠️ Lưu ý bảo mật:</strong>
				<ul style="margin: 10px 0; padding-left: 20px;">
					<li>Mã có hiệu lực trong <strong>10 phút</strong></li>
					<li>Không chia sẻ mã này với bất kỳ ai</li>
					<li>Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này</li>
				</ul>
			</div>
			
			<p>Sau khi đặt lại mật khẩu thành công, hãy đảm bảo sử dụng mật khẩu mạnh để bảo vệ tài khoản của bạn.</p>
		</div>
		<div class="footer">
			<p>© 2025 Trustay. Nền tảng cho thuê nhà trọ uy tín.</p>
			<p>Email này được gửi tự động, vui lòng không phản hồi.</p>
		</div>
	</div>
</body>
</html>
		`;
	}

	/**
	 * Change email verification template
	 */
	private getChangeEmailTemplate(code: string): string {
		return `
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<title>Xác nhận thay đổi email - Trustay</title>
	<style>
		body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
		.container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
		.header { background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: white; padding: 30px; text-align: center; }
		.content { padding: 30px; }
		.code { background-color: #ede9fe; border: 2px dashed #7c3aed; border-radius: 8px; font-size: 32px; font-weight: bold; text-align: center; padding: 20px; margin: 20px 0; letter-spacing: 3px; color: #6d28d9; }
		.footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #6c757d; }
		.warning { background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 5px; padding: 15px; margin: 15px 0; color: #856404; }
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h1>📧 Xác nhận thay đổi Email</h1>
			<p>Yêu cầu thay đổi địa chỉ email tài khoản Trustay</p>
		</div>
		<div class="content">
			<h2>Xác thực email mới của bạn</h2>
			<p>Bạn đã yêu cầu thay đổi email cho tài khoản Trustay. Để hoàn tất việc thay đổi, vui lòng nhập mã xác thực dưới đây:</p>
			
			<div class="code">${code}</div>
			
			<div class="warning">
				<strong>⚠️ Lưu ý quan trọng:</strong>
				<ul style="margin: 10px 0; padding-left: 20px;">
					<li>Mã xác thực có hiệu lực trong <strong>10 phút</strong></li>
					<li>Bạn có tối đa <strong>5 lần</strong> nhập mã</li>
					<li>Không chia sẻ mã này với bất kỳ ai</li>
					<li>Nếu bạn không yêu cầu thay đổi email, hãy bỏ qua email này và đổi mật khẩu ngay</li>
				</ul>
			</div>
			
			<p><strong>Sau khi xác thực thành công:</strong></p>
			<ul>
				<li>Email mới sẽ được cập nhật cho tài khoản của bạn</li>
				<li>Email cũ sẽ không còn được sử dụng để đăng nhập</li>
				<li>Bạn sẽ nhận được thông báo xác nhận tại cả hai địa chỉ email</li>
			</ul>
		</div>
		<div class="footer">
			<p>© 2025 Trustay. Nền tảng cho thuê nhà trọ uy tín.</p>
			<p>Email này được gửi tự động, vui lòng không phản hồi.</p>
		</div>
	</div>
</body>
</html>
		`;
	}

	/**
	 * Send contract signing OTP email
	 */
	async sendContractSigningOtp(
		email: string,
		code: string,
		contractInfo: {
			contractCode: string;
			roomName?: string;
			roomNumber?: string;
			buildingName?: string;
			signerName: string;
			signerRole: 'landlord' | 'tenant';
		},
	): Promise<boolean> {
		try {
			const nodeEnv = this.configService.get<string>('NODE_ENV');

			if (nodeEnv === 'development' || !this.resend) {
				// eslint-disable-next-line no-console
				console.log(
					`[Email Development] Contract signing OTP for ${email} (${contractInfo.contractCode}): ${code}`,
				);
				return true;
			}

			await this.resend.emails.send({
				from: 'noreply@trustay.life',
				to: email,
				subject: `Mã xác thực ký hợp đồng ${contractInfo.contractCode} - Trustay`,
				html: this.getContractSigningEmailTemplate(code, contractInfo),
			});

			return true;
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error('Failed to send contract signing OTP email:', error);
			return false;
		}
	}

	/**
	 * Contract signing email template
	 */
	private getContractSigningEmailTemplate(
		code: string,
		contractInfo: {
			contractCode: string;
			roomName?: string;
			roomNumber?: string;
			buildingName?: string;
			signerName: string;
			signerRole: 'landlord' | 'tenant';
		},
	): string {
		const roleText = contractInfo.signerRole === 'landlord' ? 'Chủ nhà' : 'Người thuê';
		const roomInfo =
			contractInfo.roomName || contractInfo.buildingName
				? `${contractInfo.roomNumber ? `Phòng ${contractInfo.roomNumber}` : ''}${contractInfo.roomName ? ` - ${contractInfo.roomName}` : ''}${contractInfo.buildingName ? ` (${contractInfo.buildingName})` : ''}`
				: '';

		return `
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<title>Mã xác thực ký hợp đồng - Trustay</title>
	<style>
		body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
		.container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
		.header { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 30px; text-align: center; }
		.content { padding: 30px; }
		.code { background-color: #eff6ff; border: 2px dashed #2563eb; border-radius: 8px; font-size: 32px; font-weight: bold; text-align: center; padding: 20px; margin: 20px 0; letter-spacing: 3px; color: #1e40af; }
		.footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #6c757d; }
		.contract-info { background-color: #f8f9fa; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0; border-radius: 5px; }
		.warning { background-color: #fef3c7; border: 1px solid #fbbf24; border-radius: 5px; padding: 15px; margin: 15px 0; color: #92400e; }
		.info-item { margin: 8px 0; }
		.info-label { font-weight: 600; color: #374151; }
		.info-value { color: #1f2937; }
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h1>✍️ Xác thực ký hợp đồng</h1>
			<p>Mã OTP để ký hợp đồng thuê phòng trọ</p>
		</div>
		<div class="content">
			<h2>Xin chào ${contractInfo.signerName}!</h2>
			<p>Bạn đang yêu cầu ký hợp đồng thuê phòng trọ trên hệ thống Trustay. Để hoàn tất việc ký hợp đồng, vui lòng sử dụng mã xác thực dưới đây:</p>
			
			<div class="code">${code}</div>
			
			<div class="contract-info">
				<h3 style="margin-top: 0; color: #2563eb;">📄 Thông tin hợp đồng</h3>
				<div class="info-item">
					<span class="info-label">Mã hợp đồng:</span>
					<span class="info-value"> ${contractInfo.contractCode}</span>
				</div>
				<div class="info-item">
					<span class="info-label">Vai trò:</span>
					<span class="info-value"> ${roleText}</span>
				</div>
				${roomInfo ? `<div class="info-item"><span class="info-label">Phòng:</span><span class="info-value"> ${roomInfo}</span></div>` : ''}
			</div>
			
			<div class="warning">
				<strong>⚠️ Lưu ý bảo mật quan trọng:</strong>
				<ul style="margin: 10px 0; padding-left: 20px;">
					<li>Mã xác thực có hiệu lực trong <strong>10 phút</strong></li>
					<li>Không chia sẻ mã này với bất kỳ ai, kể cả nhân viên Trustay</li>
					<li>Chỉ nhập mã khi bạn đang ở trang ký hợp đồng chính thức</li>
					<li>Nếu bạn không yêu cầu ký hợp đồng này, vui lòng bỏ qua email và liên hệ hỗ trợ ngay</li>
				</ul>
			</div>
			
			<p><strong>Về hợp đồng điện tử:</strong></p>
			<ul>
				<li>Hợp đồng được ký điện tử có giá trị pháp lý như hợp đồng ký tay truyền thống</li>
				<li>Sau khi ký, hợp đồng sẽ được lưu trữ an toàn trên hệ thống</li>
				<li>Bạn có thể tải xuống bản PDF hợp đồng đã ký bất cứ lúc nào</li>
			</ul>
			
			<p style="margin-top: 25px;"><strong>Nếu bạn có bất kỳ thắc mắc nào, vui lòng liên hệ bộ phận hỗ trợ của chúng tôi.</strong></p>
		</div>
		<div class="footer">
			<p>© 2025 Trustay. Nền tảng cho thuê nhà trọ uy tín.</p>
			<p>Email này được gửi tự động, vui lòng không phản hồi.</p>
			<p style="margin-top: 10px; font-size: 12px; color: #9ca3af;">Để bảo mật tài khoản, không chia sẻ mã OTP với bất kỳ ai.</p>
		</div>
	</div>
</body>
</html>
		`;
	}
}
