import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { BreadcrumbDto, SeoDto } from '../../common/dto';
import { RoomDetailOutputDto, RoomListItemOutputDto } from '../../common/dto/room-output.dto';
import { UploadService } from '../../common/services/upload.service';
import { generateRoomSlug, generateUniqueSlug } from '../../common/utils';
import {
	formatRoomDetail,
	formatRoomListItem,
	getOwnerStats,
} from '../../common/utils/room-formatter.utils';
import { PrismaService } from '../../prisma/prisma.service';
import { ElasticsearchQueueService } from '../../queue/services/elasticsearch-queue.service';
import {
	BulkUpdateRoomInstanceStatusDto,
	CreateRoomDto,
	RoomResponseDto,
	UpdateRoomDto,
	UpdateRoomInstanceStatusDto,
} from './dto';
import { RoomDetailWithMetaResponseDto } from './dto/room-detail-with-meta.dto';

@Injectable()
export class RoomsService {
	private viewCache = new Map<string, { timestamp: number; ips: Set<string> }>();
	private readonly VIEW_COOLDOWN_MS = 1 * 60 * 1000; // 1 phút
	private readonly CACHE_CLEANUP_INTERVAL = 30 * 60 * 1000; // 30 phút

	constructor(
		private readonly prisma: PrismaService,
		private readonly uploadService: UploadService,
		private readonly elasticsearchQueueService: ElasticsearchQueueService,
	) {
		// Dọn dẹp cache định kỳ
		setInterval(() => {
			this.cleanupViewCache();
		}, this.CACHE_CLEANUP_INTERVAL);
	}

	/**
	 * Dọn dẹp cache view cũ
	 */
	private cleanupViewCache(): void {
		const now = Date.now();
		for (const [key, value] of this.viewCache.entries()) {
			if (now - value.timestamp > this.VIEW_COOLDOWN_MS * 2) {
				this.viewCache.delete(key);
			}
		}
	}

	/**
	 * Kiểm tra và ghi nhận view mới
	 * @param roomId - ID của room
	 * @param clientIp - IP của client (có thể undefined nếu không có)
	 * @returns true nếu view hợp lệ, false nếu bị chặn do spam
	 */
	private shouldIncrementView(roomId: string, clientIp?: string): boolean {
		const cacheKey = roomId;
		const now = Date.now();

		if (!this.viewCache.has(cacheKey)) {
			this.viewCache.set(cacheKey, {
				timestamp: now,
				ips: new Set(clientIp ? [clientIp] : []),
			});
			return true;
		}

		const cacheEntry = this.viewCache.get(cacheKey)!;

		// Nếu có IP và IP này đã xem trong thời gian cooldown
		if (clientIp && cacheEntry.ips.has(clientIp)) {
			if (now - cacheEntry.timestamp < this.VIEW_COOLDOWN_MS) {
				return false; // Chặn spam từ cùng IP
			}
		}

		// Cập nhật cache
		if (clientIp) {
			cacheEntry.ips.add(clientIp);
		}
		cacheEntry.timestamp = now;

		return true;
	}

	/**
	 * Generate SEO data for room detail page
	 */
	private async generateRoomDetailSeo(room: any): Promise<SeoDto> {
		const { name, roomType, building, pricing } = room;

		// Get room type info
		const roomTypeMap: Record<string, string> = {
			boarding_house: 'nhà trọ',
			dormitory: 'ký túc xá',
			sleepbox: 'sleepbox',
			apartment: 'chung cư',
			whole_house: 'nhà nguyên căn',
		};
		const roomTypeText = roomTypeMap[roomType] || 'phòng trọ';

		// Get location info
		const locationParts = [];
		if (building.ward?.name) {
			locationParts.push(building.ward.name);
		}
		if (building.district?.name) {
			locationParts.push(building.district.name);
		}
		if (building.province?.name) {
			locationParts.push(building.province.name);
		}

		// Get price info
		const price = pricing?.basePriceMonthly ? Number(pricing.basePriceMonthly) : 0;
		const priceText = price > 0 ? `${(price / 1000000).toFixed(1)} triệu/tháng` : '';

		// Build title
		let title = `${name} - ${roomTypeText}`;
		if (locationParts.length > 0) {
			title += ` tại ${locationParts.join(', ')}`;
		}
		if (priceText) {
			title += ` ${priceText}`;
		}
		title += ' | Trustay';

		// Build description
		let description = `${name} - ${roomTypeText} chất lượng cao`;
		if (locationParts.length > 0) {
			description += ` tại ${locationParts.join(', ')}`;
		}
		if (priceText) {
			description += ` với giá ${priceText}`;
		}
		description += '. Xem chi tiết, đặt phòng ngay!';

		// Build keywords
		const keywords = [
			name,
			roomTypeText,
			'phòng trọ',
			'nhà trọ',
			'thuê phòng',
			...locationParts,
			priceText ? 'giá rẻ' : '',
			'đầy đủ tiện nghi',
			'chất lượng cao',
		]
			.filter(Boolean)
			.join(', ');

		return {
			title,
			description,
			keywords,
		};
	}

	/**
	 * Generate breadcrumb for room detail page
	 */
	private async generateRoomDetailBreadcrumb(room: any): Promise<BreadcrumbDto> {
		const { name, roomType, building } = room;

		const items = [
			{ title: 'Trang chủ', path: '/' },
			{ title: 'Tìm phòng trọ', path: '/rooms' },
		];

		if (building.district?.name) {
			items.push({
				title: building.district.name,
				path: `/rooms?districtId=${building.district.id}`,
			});
		}
		if (building.province?.name) {
			items.push({
				title: building.province.name,
				path: `/rooms?provinceId=${building.province.id}`,
			});
		}

		// Add room type breadcrumb
		const roomTypeMap: Record<string, string> = {
			boarding_house: 'Nhà trọ',
			dormitory: 'Ký túc xá',
			sleepbox: 'Sleepbox',
			apartment: 'Chung cư',
			whole_house: 'Nhà nguyên căn',
		};
		items.push({
			title: roomTypeMap[roomType] || roomType,
			path: `/rooms?roomType=${roomType}`,
		});

		// Add room name (current page)
		items.push({
			title: name,
			path: `/rooms/${room.slug}`,
		});

		return { items };
	}

