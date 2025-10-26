import { Injectable, Logger } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { ROOM_INDEX } from '../mappings/room.mapping';
import { ROOM_SEEKING_INDEX } from '../mappings/room-seeking.mapping';
import { ROOMMATE_SEEKING_INDEX } from '../mappings/roommate-seeking.mapping';

@Injectable()
export class ElasticsearchSyncService {
	private readonly logger = new Logger(ElasticsearchSyncService.name);

	constructor(private readonly elasticsearchService: ElasticsearchService) {}

	/**
	 * Index a single room document
	 */
	async indexRoom(room: any): Promise<void> {
		try {
			const document = this.transformRoomToDocument(room);

			await this.elasticsearchService.index({
				index: ROOM_INDEX,
				id: room.id,
				document,
			});

			this.logger.debug(`Indexed room: ${room.id}`);
		} catch (error) {
			this.logger.error(`Failed to index room ${room.id}:`, error);
			throw error;
		}
	}

	/**
	 * Index a single room seeking post
	 */
	async indexRoomSeekingPost(post: any): Promise<void> {
		try {
			const document = this.transformRoomSeekingToDocument(post);

			await this.elasticsearchService.index({
				index: ROOM_SEEKING_INDEX,
				id: post.id,
				document,
			});

			this.logger.debug(`Indexed room seeking post: ${post.id}`);
		} catch (error) {
			this.logger.error(`Failed to index room seeking post ${post.id}:`, error);
			throw error;
		}
	}

	/**
	 * Index a single roommate seeking post
	 */
	async indexRoommateSeekingPost(post: any): Promise<void> {
		try {
			const document = this.transformRoommateSeekingToDocument(post);

			await this.elasticsearchService.index({
				index: ROOMMATE_SEEKING_INDEX,
				id: post.id,
				document,
			});

			this.logger.debug(`Indexed roommate seeking post: ${post.id}`);
		} catch (error) {
			this.logger.error(`Failed to index roommate seeking post ${post.id}:`, error);
			throw error;
		}
	}

	/**
	 * Delete a document from an index
	 */
	async deleteDocument(index: string, id: string): Promise<void> {
		try {
			await this.elasticsearchService.delete({
				index,
				id,
			});

			this.logger.debug(`Deleted document ${id} from ${index}`);
		} catch (error) {
			if (error.meta?.statusCode !== 404) {
				this.logger.error(`Failed to delete document ${id} from ${index}:`, error);
				throw error;
			}
		}
	}

	/**
	 * Bulk index operations
	 */
	async bulkIndex(index: string, documents: any[]): Promise<void> {
		try {
			if (documents.length === 0) return;

			const body = documents.flatMap((doc) => [{ index: { _index: index, _id: doc.id } }, doc]);

			const result = await this.elasticsearchService.bulk({ body });

			if (result.errors) {
				this.logger.error('Bulk index had errors:', result.items);
			} else {
				this.logger.log(`Bulk indexed ${documents.length} documents to ${index}`);
			}
		} catch (error) {
			this.logger.error(`Failed to bulk index to ${index}:`, error);
			throw error;
		}
	}

	/**
	 * Transform Room data to Elasticsearch document
	 */
	private transformRoomToDocument(room: any): any {
		const building = room.building || {};
		const pricing = room.pricing || {};
		const owner = building.owner || {};

		// Count available room instances
		const availableRoomsCount = room.roomInstances
			? room.roomInstances.filter((ri: any) => ri.isActive && ri.status === 'available').length
			: 0;

		// Extract amenities
		const amenityIds = room.amenities ? room.amenities.map((a: any) => a.amenityId) : [];
		const amenityNames = room.amenities
			? room.amenities.map((a: any) => a.amenity?.name).filter(Boolean)
			: [];

		// Extract primary image
		const primaryImage = room.images
			? room.images.find((img: any) => img.isPrimary) || room.images[0]
			: null;

		// Build searchable text
		const searchText = [
			room.name,
			room.description,
			building.name,
			building.addressLine1,
			building.addressLine2,
			...amenityNames,
		]
			.filter(Boolean)
			.join(' ');

		return {
			id: room.id,
			slug: room.slug,
			name: room.name,
			description: room.description,
			roomType: room.roomType,
			areaSqm: room.areaSqm ? Number(room.areaSqm) : null,
			maxOccupancy: room.maxOccupancy,
			totalRooms: room.totalRooms,
			viewCount: room.viewCount || 0,
			isActive: room.isActive,
			isVerified: room.isVerified,
			overallRating: room.overallRating ? Number(room.overallRating) : null,
			totalRatings: room.totalRatings || 0,

			pricing: {
				id: pricing.id,
				basePriceMonthly: pricing.basePriceMonthly ? Number(pricing.basePriceMonthly) : null,
				depositAmount: pricing.depositAmount ? Number(pricing.depositAmount) : null,
				depositMonths: pricing.depositMonths,
				currency: pricing.currency,
				utilityIncluded: pricing.utilityIncluded,
				utilityCostMonthly: pricing.utilityCostMonthly ? Number(pricing.utilityCostMonthly) : null,
				priceNegotiable: pricing.priceNegotiable,
				minimumStayMonths: pricing.minimumStayMonths,
				maximumStayMonths: pricing.maximumStayMonths,
			},

			building: {
				id: building.id,
				name: building.name,
				addressLine1: building.addressLine1,
				addressLine2: building.addressLine2,
				isVerified: building.isVerified,
				isActive: building.isActive,

				// Geo-point
				location:
					building.latitude && building.longitude
						? {
								lat: Number(building.latitude),
								lon: Number(building.longitude),
							}
						: null,

				// Location IDs
				provinceId: building.provinceId,
				districtId: building.districtId,
				wardId: building.wardId,

				// Location names
				provinceName: building.province?.name,
				districtName: building.district?.name,
				wardName: building.ward?.name,

				// Owner info
				ownerId: owner.id,
				ownerName:
					owner.firstName && owner.lastName ? `${owner.firstName} ${owner.lastName}` : null,
				ownerRating: owner.overallRating ? Number(owner.overallRating) : null,
				ownerTotalRatings: owner.totalRatings || 0,
				ownerIsVerified: owner.isVerifiedPhone && owner.isVerifiedEmail && owner.isVerifiedIdentity,
			},

			availableRoomsCount,

			amenityIds,
			amenityNames,

			images: room.images
				? room.images.map((img: any) => ({
						id: img.id,
						imageUrl: img.imageUrl,
						altText: img.altText,
						isPrimary: img.isPrimary,
						sortOrder: img.sortOrder,
					}))
				: [],

			primaryImageUrl: primaryImage?.imageUrl,

			searchText,

			createdAt: room.createdAt,
			updatedAt: room.updatedAt,
		};
	}

