// Jest setup file
import 'reflect-metadata';

// Mock console methods to reduce noise in tests
global.console = {
	...console,
	log: jest.fn(),
	debug: jest.fn(),
	info: jest.fn(),
	warn: jest.fn(),
	error: jest.fn(),
};

// Mock external services
jest.mock('../prisma/prisma.service', () => ({
	PrismaService: jest.fn().mockImplementation(() => ({
		user: {
			create: jest.fn(),
			findMany: jest.fn(),
			findUnique: jest.fn(),
			findFirst: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
			count: jest.fn(),
		},
		address: {
			create: jest.fn(),
			findMany: jest.fn(),
			findUnique: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
		},
		verification: {
			findFirst: jest.fn(),
			update: jest.fn(),
		},
	})),
}));

jest.mock('../common/services/upload.service', () => ({
	UploadService: jest.fn().mockImplementation(() => ({
		uploadFile: jest.fn(),
		deleteFile: jest.fn(),
	})),
}));

jest.mock('../api/notifications/notifications.service', () => ({
	NotificationsService: jest.fn().mockImplementation(() => ({
		sendNotification: jest.fn(),
	})),
}));

// Mock Prisma Client
jest.mock('@prisma/client', () => ({
	PrismaClient: jest.fn().mockImplementation(() => ({
		$connect: jest.fn(),
		$disconnect: jest.fn(),
		$on: jest.fn(),
	})),
}));

// Helper functions for test database setup
export async function setupTestDatabase(): Promise<void> {
	// Add any database setup logic here
	// This could include creating test database, running migrations, etc.
}

export async function cleanupTestDatabase(): Promise<void> {
	// Add any database cleanup logic here
	// This could include dropping test database, cleaning up data, etc.
}