	/**
	 * Get similar rooms in the same district and province
	 */
	private async getSimilarRooms(
		room: any,
		limit: number = 8,
		isAuthenticated: boolean = false,
	): Promise<RoomListItemOutputDto[]> {
		const { building } = room;

		// Get rooms in the same district and province, excluding current room
		const similarRooms = await this.prisma.room.findMany({
			where: {
				id: { not: room.id },
				isActive: true,
				building: {
					districtId: building.districtId,
					provinceId: building.provinceId,
				},
			},
			include: {
				building: {
					include: {
						province: { select: { id: true, name: true, code: true } },
						district: { select: { id: true, name: true, code: true } },
						ward: { select: { id: true, name: true, code: true } },
						owner: {
							select: {
								id: true,
								firstName: true,
								lastName: true,
								avatarUrl: true,
								gender: true,
								isVerifiedPhone: true,
								isVerifiedEmail: true,
								isVerifiedIdentity: true,
								isOnline: true,
								lastActiveAt: true,
							},
						},
					},
				},
				images: {
					select: {
						id: true,
						imageUrl: true,
						altText: true,
						sortOrder: true,
						isPrimary: true,
					},
					orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
					take: 1, // Only get primary image for list view
				},
				pricing: {
					select: {
						basePriceMonthly: true,
						currency: true,
					},
				},
			},
			orderBy: [
				{ viewCount: 'desc' }, // Popular rooms first
				{ createdAt: 'desc' }, // Then newest
			],
			take: limit,
		});

		// Format similar rooms using the same utility as listing
		return similarRooms.map((similarRoom) => {
			const ownerStats = { totalBuildings: 0, totalRoomInstances: 0 }; // Simplified for similar rooms
			return formatRoomListItem(similarRoom, isAuthenticated, { ownerStats });
		});
	}

	async create(
		userId: string,
		buildingId: string,
		createRoomDto: CreateRoomDto,
	): Promise<RoomDetailOutputDto> {
		// Verify building ownership and existence
		const building = await this.prisma.building.findUnique({
			where: { id: buildingId },
			select: {
				id: true,
				slug: true,
				owner: { select: { id: true, role: true } },
			},
		});

		if (!building) {
			throw new NotFoundException('Building not found');
		}

		if (building.owner.id !== userId) {
			throw new ForbiddenException('Only building owner can create rooms');
		}

		if (building.owner.role !== UserRole.landlord) {
			throw new ForbiddenException('Only landlords can create rooms');
		}

		// Validate system references exist
		await this.validateSystemReferences(createRoomDto);

		// Generate unique room slug
		const baseSlug = generateRoomSlug(building.slug, createRoomDto.name);
		const uniqueSlug = await generateUniqueSlug(baseSlug, async (slug: string) => {
			const existing = await this.prisma.room.findUnique({
				where: { slug },
				select: { id: true },
			});
			return !!existing;
		});

		// Create room with related data in transaction
		const result = await this.prisma.$transaction(async (tx) => {
			// 1. Create room
			const room = await tx.room.create({
				data: {
					slug: uniqueSlug,
					buildingId,
					floorNumber: createRoomDto.floorNumber,
					name: createRoomDto.name,
					description: createRoomDto.description,
					roomType: createRoomDto.roomType,
					areaSqm: createRoomDto.areaSqm,
					maxOccupancy: createRoomDto.maxOccupancy || 1,
					totalRooms: createRoomDto.totalRooms,
					isActive: createRoomDto.isActive ?? true,
				},
			});

			// 2. Create pricing
			await tx.roomPricing.create({
				data: {
					roomId: room.id,
					basePriceMonthly: createRoomDto.pricing.basePriceMonthly,
					depositAmount: createRoomDto.pricing.depositAmount,
					depositMonths: createRoomDto.pricing.depositMonths || 1,
					utilityIncluded: createRoomDto.pricing.utilityIncluded || false,
					utilityCostMonthly: createRoomDto.pricing.utilityCostMonthly,
					cleaningFee: createRoomDto.pricing.cleaningFee,
					serviceFeePercentage: createRoomDto.pricing.serviceFeePercentage,
					minimumStayMonths: createRoomDto.pricing.minimumStayMonths || 1,
					maximumStayMonths: createRoomDto.pricing.maximumStayMonths,
					priceNegotiable: createRoomDto.pricing.priceNegotiable || false,
				},
			});

			// 3. Create amenities
			if (createRoomDto.amenities?.length) {
				await tx.roomAmenity.createMany({
					data: createRoomDto.amenities.map((amenity) => ({
						roomId: room.id,
						amenityId: amenity.systemAmenityId,
						customValue: amenity.customValue,
						notes: amenity.notes,
					})),
				});
			}

			// 4. Create costs
			if (createRoomDto.costs?.length) {
				await tx.roomCost.createMany({
					data: createRoomDto.costs.map((cost) => ({
						roomId: room.id,
						costTypeTemplateId: cost.systemCostTypeId,
						costType: cost.costType || 'fixed',
						// Map value to appropriate field based on costType
						fixedAmount: cost.costType === 'fixed' ? cost.value : null,
						unitPrice: ['per_person', 'metered'].includes(cost.costType || 'fixed')
							? cost.value
							: null,
						unit: cost.unit,
						billingCycle: cost.billingCycle || 'monthly',
						includedInRent: cost.includedInRent || false,
						isOptional: cost.isOptional || false,
						notes: cost.notes,
					})),
				});
			}

			// 5. Create rules
			if (createRoomDto.rules?.length) {
				await tx.roomRule.createMany({
					data: createRoomDto.rules.map((rule) => ({
						roomId: room.id,
						ruleTemplateId: rule.systemRuleId,
						customValue: rule.customValue,
						isEnforced: rule.isEnforced ?? true,
						notes: rule.notes,
					})),
				});
			}

			// 6. Create room instances (batch)
			const roomInstances = this.generateRoomNumbers(
				createRoomDto.totalRooms,
				createRoomDto.roomNumberPrefix,
				createRoomDto.roomNumberStart || 1,
			);

			await tx.roomInstance.createMany({
				data: roomInstances.map((roomNumber) => ({
					roomId: room.id,
					roomNumber,
					status: 'available',
					isActive: true,
				})),
			});

			// 7. Create room images from string array
			if (createRoomDto.images?.images?.length) {
				const imageData = createRoomDto.images.images.map((image, index) => ({
					roomId: room.id,
					imageUrl: image.path,
					altText: image.alt || `Room image`,
					sortOrder: image.sortOrder ?? index,
					isPrimary: image.isPrimary ?? index === 0, // First image is primary if not specified
				}));

				await tx.roomImage.createMany({
					data: imageData,
				});
			}

			return room.id;
		});

		// Queue Elasticsearch indexing (async, best-effort)
		void this.elasticsearchQueueService.queueIndexRoom(result);

		// Return created room with full details
		return this.findOne(result);
	}

