import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { LoggerService } from '../logger/logger.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { EmailService } from './services/email.service';
import { PasswordService } from './services/password.service';
import { SmsService } from './services/sms.service';
import { VerificationService } from './services/verification.service';

// Mock external dependencies
jest.mock('../prisma/prisma.service');
jest.mock('../logger/logger.service');
jest.mock('./services/password.service');
jest.mock('./services/verification.service');
jest.mock('./services/email.service');
jest.mock('./services/sms.service');

describe('AuthService', () => {
	let service: AuthService;
	let prismaService: PrismaService;
	let jwtService: JwtService;
	let configService: ConfigService;
	let passwordService: PasswordService;
	let verificationService: VerificationService;
	let emailService: EmailService;
	let smsService: SmsService;
	let loggerService: LoggerService;

	const mockPrismaService = {
		user: {
			create: jest.fn(),
			findUnique: jest.fn(),
			findFirst: jest.fn(),
			update: jest.fn(),
		},
		verification: {
			create: jest.fn(),
			findFirst: jest.fn(),
			update: jest.fn(),
		},
	};

	const mockJwtService = {
		sign: jest.fn(),
		verify: jest.fn(),
	};

	const mockConfigService = {
		get: jest.fn(),
	};

	const mockPasswordService = {
		hashPassword: jest.fn(),
		comparePassword: jest.fn(),
	};

	const mockVerificationService = {
		validateVerificationToken: jest.fn(),
		createVerificationToken: jest.fn(),
	};

	const mockEmailService = {
		sendVerificationEmail: jest.fn(),
	};

	const mockSmsService = {
		sendVerificationSms: jest.fn(),
	};

	const mockLoggerService = {
		log: jest.fn(),
		error: jest.fn(),
		warn: jest.fn(),
		debug: jest.fn(),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AuthService,
				{
					provide: PrismaService,
					useValue: mockPrismaService,
				},
				{
					provide: JwtService,
					useValue: mockJwtService,
				},
				{
					provide: ConfigService,
					useValue: mockConfigService,
				},
				{
					provide: PasswordService,
					useValue: mockPasswordService,
				},
				{
					provide: VerificationService,
					useValue: mockVerificationService,
				},
				{
					provide: EmailService,
					useValue: mockEmailService,
				},
				{
					provide: SmsService,
					useValue: mockSmsService,
				},
				{
					provide: LoggerService,
					useValue: mockLoggerService,
				},
			],
		}).compile();

		service = module.get<AuthService>(AuthService);
		prismaService = module.get<PrismaService>(PrismaService);
		jwtService = module.get<JwtService>(JwtService);
		configService = module.get<ConfigService>(ConfigService);
		passwordService = module.get<PasswordService>(PasswordService);
		verificationService = module.get<VerificationService>(VerificationService);
		emailService = module.get<EmailService>(EmailService);
		smsService = module.get<SmsService>(SmsService);
		loggerService = module.get<LoggerService>(LoggerService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});
});
