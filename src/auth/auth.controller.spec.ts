import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

// Mock external dependencies
jest.mock('./auth.service');

describe('AuthController', () => {
	let controller: AuthController;
	let authService: AuthService;

	const mockAuthService = {
		register: jest.fn(),
		login: jest.fn(),
		preRegister: jest.fn(),
		refreshToken: jest.fn(),
		changePassword: jest.fn(),
		checkPasswordStrength: jest.fn(),
		getProfile: jest.fn(),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [AuthController],
			providers: [
				{
					provide: AuthService,
					useValue: mockAuthService,
				},
			],
		}).compile();

		controller = module.get<AuthController>(AuthController);
		authService = module.get<AuthService>(AuthService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
	});
});