	async findOne(roomId: string): Promise<RoomDetailOutputDto> {
		const room = await this.prisma.room.findUnique({
			where: { id: roomId },
			include: {
				building: {
					include: {
						province: { select: { id: true, name: true, code: true } },
						district: { select: { id: true, name: true, code: true } },
						ward: { select: { id: true, name: true, code: true } },
						owner: {
							select: {
								id: true,
								firstName: true,
								lastName: true,
								avatarUrl: true,
								gender: true,
								email: true,
								phone: true,
								isVerifiedPhone: true,
								isVerifiedEmail: true,
								isVerifiedIdentity: true,
								isOnline: true,
								lastActiveAt: true,
								overallRating: true,
								totalRatings: true,
							},
						},
					},
				},
				roomInstances: {
					select: {
						id: true,
						roomNumber: true,
						status: true,
						isActive: true,
					},
					where: { isActive: true },
					orderBy: { roomNumber: 'asc' },
				},
				images: {
					select: {
						id: true,
						imageUrl: true,
						altText: true,
						sortOrder: true,
						isPrimary: true,
					},
					orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
				},
				amenities: {
					select: {
						id: true,
						customValue: true,
						notes: true,
						amenity: {
							select: {
								id: true,
								name: true,
								nameEn: true,
								category: true,
							},
						},
					},
				},
				costs: {
					select: {
						id: true,
						fixedAmount: true,
						currency: true,
						notes: true,
						costTypeTemplate: {
							select: {
								id: true,
								name: true,
								nameEn: true,
								category: true,
								defaultUnit: true,
							},
						},
					},
				},
				pricing: {
					select: {
						id: true,
						basePriceMonthly: true,
						currency: true,
						depositAmount: true,
						depositMonths: true,
						utilityIncluded: true,
						utilityCostMonthly: true,
						minimumStayMonths: true,
						maximumStayMonths: true,
						priceNegotiable: true,
					},
				},
				rules: {
					select: {
						id: true,
						customValue: true,
						isEnforced: true,
						notes: true,
						ruleTemplate: {
							select: {
								id: true,
								ruleType: true,
								name: true,
								nameEn: true,
							},
						},
					},
				},
			},
		});

		if (!room) {
			throw new NotFoundException('Room not found');
		}

		// Get owner statistics
		const ownerStats = await getOwnerStats(this.prisma, room.buildingId);

		// Use the same format utility as public endpoint
		// For admin, always show full info (authenticated = true)
		return formatRoomDetail(room, true, ownerStats);
	}

	private async validateSystemReferences(createRoomDto: CreateRoomDto): Promise<void> {
		// Validate amenities
		if (createRoomDto.amenities?.length) {
			const amenityIds = createRoomDto.amenities.map((a) => a.systemAmenityId);
			const existingAmenities = await this.prisma.amenity.findMany({
				where: { id: { in: amenityIds }, isActive: true },
				select: { id: true },
			});

			if (existingAmenities.length !== amenityIds.length) {
				throw new BadRequestException('Some amenities not found or inactive');
			}
		}

		// Validate cost types
		if (createRoomDto.costs?.length) {
			const costTypeIds = createRoomDto.costs.map((c) => c.systemCostTypeId);
			const existingCostTypes = await this.prisma.costTypeTemplate.findMany({
				where: { id: { in: costTypeIds }, isActive: true },
				select: { id: true },
			});

			if (existingCostTypes.length !== costTypeIds.length) {
				throw new BadRequestException('Some cost types not found or inactive');
			}
		}

		// Validate rules
		if (createRoomDto.rules?.length) {
			const ruleIds = createRoomDto.rules.map((r) => r.systemRuleId);
			const existingRules = await this.prisma.roomRuleTemplate.findMany({
				where: { id: { in: ruleIds }, isActive: true },
				select: { id: true },
			});

			if (existingRules.length !== ruleIds.length) {
				throw new BadRequestException('Some rules not found or inactive');
			}
		}
	}

	private generateRoomNumbers(
		totalRooms: number,
		prefix?: string,
		startNumber: number = 1,
	): string[] {
		const roomNumbers: string[] = [];

		for (let i = 0; i < totalRooms; i++) {
			const number = startNumber + i;
			const roomNumber = prefix ? `${prefix}${number}` : number.toString();
			roomNumbers.push(roomNumber);
		}

		return roomNumbers;
	}

