import { randomUUID } from 'node:crypto';
import type { INestApplication, Type } from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import type { Prisma } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import type { AuthResponseDto } from '../auth/dto/auth-response.dto';
import { PasswordService } from '../auth/services/password.service';
import { PrismaService } from '../prisma/prisma.service';

export type UserRole = 'tenant' | 'landlord';

interface UserRecord {
	id: string;
	email: string;
	passwordHash: string;
	firstName: string;
	lastName: string;
	role: UserRole;
	phone?: string | null;
	isVerifiedEmail: boolean;
	isVerifiedPhone: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface TestUser {
	id: string;
	email: string;
	password: string;
	firstName: string;
	lastName: string;
	role: UserRole;
	accessToken: string;
	refreshToken: string;
	authPayload?: AuthResponseDto;
}

interface CreateTestUserOptions {
	email?: string;
	password?: string;
	firstName?: string;
	lastName?: string;
	role?: UserRole;
	phone?: string | null;
	isVerifiedEmail?: boolean;
	isVerifiedPhone?: boolean;
	prismaOverrides?: Partial<Prisma.UserCreateInput>;
}

interface TokenResult {
	accessToken: string;
	refreshToken: string;
	authPayload?: AuthResponseDto;
}

export class AuthTestUtils {
	private readonly prisma?: PrismaService;
	private readonly authService?: AuthService;
	private readonly jwtService: JwtService;
	private readonly passwordService: PasswordService;
	private readonly prismaIsMock: boolean;
	private readonly jwtAccessOptions: JwtSignOptions = { expiresIn: '1h' };
	private readonly jwtRefreshOptions: JwtSignOptions = { expiresIn: '7d' };
	private readonly userRecords = new Map<string, UserRecord>();
	private readonly userPasswords = new Map<string, string>();

	constructor(private readonly app?: Pick<INestApplication, 'get'>) {
		this.prisma = this.safeGet(PrismaService);
		this.authService = this.safeGet(AuthService);
		this.passwordService = this.safeGet(PasswordService) ?? new PasswordService();
		this.jwtService =
			this.safeGet(JwtService) ??
			new JwtService({
				secret: process.env.JWT_SECRET ?? 'test-secret',
			});
		this.prismaIsMock = this.isMockFunction((this.prisma as any)?.user?.create);
	}

	/**
	 * Create a new instance of AuthTestUtils for testing
	 */
	static create(app?: Pick<INestApplication, 'get'>): AuthTestUtils {
		return new AuthTestUtils(app);
	}

	private safeGet<T>(token: Type<T>): T | undefined {
		if (!this.app?.get) {
			return undefined;
		}

		try {
			return this.app.get(token, { strict: false });
		} catch {
			return undefined;
		}
	}

	private isMockFunction(fn: unknown): boolean {
		return typeof fn === 'function' && Object.hasOwn(fn, 'mock');
	}

	private normalizeUser(user: any): UserRecord {
		return {
			id: user?.id ?? randomUUID(),
			email: user?.email ?? 'unknown@example.com',
			passwordHash: user?.passwordHash ?? user?.password_hash ?? '',
			firstName: user?.firstName ?? user?.first_name ?? 'Test',
			lastName: user?.lastName ?? user?.last_name ?? 'User',
			role: (user?.role ?? 'tenant') as UserRole,
			phone: user?.phone ?? null,
			isVerifiedEmail: Boolean(user?.isVerifiedEmail ?? user?.is_verified_email ?? false),
			isVerifiedPhone: Boolean(user?.isVerifiedPhone ?? user?.is_verified_phone ?? false),
			createdAt: user?.createdAt ? new Date(user.createdAt) : new Date(),
			updatedAt: user?.updatedAt ? new Date(user.updatedAt) : new Date(),
		};
	}

	private buildFallbackUser(data: Prisma.UserCreateInput): UserRecord {
		return {
			id: randomUUID(),
			email: data.email,
			passwordHash: data.passwordHash ?? '',
			firstName: data.firstName ?? 'Test',
			lastName: data.lastName ?? 'User',
			role: (data.role ?? 'tenant') as UserRole,
			phone: (data.phone as string | null | undefined) ?? null,
			isVerifiedEmail: data.isVerifiedEmail ?? false,
			isVerifiedPhone: data.isVerifiedPhone ?? false,
			createdAt: new Date(),
			updatedAt: new Date(),
		};
	}

