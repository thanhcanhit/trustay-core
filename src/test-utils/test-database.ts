import { PrismaClient } from '@prisma/client';

export class TestDatabase {
	private prisma: PrismaClient;

	async setup(): Promise<void> {
		// Use main database URL for testing
		const databaseUrl =
			process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/trustay';

		console.log('Using database URL:', databaseUrl);

		// Create PrismaClient with main database URL
		this.prisma = new PrismaClient({
			datasources: {
				db: {
					url: databaseUrl,
				},
			},
			log: ['error'], // Only log errors in tests
		});

		await this.prisma.$connect();
		console.log('Database connected successfully');
		await this.cleanDatabase();
	}

	async cleanDatabase(): Promise<void> {
		// Clean all tables before each test in reverse order of dependencies
		// Based on Prisma schema relationships
		try {
			await this.prisma.roommateApplication.deleteMany();
			await this.prisma.roommateSeekingPost.deleteMany();
			await this.prisma.roomSeekingPost.deleteMany();
			await this.prisma.rental.deleteMany();
			await this.prisma.roomInstance.deleteMany();
			await this.prisma.room.deleteMany();
			await this.prisma.building.deleteMany();
			await this.prisma.userAddress.deleteMany();
			await this.prisma.ward.deleteMany();
			await this.prisma.district.deleteMany();
			await this.prisma.province.deleteMany();
			await this.prisma.user.deleteMany();
			await this.prisma.verificationCode.deleteMany();
			await this.prisma.refreshToken.deleteMany();
		} catch (error) {
			console.warn('Error cleaning database:', error.message);
		}
	}

	async teardown(): Promise<void> {
		await this.cleanDatabase();
		await this.prisma.$disconnect();
	}

	getPrisma(): PrismaClient {
		return this.prisma;
	}
}
