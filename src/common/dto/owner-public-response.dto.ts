export interface OwnerPublicResponseDto {
	id: string;
	firstName?: string;
	lastName?: string;
	avatarUrl?: string;
	gender?: string | null;
	email?: string;
	phone?: string;
	isVerifiedPhone: boolean;
	isVerifiedEmail: boolean;
	isVerifiedIdentity: boolean;
	isOnline?: boolean;
	lastActiveAt?: Date | null;
}