	private async tryInvokeMock(fn: unknown, args: unknown[], returnValue: unknown): Promise<void> {
		if (this.isMockFunction(fn)) {
			const mockFn = fn as any;
			if (typeof mockFn.mockResolvedValueOnce === 'function') {
				mockFn.mockResolvedValueOnce(returnValue);
			} else if (typeof mockFn.mockResolvedValue === 'function') {
				mockFn.mockResolvedValue(returnValue);
			}
			await Promise.resolve(mockFn(...args));
			return;
		}

		if (typeof fn === 'function') {
			await Promise.resolve((fn as (...fnArgs: unknown[]) => unknown)(...args));
		}
	}

	private async persistUser(data: Prisma.UserCreateInput): Promise<UserRecord> {
		if (this.prisma && !this.prismaIsMock && typeof this.prisma.user?.create === 'function') {
			const created = await this.prisma.user.create({ data });
			return this.normalizeUser(created);
		}

		const fallback = this.buildFallbackUser(data);
		await this.tryInvokeMock(this.prisma?.user?.create, [{ data }], fallback);
		return fallback;
	}

	private async createTokens(user: UserRecord, password: string): Promise<TokenResult> {
		if (this.authService && !this.prismaIsMock) {
			const authPayload = await this.authService.login({ email: user.email, password });
			return {
				accessToken: authPayload.access_token,
				refreshToken: authPayload.refresh_token,
				authPayload,
			};
		}

		const accessToken = await this.jwtService.signAsync(
			{ sub: user.id, email: user.email, role: user.role },
			this.jwtAccessOptions,
		);
		const refreshToken = await this.jwtService.signAsync(
			{ sub: user.id, type: 'refresh' },
			this.jwtRefreshOptions,
		);

		return { accessToken, refreshToken };
	}

	private generatePassword(): string {
		return `Test@${Math.random().toString(36).slice(2, 8)}${Date.now().toString().slice(-4)}`;
	}

	private async findUserByEmail(email: string): Promise<UserRecord | undefined> {
		for (const record of this.userRecords.values()) {
			if (record.email === email) {
				return record;
			}
		}

		if (this.prisma && !this.prismaIsMock && typeof this.prisma.user?.findUnique === 'function') {
			const user = await this.prisma.user.findUnique({ where: { email } });
			return user ? this.normalizeUser(user) : undefined;
		}

		return undefined;
	}

