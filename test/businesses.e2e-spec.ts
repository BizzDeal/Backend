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
import { BusinessProfile } from './../src/modules/businesses/entities/business-profile.entity';
import { BusinessCategory } from './../src/modules/businesses/entities/business-category.entity';
import { MediaFile } from './../src/modules/media/entities/media-file.entity';
import { FirebaseService } from './../src/common/firebase/firebase.service';

describe('BusinessesController (e2e)', () => {
  let app: INestApplication<App>;
  let userRepository: Repository<User>;
  let businessRepository: Repository<BusinessProfile>;
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

  const testPhones = ['9777000001', '9777000002', '9777000003', '9777000004'];

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
    businessRepository = moduleFixture.get<Repository<BusinessProfile>>(
      getRepositoryToken(BusinessProfile),
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
        email: 'active@bizzdeal.com',
        pin_hash: 'hash',
        role: UserRole.MEMBER,
        status: UserStatus.ACTIVE,
      }),
    );
    activeMemberId = activeMember.id;
    activeMemberToken = await jwtService.signAsync(
      {
        sub: activeMember.id,
        phone: activeMember.phone,
        role: activeMember.role,
      },
      { secret: process.env.JWT_ACCESS_SECRET || 'bizz_deal_access_secret' },
    );

    // Create Pending Member
    const pendingMember = await userRepository.save(
      userRepository.create({
        full_name: 'Pending Entrepreneur',
        phone: '9777000002',
        email: 'pending@bizzdeal.com',
        pin_hash: 'hash',
        role: UserRole.MEMBER,
        status: UserStatus.PENDING,
      }),
    );
    pendingMemberToken = await jwtService.signAsync(
      {
        sub: pendingMember.id,
        phone: pendingMember.phone,
        role: pendingMember.role,
      },
      { secret: process.env.JWT_ACCESS_SECRET || 'bizz_deal_access_secret' },
    );

    // Create Admin
    const admin = await userRepository.save(
      userRepository.create({
        full_name: 'Platform Admin',
        phone: '9777000003',
        email: 'admin@bizzdeal.com',
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
        email: 'other@bizzdeal.com',
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

    it('should enforce only one featured store per category', async () => {
      let category2 = await categoryRepository.findOne({
        where: { slug: 'e2e-business-cat-2' },
      });
      if (!category2) {
        category2 = await categoryRepository.save(
          categoryRepository.create({
            name: 'E2E Category 2',
            slug: 'e2e-business-cat-2',
            description: 'Second Category',
            is_active: true,
          }),
        );
      }

      const tempUser1 = await userRepository.save(
        userRepository.create({
          full_name: 'Temp Member 1',
          phone: '9777000011',
          email: 'temp1@bizzdeal.com',
          pin_hash: 'hash',
          role: UserRole.MEMBER,
          status: UserStatus.ACTIVE,
        }),
      );

      const tempUser2 = await userRepository.save(
        userRepository.create({
          full_name: 'Temp Member 2',
          phone: '9777000012',
          email: 'temp2@bizzdeal.com',
          pin_hash: 'hash',
          role: UserRole.MEMBER,
          status: UserStatus.ACTIVE,
        }),
      );

      const bizCat2 = await businessRepository.save(
        businessRepository.create({
          owner_id: tempUser1.id,
          category_id: category2.id,
          name: 'Cat 2 Business',
          status: BusinessStatus.ACTIVE,
          is_featured: false,
        }),
      );

      const bizCat1Second = await businessRepository.save(
        businessRepository.create({
          owner_id: tempUser2.id,
          category_id: categoryId,
          name: 'Cat 1 Second Business',
          status: BusinessStatus.ACTIVE,
          is_featured: false,
        }),
      );

      // Feature biz in Category 2 -> should be featured, while createdBusinessId (in Category 1) remains featured
      await request(app.getHttpServer())
        .put('/businesses/feature')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ businessId: bizCat2.id, is_featured: true })
        .expect(200);

      const b1 = await businessRepository.findOne({ where: { id: createdBusinessId } });
      const b2 = await businessRepository.findOne({ where: { id: bizCat2.id } });
      expect(b1?.is_featured).toBe(true);
      expect(b2?.is_featured).toBe(true);

      // Feature bizCat1Second in Category 1 -> should unfeature createdBusinessId (in Category 1), while bizCat2 remains featured
      await request(app.getHttpServer())
        .put('/businesses/feature')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ businessId: bizCat1Second.id, is_featured: true })
        .expect(200);

      const b1After = await businessRepository.findOne({ where: { id: createdBusinessId } });
      const b3After = await businessRepository.findOne({ where: { id: bizCat1Second.id } });
      const b2After = await businessRepository.findOne({ where: { id: bizCat2.id } });

      expect(b1After?.is_featured).toBe(false);
      expect(b3After?.is_featured).toBe(true);
      expect(b2After?.is_featured).toBe(true);

      // Restore createdBusinessId as featured for subsequent tests
      await businessRepository.update(createdBusinessId, { is_featured: true });

      // Clean up extra created businesses and users
      await businessRepository.delete([bizCat2.id, bizCat1Second.id]);
      await userRepository.delete([tempUser1.id, tempUser2.id]);
      await categoryRepository.delete(category2.id);
    });
  });

  describe('GET /businesses/featured & /businesses/search', () => {
    it('should return our active featured listing in GET /businesses/featured without pagination', async () => {
      const res = await request(app.getHttpServer())
        .get('/businesses/featured')
        .expect(200);

      expect(res.body.pagination).toBeUndefined();
      expect(res.body.data.some((b: any) => b.id === createdBusinessId)).toBe(
        true,
      );
    });

    it('should find our listing via search keyword matching business name', async () => {
      const res = await request(app.getHttpServer())
        .get('/businesses/search?q=Enterprise')
        .expect(200);

      expect(res.body.data.some((b: any) => b.id === createdBusinessId)).toBe(
        true,
      );
    });

    it('should find our listing via search keyword matching owner phone', async () => {
      const res = await request(app.getHttpServer())
        .get('/businesses/search?q=9777000001')
        .expect(200);

      expect(res.body.data.some((b: any) => b.id === createdBusinessId)).toBe(
        true,
      );
    });

    it('should find our listing via search keyword matching GST number', async () => {
      const res = await request(app.getHttpServer())
        .get('/businesses/search?q=27AADCB2230M1Z3')
        .expect(200);

      expect(res.body.data.some((b: any) => b.id === createdBusinessId)).toBe(
        true,
      );
    });

    it('should find our listing using explicit field filter (phone)', async () => {
      const res = await request(app.getHttpServer())
        .get('/businesses/search?phone=9777000001')
        .expect(200);

      expect(res.body.data.some((b: any) => b.id === createdBusinessId)).toBe(
        true,
      );
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