	private transformRoomResponse(room: any): RoomResponseDto {
		const availableInstancesCount =
			room.roomInstances?.filter((instance: any) => instance.status === 'available').length || 0;

		const occupiedInstancesCount =
			room.roomInstances?.filter((instance: any) => instance.status === 'occupied').length || 0;

		// Helper function to safely convert Decimal values
		const safeDecimal = (value: any) => {
			if (value === null || value === undefined) {
				return null;
			}
			return value;
		};

		// Clean up pricing data to avoid Decimal errors
		const cleanPricing = room.pricing
			? {
					...room.pricing,
					basePriceMonthly: safeDecimal(room.pricing.basePriceMonthly) || 0,
					depositAmount: safeDecimal(room.pricing.depositAmount) || 0,
					utilityCostMonthly: safeDecimal(room.pricing.utilityCostMonthly),
					cleaningFee: safeDecimal(room.pricing.cleaningFee),
					serviceFeePercentage: safeDecimal(room.pricing.serviceFeePercentage),
				}
			: null;

		// Clean up costs data
		const cleanCosts =
			room.costs?.map((cost: any) => ({
				...cost,
				unitPrice: safeDecimal(cost.unitPrice),
				fixedAmount: safeDecimal(cost.fixedAmount),
				perPersonAmount: safeDecimal(cost.perPersonAmount),
				meterReading: safeDecimal(cost.meterReading),
				lastMeterReading: safeDecimal(cost.lastMeterReading),
			})) || [];

		// Clean up main room data
		const cleanRoom = {
			...room,
			areaSqm: safeDecimal(room.areaSqm),
			pricing: cleanPricing,
			costs: cleanCosts,
			building: room.building,
			availableInstancesCount,
			occupiedInstancesCount,
		};

		try {
			// Temporarily bypass plainToClass transformation to avoid Decimal errors
			return cleanRoom as RoomResponseDto;
		} catch (error) {
			console.error('Transform error:', error);
			console.error('Clean room data keys:', Object.keys(cleanRoom));
			console.error('Problematic fields:', {
				areaSqm: cleanRoom.areaSqm,
				pricing: cleanRoom.pricing ? Object.keys(cleanRoom.pricing) : null,
				costs: cleanRoom.costs ? cleanRoom.costs.length : 0,
			});
			throw error;
		}
	}

	async getRoomBySlug(
		slug: string,
		clientIp?: string,
		context: { isAuthenticated: boolean } = { isAuthenticated: false },
	): Promise<RoomDetailWithMetaResponseDto> {
		const { isAuthenticated } = context;
		// Find room type by slug
		const room = await this.prisma.room.findFirst({
			where: {
				slug: slug,
				isActive: true,
			},
			include: {
				building: {
					include: {
						province: { select: { id: true, name: true, code: true } },
						district: { select: { id: true, name: true, code: true } },
						ward: { select: { id: true, name: true, code: true } },
						owner: {
							select: {
								id: true,
								firstName: true,
								lastName: true,
								avatarUrl: true,
								gender: true,
								email: true,
								phone: true,
								isVerifiedPhone: true,
								isVerifiedEmail: true,
								isVerifiedIdentity: true,
								isOnline: true,
								lastActiveAt: true,
								overallRating: true,
								totalRatings: true,
							},
						},
					},
				},
				roomInstances: {
					select: {
						id: true,
						roomNumber: true,
						status: true,
						isActive: true,
					},
					where: { isActive: true },
					orderBy: { roomNumber: 'asc' },
				},
				images: {
					select: {
						id: true,
						imageUrl: true,
						altText: true,
						sortOrder: true,
						isPrimary: true,
					},
					orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
				},
				amenities: {
					select: {
						id: true,
						customValue: true,
						notes: true,
						amenity: {
							select: {
								id: true,
								name: true,
								nameEn: true,
								category: true,
							},
						},
					},
				},
				costs: {
					select: {
						id: true,
						fixedAmount: true,
						currency: true,
						notes: true,
						costTypeTemplate: {
							select: {
								id: true,
								name: true,
								nameEn: true,
								category: true,
								defaultUnit: true,
							},
						},
					},
				},
				pricing: {
					select: {
						id: true,
						basePriceMonthly: true,
						currency: true,
						depositAmount: true,
						depositMonths: true,
						utilityIncluded: true,
						utilityCostMonthly: true,
						minimumStayMonths: true,
						maximumStayMonths: true,
						priceNegotiable: true,
					},
				},
				rules: {
					select: {
						id: true,
						customValue: true,
						isEnforced: true,
						notes: true,
						ruleTemplate: {
							select: {
								id: true,
								ruleType: true,
								name: true,
								nameEn: true,
							},
						},
					},
				},
			},
		});

		if (!room) {
			throw new NotFoundException('Room not found');
		}

		// Tăng view count với chiến lược chống spam
		if (this.shouldIncrementView(room.id, clientIp)) {
			await this.prisma.room.update({
				where: { id: room.id },
				data: { viewCount: { increment: 1 } },
			});
		}

		// Get owner statistics
		const ownerStats = await getOwnerStats(this.prisma, room.buildingId);

		// Use the formatting utility function
		const roomDetail = formatRoomDetail(room, isAuthenticated, ownerStats);

		// Generate SEO and breadcrumb
		const seo = await this.generateRoomDetailSeo(room);
		const breadcrumb = await this.generateRoomDetailBreadcrumb(room);

		// Get similar rooms
		const similarRooms = await this.getSimilarRooms(room, 8, isAuthenticated);

		return {
			...roomDetail,
			seo,
			breadcrumb,
			similarRooms,
		};
	}

