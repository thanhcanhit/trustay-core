/**
 * Electronic Contract Metadata Types
 * Compliant with Vietnamese Law (Luật Giao dịch điện tử 2023, Nghị định 91/2023/NĐ-CP)
 */

// ========================================
// LEGAL METADATA INTERFACE
// ========================================

export interface LegalMetadata {
	// Thông tin tạo hợp đồng
	creationContext: {
		createdBy: string; // userId
		createdAt: string; // ISO timestamp
		createdFrom: {
			ip: string;
			location: string; // "Quận 1, TP.HCM, Việt Nam"
			device: string; // "Chrome 120.0, Windows 10"
		};
	};

	// Lưu trữ theo Bộ luật Dân sự
	retention: {
		requiredYears: 10; // Điều 119 BLDS
		retainUntil: string; // ISO date
		archiveStatus: 'active' | 'archived';
	};

	// Tham chiếu pháp lý
	legalReferences: {
		civilCode: 'Bộ luật Dân sự 2015';
		eTransactionLaw: 'Luật Giao dịch điện tử số 51/2023/QH15';
		decree: 'Nghị định 91/2023/NĐ-CP';
		housingLaw: 'Luật Nhà ở 2014';
	};

	// Xác thực tính pháp lý
	legalValidation: {
		hasRequiredElements: boolean; // Các yếu tố bắt buộc của HĐ
		signaturesComplete: boolean;
		witnessVerified: boolean; // Nếu cần người làm chứng
		notarized: boolean; // Nếu cần công chứng
	};
}

// ========================================
// SIGNATURE METADATA INTERFACE
// ========================================

export interface SignatureMetadata {
	// Thông tin người ký (theo Điều 21 Luật GD điện tử)
	signer: {
		fullName: string;
		idNumber: string; // CCCD/CMND
		idIssuedDate: string;
		idIssuedPlace: string;
		dateOfBirth: string;
		permanentAddress: string;
		currentAddress: string;
		phone: string;
		email?: string;
	};

	// Thông tin xác thực (Điều 22-24)
	authentication: {
		method: 'SMS_OTP';
		phone: string;
		otpSentAt: string;
		otpVerifiedAt: string;
		otpAttempts: number;
		verificationCode: string; // Mã xác minh
	};

	// Bối cảnh ký (Điều 20)
	signingContext: {
		timestamp: string; // Thời điểm ký chính xác
		timezone: 'Asia/Ho_Chi_Minh';
		location: {
			latitude?: number;
			longitude?: number;
			address: string; // "Quận 1, TP.HCM"
			country: 'Việt Nam';
		};
		device: {
			type: 'mobile' | 'desktop' | 'tablet';
			os: string; // "iOS 17.0"
			browser: string; // "Safari 17.0"
			screenResolution: string; // "1920x1080"
			fingerprint: string; // Device fingerprint
		};
		network: {
			ip: string;
			ipv6?: string;
			isp?: string; // "Viettel"
			connectionType?: string; // "4G", "Wifi"
		};
	};

	// Canvas signature details
	canvas: {
		dimensions: {
			width: number;
			height: number;
		};
		strokeCount: number; // Số nét vẽ
		drawingTime: number; // Milliseconds
		pressure?: number[]; // Áp lực nếu có
		speed?: number[]; // Tốc độ vẽ
	};

	// Tính toàn vẹn (Điều 18)
	integrity: {
		signatureHash: string; // SHA-256
		contractHash: string; // Hash của HĐ tại thời điểm ký
		previousSignatureHash?: string; // Nếu có người ký trước
		blockchainTx?: string; // Optional: lưu on-chain
	};

	// Chứng từ điện tử (Điều 12)
	evidence: {
		smsLogId?: string; // ID log SMS OTP
		emailLogId?: string; // ID log email
		videoRecordingId?: string; // Nếu có ghi hình
		witnessSignatureId?: string; // Nếu có người làm chứng
	};
}

// ========================================
// AUTHENTICATION DATA INTERFACE
// ========================================

export interface AuthenticationData {
	// SMS OTP Details
	sms: {
		provider: 'Viettel' | 'Vinaphone' | 'Mobifone' | 'VNPT';
		phoneNumber: string;
		maskedPhone: string; // "0909***123"
		otpLength: 6;
		otpExpiry: 300; // seconds
		sendStatus: 'success';
		sendTime: string;
		verifyTime: string;
		attempts: number;
		maxAttempts: 5;
	};

	// Session info
	session: {
		id: string;
		startTime: string;
		endTime: string;
		duration: number; // seconds
		activityLog: Array<{
			action: string;
			timestamp: string;
		}>;
	};

	// Risk assessment
	riskScore: {
		score: number; // 0-100
		factors: string[]; // ["new_device", "different_location"]
		requiresAdditionalVerification: boolean;
	};
}

// ========================================
// CONTRACT DATA INTERFACE
// ========================================

export interface ContractData {
	// Thông tin cơ bản
	title: string;
	description: string;

	// Các bên tham gia
	parties: {
		landlord: {
			name: string;
			idNumber: string;
			address: string;
			phone: string;
			email?: string;
		};
		tenant: {
			name: string;
			idNumber: string;
			address: string;
			phone: string;
			email?: string;
		};
	};

	// Thông tin phòng
	room: {
		buildingName: string;
		roomNumber: string;
		address: string;
		area: number;
		roomType: string;
	};

	// Điều khoản tài chính
	financial: {
		monthlyRent: number;
		deposit: number;
		currency: string;
		paymentMethod: string;
		paymentDueDate: number; // Ngày thanh toán trong tháng
	};

	// Điều khoản thời gian
	duration: {
		startDate: string;
		endDate?: string;
		noticePeriod: number; // Thời gian báo trước (ngày)
	};

	// Điều khoản khác
	terms: {
		utilities: string[];
		restrictions: string[];
		responsibilities: {
			landlord: string[];
			tenant: string[];
		};
	};
}

// ========================================
// VALIDATION RESULT INTERFACE
// ========================================

export interface ValidationResult {
	isValid: boolean;
	errors: string[];
	warnings: string[];
	legalCompliance: {
		hasCapacity: boolean; // Năng lực pháp luật
		isVoluntary: boolean; // Tự nguyện
		hasLegalPurpose: boolean; // Mục đích hợp pháp
		hasRequiredForm: boolean; // Hình thức theo luật
	};
	signatureValidation: {
		hasAuthentication: boolean; // Có xác thực
		hasIntegrity: boolean; // Toàn vẹn
		hasNonRepudiation: boolean; // Không chối bỏ
		hasTimestamp: boolean; // Thời gian xác định
	};
}
