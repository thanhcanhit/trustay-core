import { Expose, Transform } from 'class-transformer';
import { maskEmail, maskFullName, maskPhone } from '../utils/mask.utils';

export class PersonPublicView {
	@Expose()
	id!: string;

	@Expose({ groups: ['auth'] })
	firstName?: string;

	@Expose({ groups: ['auth'] })
	lastName?: string;

	@Expose()
	avatarUrl?: string;

	@Expose()
	@Transform(({ obj, options }) => {
		const fullName = `${obj?.firstName || ''} ${obj?.lastName || ''}`.trim();
		const groups = options?.groups as string[] | undefined;
		if (groups && groups.includes('auth')) {
			return fullName;
		}
		return maskFullName(fullName);
	})
	name!: string;

	@Expose()
	@Transform(({ value, options }) => {
		const email = typeof value === 'string' ? value : undefined;
		if (!email) {
			return undefined;
		}
		const groups = options?.groups as string[] | undefined;
		return groups && groups.includes('auth') ? email : maskEmail(email);
	})
	email?: string;

	@Expose()
	@Transform(({ value, options }) => {
		const phone = typeof value === 'string' ? value : undefined;
		if (!phone) {
			return undefined;
		}
		const groups = options?.groups as string[] | undefined;
		return groups && groups.includes('auth') ? phone : maskPhone(phone);
	})
	phone?: string;
}