	async update(
		userId: string,
		roomId: string,
		updateRoomDto: UpdateRoomDto,
	): Promise<RoomDetailOutputDto> {
		// Verify room ownership
		const existingRoom = await this.prisma.room.findUnique({
			where: { id: roomId },
			include: {
				building: {
					select: {
						id: true,
						slug: true,
						owner: { select: { id: true, role: true } },
					},
				},
			},
		});

		if (!existingRoom) {
			throw new NotFoundException('Room not found');
		}

		if (existingRoom.building.owner.id !== userId) {
			throw new ForbiddenException('Only building owner can update room');
		}

		if (existingRoom.building.owner.role !== UserRole.landlord) {
			throw new ForbiddenException('Only landlords can update rooms');
		}

		// Validate system references if provided
		if (updateRoomDto.amenities || updateRoomDto.costs || updateRoomDto.rules) {
			await this.validateSystemReferencesForUpdate(updateRoomDto);
		}

		// Generate new slug if name changed
		let newSlug = existingRoom.slug;
		if (updateRoomDto.name && updateRoomDto.name !== existingRoom.name) {
			const baseSlug = generateRoomSlug(existingRoom.building.slug, updateRoomDto.name);
			if (baseSlug !== existingRoom.slug) {
				newSlug = await generateUniqueSlug(baseSlug, async (slug: string) => {
					if (slug === existingRoom.slug) {
						return false;
					} // Same slug is OK
					const existing = await this.prisma.room.findUnique({
						where: { slug },
						select: { id: true },
					});
					return !!existing;
				});
			}
		}

		// Update room with related data in transaction
		await this.prisma.$transaction(async (tx) => {
			// 1. Update room basic info
			await tx.room.update({
				where: { id: roomId },
				data: {
					...(newSlug !== existingRoom.slug && { slug: newSlug }),
					...(updateRoomDto.name && { name: updateRoomDto.name }),
					...(updateRoomDto.description !== undefined && {
						description: updateRoomDto.description,
					}),
					...(updateRoomDto.roomType && { roomType: updateRoomDto.roomType }),
					...(updateRoomDto.areaSqm && { areaSqm: updateRoomDto.areaSqm }),
					...(updateRoomDto.isActive !== undefined && { isActive: updateRoomDto.isActive }),
				},
			});

			// 2. Handle totalRooms increase (chỉ cho phép tăng)
			if (updateRoomDto.totalRooms && updateRoomDto.totalRooms > existingRoom.totalRooms) {
				const additionalRooms = updateRoomDto.totalRooms - existingRoom.totalRooms;

				// Get existing room numbers to avoid conflicts
				const existingInstances = await tx.roomInstance.findMany({
					where: { roomId },
					select: { roomNumber: true },
					orderBy: { roomNumber: 'asc' },
				});

				// Generate new room numbers
				const newRoomNumbers = this.generateAdditionalRoomNumbers(
					existingInstances.map((i) => i.roomNumber),
					additionalRooms,
				);

				// Create additional room instances
				await tx.roomInstance.createMany({
					data: newRoomNumbers.map((roomNumber) => ({
						roomId,
						roomNumber,
						status: 'available',
						isActive: true,
					})),
				});

				// Update totalRooms
				await tx.room.update({
					where: { id: roomId },
					data: { totalRooms: updateRoomDto.totalRooms },
				});
			}

			// 3. Update pricing if provided
			if (updateRoomDto.pricing) {
				const pricingData = {
					...(updateRoomDto.pricing.basePriceMonthly !== undefined && {
						basePriceMonthly: updateRoomDto.pricing.basePriceMonthly,
					}),
					...(updateRoomDto.pricing.depositAmount !== undefined && {
						depositAmount: updateRoomDto.pricing.depositAmount,
					}),
					...(updateRoomDto.pricing.depositMonths !== undefined && {
						depositMonths: updateRoomDto.pricing.depositMonths,
					}),
					...(updateRoomDto.pricing.billingCycle && {
						billingCycle: updateRoomDto.pricing.billingCycle,
					}),
					...(updateRoomDto.pricing.allowAdvancePayment !== undefined && {
						allowAdvancePayment: updateRoomDto.pricing.allowAdvancePayment,
					}),
					...(updateRoomDto.pricing.maxAdvanceMonths !== undefined && {
						maxAdvanceMonths: updateRoomDto.pricing.maxAdvanceMonths,
					}),
					...(updateRoomDto.pricing.advancePaymentDiscount !== undefined && {
						advancePaymentDiscount: updateRoomDto.pricing.advancePaymentDiscount,
					}),
					...(updateRoomDto.pricing.isNegotiable !== undefined && {
						priceNegotiable: updateRoomDto.pricing.isNegotiable,
					}),
					...(updateRoomDto.pricing.priceNotes !== undefined && {
						priceNotes: updateRoomDto.pricing.priceNotes,
					}),
				};

				await tx.roomPricing.upsert({
					where: { roomId },
					update: pricingData,
					create: {
						roomId,
						basePriceMonthly: updateRoomDto.pricing.basePriceMonthly || 0,
						depositAmount: updateRoomDto.pricing.depositAmount || 0,
						depositMonths: updateRoomDto.pricing.depositMonths || 1,
						...pricingData,
					},
				});
			}

			// 4. OVERRIDE amenities (GHI ĐÈ HOÀN TOÀN)
			if (updateRoomDto.amenities !== undefined) {
				// Delete all existing amenities
				await tx.roomAmenity.deleteMany({
					where: { roomId },
				});

				// Create new amenities if provided
				if (updateRoomDto.amenities.length > 0) {
					await tx.roomAmenity.createMany({
						data: updateRoomDto.amenities.map((amenity) => ({
							roomId,
							amenityId: amenity.systemAmenityId!,
							customValue: amenity.customValue,
							notes: amenity.notes,
						})),
					});
				}
			}

			// 5. OVERRIDE costs (GHI ĐÈ HOÀN TOÀN)
			if (updateRoomDto.costs !== undefined) {
				// Delete all existing costs
				await tx.roomCost.deleteMany({
					where: { roomId },
				});

				// Create new costs if provided
				if (updateRoomDto.costs.length > 0) {
					await tx.roomCost.createMany({
						data: updateRoomDto.costs.map((cost) => ({
							roomId,
							costTypeTemplateId: cost.systemCostTypeId!,
							costType: cost.costType || 'fixed',
							// Map value to appropriate field based on costType
							fixedAmount: cost.costType === 'fixed' ? cost.value : null,
							unitPrice: ['per_person', 'metered'].includes(cost.costType || 'fixed')
								? cost.value
								: null,
							unit: cost.unit,
							billingCycle: cost.billingCycle || 'monthly',
							includedInRent: cost.isIncludedInRent || false,
							isOptional: !cost.isMandatory,
							notes: cost.notes,
						})),
					});
				}
			}

			// 6. OVERRIDE rules (GHI ĐÈ HOÀN TOÀN)
			if (updateRoomDto.rules !== undefined) {
				// Delete all existing rules
				await tx.roomRule.deleteMany({
					where: { roomId },
				});

				// Create new rules if provided
				if (updateRoomDto.rules.length > 0) {
					await tx.roomRule.createMany({
						data: updateRoomDto.rules.map((rule) => ({
							roomId,
							ruleTemplateId: rule.systemRuleId!,
							customValue: rule.customValue,
							isEnforced: rule.isStrict ?? true,
							notes: rule.notes,
						})),
					});
				}
			}

			// 7. OVERRIDE images (GHI ĐÈ HOÀN TOÀN)
			if (updateRoomDto.images !== undefined) {
				// Delete all existing images
				await tx.roomImage.deleteMany({
					where: { roomId },
				});

				// Create new images if provided
				if (updateRoomDto.images.images && updateRoomDto.images.images.length > 0) {
					const imageData = updateRoomDto.images.images.map((image, index) => ({
						roomId,
						imageUrl: image.path,
						altText: image.alt || `Room image`,
						sortOrder: image.sortOrder ?? index,
						isPrimary: image.isPrimary ?? index === 0, // First image is primary if not specified
					}));

					await tx.roomImage.createMany({
						data: imageData,
					});
				}
			}
		});

		// Queue Elasticsearch re-indexing (async, best-effort)
		void this.elasticsearchQueueService.queueIndexRoom(roomId);

		// Return updated room with full details
		return this.findOne(roomId);
	}