	async createTestUser(options: CreateTestUserOptions = {}): Promise<TestUser> {
		const password = options.password ?? this.generatePassword();
		const email =
			options.email ?? `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
		const firstName = options.firstName ?? 'Test';
		const lastName = options.lastName ?? 'User';
		const role: UserRole = options.role ?? 'tenant';
		const hashedPassword = await this.passwordService.hashPassword(password);

		const prismaData: Prisma.UserCreateInput = {
			email,
			passwordHash: hashedPassword,
			firstName,
			lastName,
			role,
			phone: options.phone ?? null,
			isVerifiedEmail: options.isVerifiedEmail ?? true,
			isVerifiedPhone: options.isVerifiedPhone ?? true,
			...options.prismaOverrides,
		};

		const persistedUser = await this.persistUser(prismaData);
		const tokens = await this.createTokens(persistedUser, password);

		this.userRecords.set(persistedUser.id, persistedUser);
		this.userPasswords.set(persistedUser.id, password);

		return {
			id: persistedUser.id,
			email: persistedUser.email,
			password,
			firstName: persistedUser.firstName,
			lastName: persistedUser.lastName,
			role,
			accessToken: tokens.accessToken,
			refreshToken: tokens.refreshToken,
			authPayload: tokens.authPayload,
		};
	}

	async createLandlordUser(options: CreateTestUserOptions = {}): Promise<TestUser> {
		return this.createTestUser({ ...options, role: 'landlord' });
	}

	async createTenantUser(options: CreateTestUserOptions = {}): Promise<TestUser> {
		return this.createTestUser({ ...options, role: 'tenant' });
	}

	/**
	 * Create a default landlord user with common test data
	 */
	async createDefaultLandlord(): Promise<TestUser> {
		return this.createLandlordUser({
			email: 'landlord@test.com',
			firstName: 'Landlord',
			lastName: 'Test',
			phone: '+84901234567',
		});
	}

	/**
	 * Create a default tenant user with common test data
	 */
	async createDefaultTenant(): Promise<TestUser> {
		return this.createTenantUser({
			email: 'tenant@test.com',
			firstName: 'Tenant',
			lastName: 'Test',
			phone: '+84901234568',
		});
	}

	/**
	 * Create multiple test users at once
	 */
	async createTestUsers(count: number, role: UserRole = 'tenant'): Promise<TestUser[]> {
		const users: TestUser[] = [];
		for (let i = 0; i < count; i++) {
			const user = await this.createTestUser({
				role,
				email: `user${i + 1}@test.com`,
				firstName: `User${i + 1}`,
				lastName: 'Test',
			});
			users.push(user);
		}
		return users;
	}

	getAuthHeaders(user: TestUser): Record<string, string> {
		return {
			Authorization: `Bearer ${user.accessToken}`,
		};
	}

	async loginUser(email: string, password: string): Promise<TestUser> {
		const userRecord = await this.findUserByEmail(email);

		if (!userRecord) {
			throw new Error(`User with email ${email} not found`);
		}

		const tokens = await this.createTokens(userRecord, password);

		this.userRecords.set(userRecord.id, userRecord);
		this.userPasswords.set(userRecord.id, password);

		return {
			id: userRecord.id,
			email: userRecord.email,
			password,
			firstName: userRecord.firstName,
			lastName: userRecord.lastName,
			role: userRecord.role,
			accessToken: tokens.accessToken,
			refreshToken: tokens.refreshToken,
			authPayload: tokens.authPayload,
		};
	}

	async cleanupTestUsers(userIds: string[]): Promise<void> {
		if (!userIds.length) {
			return;
		}

		if (this.prisma && !this.prismaIsMock) {
			await this.prisma.refreshToken
				?.deleteMany?.({
					where: { userId: { in: userIds } },
				})
				.catch(() => undefined);

			await this.prisma.user
				.deleteMany({
					where: { id: { in: userIds } },
				})
				.catch(() => undefined);
		}

		for (const userId of userIds) {
			this.userRecords.delete(userId);
			this.userPasswords.delete(userId);
		}
	}

	async createTestBuilding(landlordId: string, buildingData: Record<string, unknown> = {}) {
		const data = {
			id: `test-building-${Date.now()}`,
			slug: `test-building-${Date.now()}`,
			name: 'Test Building',
			description: 'Integration test building',
			addressLine1: '123 Test Street',
			districtId: 1,
			provinceId: 1,
			isActive: true,
			...buildingData,
		};

		if (this.prisma && !this.prismaIsMock && this.prisma.building?.create) {
			return this.prisma.building.create({
				data: {
					...data,
					owner: { connect: { id: landlordId } },
					district: { connect: { id: data.districtId } },
					province: { connect: { id: data.provinceId } },
				} as Prisma.BuildingCreateInput,
			});
		}

		const fallback = {
			ownerId: landlordId,
			...data,
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		await this.tryInvokeMock(this.prisma?.building?.create, [{ data }], fallback);
		return fallback;
	}

	async createTestRoom(buildingId: string, roomData: Record<string, unknown> = {}) {
		const data = {
			name: 'Test Room',
			slug: `test-room-${Date.now()}`,
			description: 'Integration test room',
			roomType: 'boarding_house',
			totalRooms: 1,
			maxOccupancy: 2,
			isActive: true,
			...roomData,
		};

		if (this.prisma && !this.prismaIsMock && this.prisma.room?.create) {
			return this.prisma.room.create({
				data: {
					...data,
					building: { connect: { id: buildingId } },
				} as Prisma.RoomCreateInput,
			});
		}

		const fallback = {
			id: randomUUID(),
			buildingId,
			...data,
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		await this.tryInvokeMock(this.prisma?.room?.create, [{ data }], fallback);
		return fallback;
	}

	async createTestRoomSeekingPost(tenantId: string, postData: Record<string, unknown> = {}) {
		const data = {
			title: 'Test Room Seeking Post',
			description: 'Need a room near city center',
			slug: `test-room-seeking-${Date.now()}`,
			preferredProvinceId: 1,
			preferredDistrictId: 1,
			preferredWardId: 1,
			minBudget: 2000000,
			maxBudget: 4000000,
			currency: 'VND',
			preferredRoomType: 'boarding_house',
			occupancy: 1,
			moveInDate: new Date(),
			isPublic: true,
			expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
			...postData,
		};

		if (this.prisma && !this.prismaIsMock && this.prisma.roomSeekingPost?.create) {
			return this.prisma.roomSeekingPost.create({
				data: {
					...data,
					requester: { connect: { id: tenantId } },
				} as Prisma.RoomSeekingPostCreateInput,
			});
		}

		const fallback = {
			id: randomUUID(),
			requesterId: tenantId,
			status: 'active',
			viewCount: 0,
			contactCount: 0,
			createdAt: new Date(),
			updatedAt: new Date(),
			...data,
		};

		await this.tryInvokeMock(this.prisma?.roomSeekingPost?.create, [{ data }], fallback);
		return fallback;
	}

	async createTestRoommateSeekingPost(tenantId: string, postData: Record<string, unknown> = {}) {
		const data = {
			title: 'Test Roommate Seeking Post',
			description: 'Looking for a roommate to share costs',
			monthlyRent: 2000000,
			currency: 'VND',
			depositAmount: 4000000,
			seekingCount: 1,
			maxOccupancy: 2,
			currentOccupancy: 1,
			availableFromDate: new Date(),
			minimumStayMonths: 3,
			maximumStayMonths: 12,
			requiresLandlordApproval: false,
			expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
			...postData,
		};

		if (this.prisma && !this.prismaIsMock && this.prisma.roommateSeekingPost?.create) {
			return this.prisma.roommateSeekingPost.create({
				data: {
					...data,
					tenant: { connect: { id: tenantId } },
				} as Prisma.RoommateSeekingPostCreateInput,
			});
		}

		const fallback = {
			id: randomUUID(),
			tenantId,
			status: 'active',
			viewCount: 0,
			applicationCount: 0,
			createdAt: new Date(),
			updatedAt: new Date(),
			...data,
		};

		await this.tryInvokeMock(this.prisma?.roommateSeekingPost?.create, [{ data }], fallback);
		return fallback;
	}
}

export async function createTestModule(): Promise<TestingModule> {
	return Test.createTestingModule({
		providers: [
			{
				provide: PrismaService,
				useValue: {
					user: {
						create: jest.fn(),
						findUnique: jest.fn(),
						findMany: jest.fn(),
						findFirst: jest.fn(),
						update: jest.fn(),
						delete: jest.fn(),
						deleteMany: jest.fn(),
						count: jest.fn(),
					},
					userAddress: {
						create: jest.fn(),
						findMany: jest.fn(),
						findUnique: jest.fn(),
						update: jest.fn(),
						updateMany: jest.fn(),
						delete: jest.fn(),
					},
					building: {
						create: jest.fn(),
						findUnique: jest.fn(),
						findMany: jest.fn(),
						update: jest.fn(),
						delete: jest.fn(),
						count: jest.fn(),
					},
					room: {
						create: jest.fn(),
						findUnique: jest.fn(),
						findMany: jest.fn(),
						update: jest.fn(),
						delete: jest.fn(),
						count: jest.fn(),
					},
					roomInstance: {
						create: jest.fn(),
						findUnique: jest.fn(),
						findMany: jest.fn(),
						update: jest.fn(),
						delete: jest.fn(),
						count: jest.fn(),
					},
					roomSeekingPost: {
						create: jest.fn(),
						findUnique: jest.fn(),
						findMany: jest.fn(),
						update: jest.fn(),
						delete: jest.fn(),
						count: jest.fn(),
					},
					roommateSeekingPost: {
						create: jest.fn(),
						findUnique: jest.fn(),
						findMany: jest.fn(),
						update: jest.fn(),
						delete: jest.fn(),
						count: jest.fn(),
					},
					tenantRoomPreferences: {
						create: jest.fn(),
						findUnique: jest.fn(),
						findMany: jest.fn(),
						update: jest.fn(),
						delete: jest.fn(),
					},
					province: {
						create: jest.fn(),
						findUnique: jest.fn(),
						findMany: jest.fn(),
						update: jest.fn(),
						delete: jest.fn(),
					},
					district: {
						create: jest.fn(),
						findUnique: jest.fn(),
						findMany: jest.fn(),
						update: jest.fn(),
						delete: jest.fn(),
					},
					ward: {
						create: jest.fn(),
						findUnique: jest.fn(),
						findMany: jest.fn(),
						update: jest.fn(),
						delete: jest.fn(),
					},
					refreshToken: {
						deleteMany: jest.fn(),
					},
				},
			},
			{
				provide: AuthService,
				useValue: {
					login: jest.fn(),
				},
			},
			{
				provide: PasswordService,
				useValue: new PasswordService(),
			},
			{
				provide: JwtService,
				useValue: new JwtService({ secret: 'test-secret' }),
			},
		],
	}).compile();
}
