import { EntityType } from '../types/chat.types';

export const ENTITY_ROUTE_MAP: Record<EntityType, string> = {
	room: '/rooms/:id',
	post: '/posts/:id',
};

export function buildEntityPath(entity: EntityType, id: string): string {
	const pattern: string | undefined = ENTITY_ROUTE_MAP[entity];
	if (!pattern) {
		return '';
	}
	return pattern.replace(':id', id);
}