	async remove(userId: string, roomId: string): Promise<void> {
		// Verify room ownership
		const room = await this.prisma.room.findUnique({
			where: { id: roomId },
			include: {
				building: {
					include: {
						owner: { select: { id: true, role: true } },
					},
				},
				roomInstances: {
					include: {
						rentals: {
							where: { status: { in: ['active', 'pending_renewal'] } },
							select: { id: true },
						},
					},
				},
			},
		});

		if (!room) {
			throw new NotFoundException('Room not found');
		}

		if (room.building.owner.id !== userId) {
			throw new ForbiddenException('Only building owner can delete room');
		}

		if (room.building.owner.role !== UserRole.landlord) {
			throw new ForbiddenException('Only landlords can delete rooms');
		}

		// Check if there are active rentals
		const hasActiveRentals = room.roomInstances.some((instance) => instance.rentals.length > 0);

		if (hasActiveRentals) {
			throw new BadRequestException(
				'Cannot delete room with active rentals. Please terminate all rentals first.',
			);
		}

		// Delete room (cascade will handle instances, pricing, amenities, costs, rules)
		await this.prisma.room.delete({
			where: { id: roomId },
		});
	}

	async findManyByBuilding(
		userId: string,
		buildingId: string,
		page: number = 1,
		limit: number = 10,
	): Promise<{
		rooms: RoomDetailOutputDto[];
		total: number;
		page: number;
		limit: number;
		totalPages: number;
	}> {
		// Verify building ownership
		const building = await this.prisma.building.findUnique({
			where: { id: buildingId },
			include: {
				owner: { select: { id: true, role: true } },
			},
		});

		if (!building) {
			throw new NotFoundException('Building not found');
		}

		if (building.owner.id !== userId) {
			throw new ForbiddenException('Only building owner can view rooms');
		}

		const skip = (page - 1) * limit;

		const [rooms, total] = await this.prisma.$transaction([
			this.prisma.room.findMany({
				where: { buildingId },
				include: {
					building: {
						include: {
							province: { select: { id: true, name: true, code: true } },
							district: { select: { id: true, name: true, code: true } },
							ward: { select: { id: true, name: true, code: true } },
							owner: {
								select: {
									id: true,
									firstName: true,
									lastName: true,
									avatarUrl: true,
									gender: true,
									phone: true,
									isVerifiedPhone: true,
									isVerifiedEmail: true,
									isVerifiedIdentity: true,
									overallRating: true,
									totalRatings: true,
								},
							},
						},
					},
					roomInstances: {
						select: {
							id: true,
							roomNumber: true,
							status: true,
							isActive: true,
						},
						where: { isActive: true },
						orderBy: { roomNumber: 'asc' },
					},
					images: {
						select: {
							id: true,
							imageUrl: true,
							altText: true,
							sortOrder: true,
							isPrimary: true,
						},
						orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
					},
					amenities: {
						select: {
							id: true,
							customValue: true,
							notes: true,
							amenity: {
								select: {
									id: true,
									name: true,
									nameEn: true,
									category: true,
								},
							},
						},
					},
					costs: {
						select: {
							id: true,
							fixedAmount: true,
							currency: true,
							notes: true,
							costTypeTemplate: {
								select: {
									id: true,
									name: true,
									nameEn: true,
									category: true,
									defaultUnit: true,
								},
							},
						},
					},
					pricing: {
						select: {
							id: true,
							basePriceMonthly: true,
							currency: true,
							depositAmount: true,
							depositMonths: true,
							utilityIncluded: true,
							utilityCostMonthly: true,
							minimumStayMonths: true,
							maximumStayMonths: true,
							priceNegotiable: true,
						},
					},
					rules: {
						select: {
							id: true,
							customValue: true,
							isEnforced: true,
							notes: true,
							ruleTemplate: {
								select: {
									id: true,
									ruleType: true,
									name: true,
									nameEn: true,
								},
							},
						},
					},
				},
				skip,
				take: limit,
				orderBy: { createdAt: 'desc' },
			}),
			this.prisma.room.count({
				where: { buildingId },
			}),
		]);

		// Get owner statistics (all rooms belong to the same owner)
		const ownerStats =
			rooms.length > 0
				? await getOwnerStats(this.prisma, rooms[0].buildingId)
				: { totalBuildings: 0, totalRoomInstances: 0 };

		return {
			rooms: rooms.map((room) => formatRoomDetail(room, true, ownerStats)), // Admin always authenticated
			total,
			page,
			limit,
			totalPages: Math.ceil(total / limit),
		};
	}

