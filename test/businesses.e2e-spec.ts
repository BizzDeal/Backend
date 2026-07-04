import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from './../src/app.module';
import { UserRole, UserStatus, BusinessStatus } from './../src/common/enums';
import { User } from './../src/modules/users/entities/user.entity';
import { Business } from './../src/modules/businesses/entities/business.entity';
import { BusinessCategory } from './../src/modules/businesses/entities/business-category.entity';
import { MediaFile } from './../src/modules/media/entities/media-file.entity';
import { FirebaseService } from './../src/common/firebase/firebase.service';

describe('BusinessesController (e2e)', () => {
  let app: INestApplication<App>;
  let userRepository: Repository<User>;
  let businessRepository: Repository<Business>;
  let categoryRepository: Repository<BusinessCategory>;
  let mediaRepository: Repository<MediaFile>;
  let jwtService: JwtService;

  let activeMemberToken: string;
  let pendingMemberToken: string;
  let adminToken: string;
  let otherMemberToken: string;

  let activeMemberId: string;
  let categoryId: string;
  let createdBusinessId: string;

  const testPhones = [
    '9777000001',
    '9777000002',
    '9777000003',
    '9777000004',
  ];

  const mockFirebaseService = {
    verifyPhoneToken: jest.fn(),
    getAuth: jest.fn(),
    getBucket: jest.fn().mockReturnValue({
      name: 'bizzdeal.firebasestorage.app',
      file: jest.fn().mockReturnValue({
        save: jest.fn().mockResolvedValue(undefined),
        makePublic: jest.fn().mockResolvedValue(undefined),
        delete: jest.fn().mockResolvedValue(undefined),
      }),
    }),
  };

  async function cleanup() {
    if (!userRepository) return;
    for (const phone of testPhones) {
      const user = await userRepository.findOne({ where: { phone } });
      if (user) {
        await mediaRepository?.delete({ uploaded_by_id: user.id });
        await businessRepository?.delete({ owner_id: user.id });
        await userRepository.delete({ id: user.id });
      }
    }
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(FirebaseService)
      .useValue(mockFirebaseService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    userRepository = moduleFixture.get<Repository<User>>(
      getRepositoryToken(User),
    );
    businessRepository = moduleFixture.get<Repository<Business>>(
      getRepositoryToken(Business),
    );
    categoryRepository = moduleFixture.get<Repository<BusinessCategory>>(
      getRepositoryToken(BusinessCategory),
    );
    mediaRepository = moduleFixture.get<Repository<MediaFile>>(
      getRepositoryToken(MediaFile),
    );
    jwtService = moduleFixture.get<JwtService>(JwtService);

    await cleanup();

    // Ensure category exists
    let category = await categoryRepository.findOne({
      where: { slug: 'e2e-business-cat' },
    });
    if (!category) {
      category = await categoryRepository.save(
        categoryRepository.create({
          name: 'E2E Business Category',
          slug: 'e2e-business-cat',
          description: 'Category for E2E tests',
          is_active: true,
        }),
      );
    }
    categoryId = category.id;

    // Create Active Member
    const activeMember = await userRepository.save(
      userRepository.create({
        full_name: 'Active Entrepreneur',
        phone: '9777000001',
        pin_hash: 'hash',
        role: UserRole.MEMBER,
        status: UserStatus.ACTIVE,
      }),
    );
    activeMemberId = activeMember.id;
    activeMemberToken = await jwtService.signAsync(
      { sub: activeMember.id, phone: activeMember.phone, role: activeMember.role },
      { secret: process.env.JWT_ACCESS_SECRET || 'bizz_deal_access_secret' },
    );

    // Create Pending Member
    const pendingMember = await userRepository.save(
      userRepository.create({
        full_name: 'Pending Entrepreneur',
        phone: '9777000002',
        pin_hash: 'hash',
        role: UserRole.MEMBER,
        status: UserStatus.PENDING,
      }),
    );
    pendingMemberToken = await jwtService.signAsync(
      { sub: pendingMember.id, phone: pendingMember.phone, role: pendingMember.role },
      { secret: process.env.JWT_ACCESS_SECRET || 'bizz_deal_access_secret' },
    );

    // Create Admin
    const admin = await userRepository.save(
      userRepository.create({
        full_name: 'Platform Admin',
        phone: '9777000003',
        pin_hash: 'hash',
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
      }),
    );
    adminToken = await jwtService.signAsync(
      { sub: admin.id, phone: admin.phone, role: admin.role },
      { secret: process.env.JWT_ACCESS_SECRET || 'bizz_deal_access_secret' },
    );

    // Create Other Member
    const otherMember = await userRepository.save(
      userRepository.create({
        full_name: 'Other Entrepreneur',
        phone: '9777000004',
        pin_hash: 'hash',
        role: UserRole.MEMBER,
        status: UserStatus.ACTIVE,
      }),
    );
    otherMemberToken = await jwtService.signAsync(
      { sub: otherMember.id, phone: otherMember.phone, role: otherMember.role },
      { secret: process.env.JWT_ACCESS_SECRET || 'bizz_deal_access_secret' },
    );

    const business = await businessRepository.save(
      businessRepository.create({
        owner_id: activeMember.id,
        category_id: categoryId,
        name: 'Active Enterprise',
        description: 'High tech enterprise software solutions',
        website: 'https://activeenterprise.com',
        gst_number: '27AADCB2230M1Z3',
        status: BusinessStatus.PENDING,
      }),
    );
    createdBusinessId = business.id;
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  describe('GET /businesses/categories', () => {
    it('should retrieve list of business categories', async () => {
      const res = await request(app.getHttpServer())
        .get('/businesses/categories')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });


  describe('GET /businesses/:id and GET /businesses', () => {
    it('should allow owner to view their pending business profile', async () => {
      const res = await request(app.getHttpServer())
        .get(`/businesses/${createdBusinessId}`)
        .set('Authorization', `Bearer ${activeMemberToken}`)
        .expect(200);

      expect(res.body.data.id).toBe(createdBusinessId);
    });

    it('should forbid public unauthenticated visitors from viewing non-active listing', async () => {
      await request(app.getHttpServer())
        .get(`/businesses/${createdBusinessId}`)
        .expect(403);
    });
  });

  describe('PUT /businesses/:id', () => {
    it('should forbid non-owner member from updating someone elses business', async () => {
      await request(app.getHttpServer())
        .put(`/businesses/${createdBusinessId}`)
        .set('Authorization', `Bearer ${otherMemberToken}`)
        .send({ name: 'Hacked Name' })
        .expect(403);
    });

    it('should allow Admin to update a business listing via PUT /businesses/:id without resetting status', async () => {
      const res = await request(app.getHttpServer())
        .put(`/businesses/${createdBusinessId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Admin Updated Name' })
        .expect(200);

      expect(res.body.data.name).toBe('Admin Updated Name');
    });

    it('should allow listing owner to update regular fields and reset status to PENDING', async () => {
      const res = await request(app.getHttpServer())
        .put(`/businesses/${createdBusinessId}`)
        .set('Authorization', `Bearer ${activeMemberToken}`)
        .send({ name: 'Active Enterprise Updated' })
        .expect(200);

      expect(res.body.data.name).toBe('Active Enterprise Updated');
      expect(res.body.data.status).toBe(BusinessStatus.PENDING);
    });
  });

  describe('PUT /businesses/feature', () => {
    it('should forbid non-admin from featuring a business', async () => {
      await request(app.getHttpServer())
        .put('/businesses/feature')
        .set('Authorization', `Bearer ${activeMemberToken}`)
        .send({
          businessId: createdBusinessId,
          is_featured: true,
        })
        .expect(403);
    });

    it('should allow Admin to feature a business (and activate business via approve-member)', async () => {
      // Admin activates member and business via dedicated approve-member API
      await request(app.getHttpServer())
        .put('/users/approve-member')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ memberId: activeMemberId })
        .expect(200);

      // Admin features the business via dedicated feature API
      const res = await request(app.getHttpServer())
        .put('/businesses/feature')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          businessId: createdBusinessId,
          is_featured: true,
        })
        .expect(200);

      expect(res.body.data.status).toBe(BusinessStatus.ACTIVE);
      expect(res.body.data.is_featured).toBe(true);
    });
  });

  describe('GET /businesses/featured & /businesses/search', () => {
    it('should return our active featured listing in GET /businesses/featured without pagination', async () => {
      const res = await request(app.getHttpServer())
        .get('/businesses/featured')
        .expect(200);

      expect(res.body.pagination).toBeUndefined();
      expect(res.body.data.some((b: any) => b.id === createdBusinessId)).toBe(true);
    });

    it('should find our listing via search keyword matching business name', async () => {
      const res = await request(app.getHttpServer())
        .get('/businesses/search?q=Enterprise')
        .expect(200);

      expect(res.body.data.some((b: any) => b.id === createdBusinessId)).toBe(true);
    });

    it('should find our listing via search keyword matching owner phone', async () => {
      const res = await request(app.getHttpServer())
        .get('/businesses/search?q=9777000001')
        .expect(200);

      expect(res.body.data.some((b: any) => b.id === createdBusinessId)).toBe(true);
    });

    it('should find our listing via search keyword matching GST number', async () => {
      const res = await request(app.getHttpServer())
        .get('/businesses/search?q=27AADCB2230M1Z3')
        .expect(200);

      expect(res.body.data.some((b: any) => b.id === createdBusinessId)).toBe(true);
    });

    it('should find our listing using explicit field filter (phone)', async () => {
      const res = await request(app.getHttpServer())
        .get('/businesses/search?phone=9777000001')
        .expect(200);

      expect(res.body.data.some((b: any) => b.id === createdBusinessId)).toBe(true);
    });
  });

  describe('DELETE /businesses/:id', () => {
    it('should forbid non-owner from deleting listing', async () => {
      await request(app.getHttpServer())
        .delete(`/businesses/${createdBusinessId}`)
        .set('Authorization', `Bearer ${otherMemberToken}`)
        .expect(403);
    });

    it('should allow owner to delete their listing', async () => {
      await request(app.getHttpServer())
        .delete(`/businesses/${createdBusinessId}`)
        .set('Authorization', `Bearer ${activeMemberToken}`)
        .expect(200);
    });
  });
});
