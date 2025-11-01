import { EntityType } from '../types/chat.types';

export const ENTITY_ROUTE_MAP: Record<EntityType | 'room_seeking_post', string> = {
	room: '/rooms/:id',
	post: '/posts/:id',
	room_seeking_post: '/room-seeking-posts/:id',
};

export function buildEntityPath(entity: EntityType | 'room_seeking_post', id: string): string {
	const pattern: string | undefined = ENTITY_ROUTE_MAP[entity];
	if (!pattern) {
		return '';
	}
	return pattern.replace(':id', id);
}