	async findMyRooms(
		userId: string,
		page: number = 1,
		limit: number = 10,
	): Promise<{
		rooms: RoomDetailOutputDto[];
		total: number;
		page: number;
		limit: number;
		totalPages: number;
	}> {
		const skip = (page - 1) * limit;

		const [rooms, total] = await this.prisma.$transaction([
			this.prisma.room.findMany({
				where: {
					building: {
						ownerId: userId,
					},
				},
				include: {
					building: {
						include: {
							province: { select: { id: true, name: true, code: true } },
							district: { select: { id: true, name: true, code: true } },
							ward: { select: { id: true, name: true, code: true } },
							owner: {
								select: {
									id: true,
									firstName: true,
									lastName: true,
									avatarUrl: true,
									gender: true,
									phone: true,
									isVerifiedPhone: true,
									isVerifiedEmail: true,
									isVerifiedIdentity: true,
									overallRating: true,
									totalRatings: true,
								},
							},
						},
					},
					roomInstances: {
						select: {
							id: true,
							roomNumber: true,
							status: true,
							isActive: true,
						},
						where: { isActive: true },
						orderBy: { roomNumber: 'asc' },
					},
					images: {
						select: {
							id: true,
							imageUrl: true,
							altText: true,
							sortOrder: true,
							isPrimary: true,
						},
						orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
					},
					amenities: {
						select: {
							id: true,
							customValue: true,
							notes: true,
							amenity: {
								select: {
									id: true,
									name: true,
									nameEn: true,
									category: true,
								},
							},
						},
					},
					costs: {
						select: {
							id: true,
							fixedAmount: true,
							currency: true,
							notes: true,
							costTypeTemplate: {
								select: {
									id: true,
									name: true,
									nameEn: true,
									category: true,
									defaultUnit: true,
								},
							},
						},
					},
					pricing: {
						select: {
							id: true,
							basePriceMonthly: true,
							currency: true,
							depositAmount: true,
							depositMonths: true,
							utilityIncluded: true,
							utilityCostMonthly: true,
							minimumStayMonths: true,
							maximumStayMonths: true,
							priceNegotiable: true,
						},
					},
					rules: {
						select: {
							id: true,
							customValue: true,
							isEnforced: true,
							notes: true,
							ruleTemplate: {
								select: {
									id: true,
									ruleType: true,
									name: true,
									nameEn: true,
								},
							},
						},
					},
				},
				skip,
				take: limit,
				orderBy: { createdAt: 'desc' },
			}),
			this.prisma.room.count({
				where: {
					building: {
						ownerId: userId,
					},
				},
			}),
		]);

		// Get owner statistics (userId is the owner for all rooms)
		const ownerStats = await getOwnerStats(this.prisma, userId);

		return {
			rooms: rooms.map((room) => formatRoomDetail(room, true, ownerStats)), // Admin always authenticated
			total,
			page,
			limit,
			totalPages: Math.ceil(total / limit),
		};
	}

	private async validateSystemReferencesForUpdate(updateRoomDto: UpdateRoomDto): Promise<void> {
		// Validate amenities
		if (updateRoomDto.amenities?.length) {
			const amenityIds = updateRoomDto.amenities
				.filter((a) => a.systemAmenityId)
				.map((a) => a.systemAmenityId!);

			if (amenityIds.length > 0) {
				const existingAmenities = await this.prisma.amenity.findMany({
					where: { id: { in: amenityIds }, isActive: true },
					select: { id: true },
				});

				if (existingAmenities.length !== amenityIds.length) {
					throw new BadRequestException('Some amenities not found or inactive');
				}
			}
		}

		// Validate cost types
		if (updateRoomDto.costs?.length) {
			const costTypeIds = updateRoomDto.costs
				.filter((c) => c.systemCostTypeId)
				.map((c) => c.systemCostTypeId!);

			if (costTypeIds.length > 0) {
				const existingCostTypes = await this.prisma.costTypeTemplate.findMany({
					where: { id: { in: costTypeIds }, isActive: true },
					select: { id: true },
				});

				if (existingCostTypes.length !== costTypeIds.length) {
					throw new BadRequestException('Some cost types not found or inactive');
				}
			}
		}

		// Validate rules
		if (updateRoomDto.rules?.length) {
			const ruleIds = updateRoomDto.rules.filter((r) => r.systemRuleId).map((r) => r.systemRuleId!);

			if (ruleIds.length > 0) {
				const existingRules = await this.prisma.roomRuleTemplate.findMany({
					where: { id: { in: ruleIds }, isActive: true },
					select: { id: true },
				});

				if (existingRules.length !== ruleIds.length) {
					throw new BadRequestException('Some rules not found or inactive');
				}
			}
		}
	}

	private generateAdditionalRoomNumbers(
		existingNumbers: string[],
		additionalCount: number,
	): string[] {
		const roomNumbers: string[] = [];

		// Parse existing numbers to find the highest number
		const numericNumbers = existingNumbers
			.map((num) => {
				const match = num.match(/\d+$/);
				return match ? parseInt(match[0], 10) : 0;
			})
			.filter((num) => !Number.isNaN(num));

		const maxNumber = numericNumbers.length > 0 ? Math.max(...numericNumbers) : 0;

		// Find prefix from first room number
		const firstNumber = existingNumbers[0] || '';
		const prefixMatch = firstNumber.match(/^[A-Za-z]*/);
		const prefix = prefixMatch ? prefixMatch[0] : '';

		// Generate new room numbers
		for (let i = 1; i <= additionalCount; i++) {
			const number = maxNumber + i;
			const roomNumber = prefix ? `${prefix}${number}` : number.toString();
			roomNumbers.push(roomNumber);
		}

		return roomNumbers;
	}

