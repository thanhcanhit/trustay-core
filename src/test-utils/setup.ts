// Jest setup file
import 'reflect-metadata';
import { TestDatabase } from './test-database';

// Mock console methods to reduce noise in tests
global.console = {
	...console,
	log: jest.fn(),
	debug: jest.fn(),
	info: jest.fn(),
	warn: jest.fn(),
	error: jest.fn(),
};

// Global test database instance
let testDatabase: TestDatabase;

// Setup test database before all tests
beforeAll(async () => {
	testDatabase = new TestDatabase();
	await testDatabase.setup();
});

// Clean database before each test
beforeEach(async () => {
	await testDatabase.cleanDatabase();
});

// Teardown test database after all tests
afterAll(async () => {
	await testDatabase.teardown();
});

// Export test database for use in tests
export { testDatabase };

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
