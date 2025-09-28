import { randomUUID } from 'node:crypto';
import type { INestApplication, Type } from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { type Prisma, PrismaClient, type UserRole } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import type { AuthResponseDto } from '../auth/dto/auth-response.dto';
import { PasswordService } from '../auth/services/password.service';
import { PrismaService } from '../prisma/prisma.service';

interface UserRecord {
	id: string;
	email: string;
	passwordHash: string;
	firstName: string;
	lastName: string;
	role: UserRole;
	phone?: string | null;
	avatarUrl?: string | null;
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
	avatarUrl?: string | null;
	phoneNumber?: string | null;
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
	private readonly prisma: PrismaClient;
	private readonly authService?: AuthService;
	private readonly jwtService: JwtService;
	private readonly passwordService: PasswordService;
	private readonly jwtAccessOptions: JwtSignOptions = { expiresIn: '1h' };
	private readonly jwtRefreshOptions: JwtSignOptions = { expiresIn: '7d' };
	private readonly userRecords = new Map<string, UserRecord>();
	private readonly userPasswords = new Map<string, string>();

	constructor(private readonly app?: Pick<INestApplication, 'get'>) {
		// Use real PrismaClient from test database
		const prismaService = this.safeGet(PrismaService);
		this.prisma = prismaService ? (prismaService as any) : new PrismaClient();
		this.authService = this.safeGet(AuthService);
		this.passwordService = this.safeGet(PasswordService) ?? new PasswordService();
		this.jwtService =
			this.safeGet(JwtService) ??
			new JwtService({
				secret: process.env.JWT_SECRET ?? 'test-secret',
			});
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

	private async persistUser(data: Prisma.UserCreateInput): Promise<UserRecord> {
		const created = await this.prisma.user.create({ data });
		return this.normalizeUser(created);
	}

	private async createTokens(user: UserRecord, password: string): Promise<TokenResult> {
		if (this.authService) {
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

		const user = await this.prisma.user.findUnique({ where: { email } });
		return user ? this.normalizeUser(user) : undefined;
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
			avatarUrl: persistedUser.avatarUrl,
			phoneNumber: persistedUser.phone,
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

		await this.prisma.refreshToken.deleteMany({
			where: { userId: { in: userIds } },
		});

		await this.prisma.user.deleteMany({
			where: { id: { in: userIds } },
		});

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

		return this.prisma.building.create({
			data: {
				...data,
				owner: { connect: { id: landlordId } },
				district: { connect: { id: data.districtId } },
				province: { connect: { id: data.provinceId } },
			} as Prisma.BuildingCreateInput,
		});
	}

	async createTestRoom(buildingId: string, roomData: Record<string, unknown> = {}) {
		const data = {
			name: 'Test Room',
			slug: `test-room-${Date.now()}`,
			description: 'Integration test room',
			roomType: 'boarding_house' as const,
			totalRooms: 1,
			maxOccupancy: 2,
			isActive: true,
			...roomData,
		};

		return this.prisma.room.create({
			data: {
				...data,
				building: { connect: { id: buildingId } },
			} as Prisma.RoomCreateInput,
		});
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
			preferredRoomType: 'boarding_house' as const,
			occupancy: 1,
			moveInDate: new Date(),
			isPublic: true,
			expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
			...postData,
		};

		return this.prisma.roomSeekingPost.create({
			data: {
				...data,
				requester: { connect: { id: tenantId } },
				preferredProvince: { connect: { id: data.preferredProvinceId } },
				preferredDistrict: { connect: { id: data.preferredDistrictId } },
				preferredWard: { connect: { id: data.preferredWardId } },
			} as Prisma.RoomSeekingPostCreateInput,
		});
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

		return this.prisma.roommateSeekingPost.create({
			data: {
				...data,
				tenant: { connect: { id: tenantId } },
			} as Prisma.RoommateSeekingPostCreateInput,
		});
	}
}

export async function createTestModule(): Promise<TestingModule> {
	return Test.createTestingModule({
		providers: [
			PrismaService,
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
