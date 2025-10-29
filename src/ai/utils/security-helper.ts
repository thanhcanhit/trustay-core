import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryType, UserAccessResult } from '../types/chat.types';

/**
 * Security helper for user access validation and WHERE clause generation
 */
export class SecurityHelper {
	/**
	 * Validate user access to sensitive data
	 * @param prisma - Prisma service instance
	 * @param userId - User ID
	 * @param query - User query to analyze
	 * @param queryType - Query type classification
	 * @returns Validation result with access restrictions
	 */
	static async validateUserAccess(
		prisma: PrismaService,
		userId: string | undefined,
		_query: string,
		queryType?: QueryType,
	): Promise<UserAccessResult> {
		if (queryType === 'ROOM_SEARCH' && !userId) {
			return {
				hasAccess: true,
				userRole: undefined,
				restrictions: [],
			};
		}
		if ((queryType === 'STATISTICS' || queryType === 'ROOM_CREATION') && !userId) {
			return {
				hasAccess: false,
				restrictions: ['Authentication required for statistics and room creation queries'],
			};
		}
		if (!userId) {
			return {
				hasAccess: queryType === 'ROOM_SEARCH',
				restrictions: queryType !== 'ROOM_SEARCH' ? ['Authentication required'] : [],
			};
		}
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { role: true },
		});
		if (!user) {
			throw new ForbiddenException('User not found');
		}
		const restrictions: string[] = [];
		if (queryType === 'STATISTICS') {
			if (user.role !== 'landlord') {
				restrictions.push('Only landlords can access statistics');
			}
		}
		if (queryType === 'ROOM_CREATION') {
			if (user.role !== 'landlord') {
				restrictions.push('Only landlords can create and manage rooms');
			}
		}
		return {
			hasAccess: restrictions.length === 0,
			userRole: user.role,
			restrictions,
		};
	}

	/**
	 * Generate user-specific WHERE clauses for SQL queries
	 * @param userId - User ID
	 * @param userRole - User role (tenant/landlord)
	 * @param query - User query
	 * @returns WHERE clauses to restrict data access
	 */
	static generateUserWhereClauses(userId: string, userRole: string, query: string): string {
		const queryLower = query.toLowerCase();
		const clauses: string[] = [];
		if (queryLower.includes('bill') || queryLower.includes('hóa đơn')) {
			if (userRole === 'tenant') {
				clauses.push(`rentals.tenant_id = '${userId}'`);
			} else if (userRole === 'landlord') {
				clauses.push(`rentals.owner_id = '${userId}'`);
			}
		}
		if (queryLower.includes('payment') || queryLower.includes('thanh toán')) {
			clauses.push(`payments.payer_id = '${userId}'`);
		}
		if (queryLower.includes('rental') || queryLower.includes('thuê')) {
			if (userRole === 'tenant') {
				clauses.push(`rentals.tenant_id = '${userId}'`);
			} else if (userRole === 'landlord') {
				clauses.push(`rentals.owner_id = '${userId}'`);
			}
		}
		if (queryLower.includes('building') || queryLower.includes('tòa nhà')) {
			if (userRole === 'landlord') {
				clauses.push(`buildings.owner_id = '${userId}'`);
			}
		}
		if (queryLower.includes('booking') || queryLower.includes('đặt phòng')) {
			clauses.push(`room_bookings.tenant_id = '${userId}'`);
		}
		return clauses.length > 0 ? clauses.join(' AND ') : '';
	}

	/**
	 * Validate if SQL query includes required user restrictions
	 * @param sql - SQL query string
	 * @param restrictions - Access restrictions
	 * @returns True if security checks pass
	 */
	static validateSqlSecurity(sql: string, restrictions: string[]): boolean {
		if (restrictions.length === 0) {
			return true;
		}
		const sqlLower = sql.toLowerCase();
		return restrictions.some((restriction) => {
			if (restriction.includes('bills')) {
				return sqlLower.includes('tenant_id') || sqlLower.includes('owner_id');
			}
			if (restriction.includes('payments')) {
				return sqlLower.includes('payer_id');
			}
			if (restriction.includes('rentals')) {
				return sqlLower.includes('tenant_id') || sqlLower.includes('owner_id');
			}
			return false;
		});
	}
}