	/**
	 * Transform RoomSeekingPost data to Elasticsearch document
	 */
	private transformRoomSeekingToDocument(post: any): any {
		const requester = post.requester || {};

		const amenityIds = post.amenities ? post.amenities.map((a: any) => a.id) : [];
		const amenityNames = post.amenities
			? post.amenities.map((a: any) => a.name).filter(Boolean)
			: [];

		const searchText = [post.title, post.description, ...amenityNames].filter(Boolean).join(' ');

		return {
			id: post.id,
			slug: post.slug,
			title: post.title,
			description: post.description,

			requesterId: post.requesterId,
			requesterName:
				requester.firstName && requester.lastName
					? `${requester.firstName} ${requester.lastName}`
					: null,
			requesterAvatarUrl: requester.avatarUrl,

			preferredProvinceId: post.preferredProvinceId,
			preferredDistrictId: post.preferredDistrictId,
			preferredWardId: post.preferredWardId,
			preferredProvinceName: post.preferredProvince?.name,
			preferredDistrictName: post.preferredDistrict?.name,
			preferredWardName: post.preferredWard?.name,

			minBudget: post.minBudget ? Number(post.minBudget) : null,
			maxBudget: post.maxBudget ? Number(post.maxBudget) : null,
			currency: post.currency,

			preferredRoomType: post.preferredRoomType,
			occupancy: post.occupancy,

			amenityIds,
			amenityNames,

			moveInDate: post.moveInDate,

			status: post.status,
			isPublic: post.isPublic,
			expiresAt: post.expiresAt,

			viewCount: post.viewCount || 0,
			contactCount: post.contactCount || 0,

			searchText,

			createdAt: post.createdAt,
			updatedAt: post.updatedAt,
		};
	}

	/**
	 * Transform RoommateSeekingPost data to Elasticsearch document
	 */
	private transformRoommateSeekingToDocument(post: any): any {
		const tenant = post.tenant || {};

		const searchText = [
			post.title,
			post.description,
			post.externalAddress,
			post.additionalRequirements,
		]
			.filter(Boolean)
			.join(' ');

		return {
			id: post.id,
			slug: post.slug,
			title: post.title,
			description: post.description,

			tenantId: post.tenantId,
			tenantName:
				tenant.firstName && tenant.lastName ? `${tenant.firstName} ${tenant.lastName}` : null,
			tenantAvatarUrl: tenant.avatarUrl,

			roomInstanceId: post.roomInstanceId,
			rentalId: post.rentalId,

			externalAddress: post.externalAddress,
			externalProvinceId: post.externalProvinceId,
			externalDistrictId: post.externalDistrictId,
			externalWardId: post.externalWardId,
			externalProvinceName: post.externalProvince?.name,
			externalDistrictName: post.externalDistrict?.name,
			externalWardName: post.externalWard?.name,

			monthlyRent: post.monthlyRent ? Number(post.monthlyRent) : null,
			currency: post.currency,
			depositAmount: post.depositAmount ? Number(post.depositAmount) : null,
			utilityCostPerPerson: post.utilityCostPerPerson ? Number(post.utilityCostPerPerson) : null,

			seekingCount: post.seekingCount,
			approvedCount: post.approvedCount || 0,
			remainingSlots: post.remainingSlots,
			maxOccupancy: post.maxOccupancy,
			currentOccupancy: post.currentOccupancy || 1,

			preferredGender: post.preferredGender,
			additionalRequirements: post.additionalRequirements,

			availableFromDate: post.availableFromDate,
			minimumStayMonths: post.minimumStayMonths || 1,
			maximumStayMonths: post.maximumStayMonths,

			status: post.status,
			requiresLandlordApproval: post.requiresLandlordApproval,
			isApprovedByLandlord: post.isApprovedByLandlord,
			isActive: post.isActive,
			expiresAt: post.expiresAt,

			viewCount: post.viewCount || 0,
			contactCount: post.contactCount || 0,

			searchText,

			createdAt: post.createdAt,
			updatedAt: post.updatedAt,
		};
	}
}