	async updateRoomInstanceStatus(
		userId: string,
		roomInstanceId: string,
		updateStatusDto: UpdateRoomInstanceStatusDto,
	): Promise<{ success: boolean; message: string }> {
		// Verify room instance ownership
		const roomInstance = await this.prisma.roomInstance.findUnique({
			where: { id: roomInstanceId },
			include: {
				room: {
					include: {
						building: {
							include: {
								owner: { select: { id: true, role: true } },
							},
						},
					},
				},
				rentals: {
					where: { status: { in: ['active', 'pending_renewal'] } },
					select: { id: true, status: true },
				},
			},
		});

		if (!roomInstance) {
			throw new NotFoundException('Room instance not found');
		}

		if (roomInstance.room.building.owner.id !== userId) {
			throw new ForbiddenException('Only building owner can update room instance status');
		}

		if (roomInstance.room.building.owner.role !== UserRole.landlord) {
			throw new ForbiddenException('Only landlords can update room instance status');
		}

		// Business logic validation
		await this.validateStatusTransition(
			roomInstance.status,
			updateStatusDto.status,
			roomInstance.rentals.length > 0,
		);

		// Update room instance status
		await this.prisma.roomInstance.update({
			where: { id: roomInstanceId },
			data: {
				status: updateStatusDto.status,
				notes: updateStatusDto.reason,
			},
		});

		return {
			success: true,
			message: `Room instance status updated to ${updateStatusDto.status}`,
		};
	}

	async bulkUpdateRoomInstanceStatus(
		userId: string,
		roomId: string,
		bulkUpdateDto: BulkUpdateRoomInstanceStatusDto,
	): Promise<{ success: boolean; message: string; updatedCount: number }> {
		// Verify room ownership
		const room = await this.prisma.room.findUnique({
			where: { id: roomId },
			include: {
				building: {
					include: {
						owner: { select: { id: true, role: true } },
					},
				},
				roomInstances: {
					where: {
						id: { in: bulkUpdateDto.roomInstanceIds },
					},
					include: {
						rentals: {
							where: { status: { in: ['active', 'pending_renewal'] } },
							select: { id: true, status: true },
						},
					},
				},
			},
		});

		if (!room) {
			throw new NotFoundException('Room not found');
		}

		if (room.building.owner.id !== userId) {
			throw new ForbiddenException('Only building owner can update room instance status');
		}

		if (room.building.owner.role !== UserRole.landlord) {
			throw new ForbiddenException('Only landlords can update room instance status');
		}

		// Check if all requested instances belong to this room
		if (room.roomInstances.length !== bulkUpdateDto.roomInstanceIds.length) {
			throw new BadRequestException('Some room instances not found or do not belong to this room');
		}

		// Validate status transitions for all instances
		const validationPromises = room.roomInstances.map((instance) =>
			this.validateStatusTransition(
				instance.status,
				bulkUpdateDto.status,
				instance.rentals.length > 0,
			),
		);

		await Promise.all(validationPromises);

		// Update all room instances in transaction
		const updatedCount = await this.prisma.$transaction(async (tx) => {
			const result = await tx.roomInstance.updateMany({
				where: {
					id: { in: bulkUpdateDto.roomInstanceIds },
				},
				data: {
					status: bulkUpdateDto.status,
					notes: bulkUpdateDto.reason,
				},
			});

			return result.count;
		});

		return {
			success: true,
			message: `${updatedCount} room instances updated to ${bulkUpdateDto.status}`,
			updatedCount,
		};
	}

	async getRoomInstancesByStatus(
		userId: string,
		roomId: string,
		status?: string,
	): Promise<{
		instances: Array<{
			id: string;
			roomNumber: string;
			status: string;
			notes?: string;
			updatedAt: Date;
			isActive: boolean;
		}>;
		statusCounts: Record<string, number>;
	}> {
		// Verify room ownership
		const room = await this.prisma.room.findUnique({
			where: { id: roomId },
			include: {
				building: {
					include: {
						owner: { select: { id: true, role: true } },
					},
				},
			},
		});

		if (!room) {
			throw new NotFoundException('Room not found');
		}

		if (room.building.owner.id !== userId) {
			throw new ForbiddenException('Only building owner can view room instances');
		}

		// Get room instances with optional status filter
		const instances = await this.prisma.roomInstance.findMany({
			where: {
				roomId,
				...(status && { status: status as any }),
			},
			select: {
				id: true,
				roomNumber: true,
				status: true,
				notes: true,
				updatedAt: true,
				isActive: true,
			},
			orderBy: { roomNumber: 'asc' },
		});

		// Get status counts
		const statusCounts = await this.prisma.roomInstance.groupBy({
			by: ['status'],
			where: { roomId },
			_count: { status: true },
		});

		const statusCountsMap = statusCounts.reduce(
			(acc, item) => {
				acc[item.status] = item._count.status;
				return acc;
			},
			{} as Record<string, number>,
		);

		return {
			instances,
			statusCounts: statusCountsMap,
		};
	}

	private async validateStatusTransition(
		currentStatus: string,
		newStatus: string,
		hasActiveRentals: boolean,
	): Promise<void> {
		// If status is not changing, allow it
		if (currentStatus === newStatus) {
			return;
		}

		// Business rules for status transitions
		switch (newStatus) {
			case 'occupied':
				if (currentStatus !== 'available' && currentStatus !== 'reserved') {
					throw new BadRequestException(
						`Cannot change status from ${currentStatus} to occupied. Room must be available or reserved.`,
					);
				}
				break;

			case 'available':
				if (hasActiveRentals) {
					throw new BadRequestException(
						'Cannot set room to available while there are active rentals. Please terminate rentals first.',
					);
				}
				break;

			case 'maintenance':
				if (hasActiveRentals && currentStatus === 'occupied') {
					throw new BadRequestException(
						'Cannot set occupied room to maintenance while there are active rentals. Please relocate tenants first.',
					);
				}
				break;

			case 'reserved':
				if (currentStatus !== 'available') {
					throw new BadRequestException(
						`Cannot reserve room with status ${currentStatus}. Room must be available.`,
					);
				}
				break;

			case 'unavailable':
				// Can always set to unavailable, but warn if there are active rentals
				if (hasActiveRentals) {
					// This is allowed but should be logged/monitored
					console.warn(
						`Setting room to unavailable while there are active rentals. This may affect tenant experience.`,
					);
				}
				break;

			default:
				throw new BadRequestException(`Invalid room status: ${newStatus}`);
		}
	}
}
