import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from './../src/app.module';
import {
  UserRole,
  UserStatus,
  BusinessStatus,
  OfferStatus,
  OfferType,
  DiscountType,
} from './../src/common/enums';
import { User } from './../src/modules/users/entities/user.entity';
import { Business } from './../src/modules/businesses/entities/business.entity';
import { BusinessCategory } from './../src/modules/businesses/entities/business-category.entity';
import { Offer } from './../src/modules/offers/entities/offer.entity';
import { MediaFile } from './../src/modules/media/entities/media-file.entity';
import { FirebaseService } from './../src/common/firebase/firebase.service';

describe('OffersController (e2e)', () => {
  let app: INestApplication<App>;
  let userRepository: Repository<User>;
  let businessRepository: Repository<Business>;
  let categoryRepository: Repository<BusinessCategory>;
  let offerRepository: Repository<Offer>;
  let mediaRepository: Repository<MediaFile>;
  let jwtService: JwtService;

  let memberToken: string;
  let adminToken: string;
  let customerToken: string;

  let memberId: string;
  let adminId: string;
  let businessId: string;
  let categoryId: string;
  let createdOfferId: string;

  const testPhones = ['9555000001', '9555000002', '9555000003'];

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
        const businesses = await businessRepository?.find({
          where: { owner_id: user.id },
        });
        if (businesses && businesses.length > 0) {
          for (const b of businesses) {
            await offerRepository?.delete({ business_id: b.id });
          }
        }
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
    offerRepository = moduleFixture.get<Repository<Offer>>(
      getRepositoryToken(Offer),
    );
    mediaRepository = moduleFixture.get<Repository<MediaFile>>(
      getRepositoryToken(MediaFile),
    );
    jwtService = moduleFixture.get<JwtService>(JwtService);

    await cleanup();

    // Create Category
    let category = await categoryRepository.findOne({
      where: { slug: 'offers-test-category' },
    });
    if (!category) {
      category = categoryRepository.create({
        name: 'Offers Test Category',
        slug: 'offers-test-category',
        description: 'Category for offer tests',
      });
      await categoryRepository.save(category);
    }
    categoryId = category.id;

    const secret = process.env.JWT_ACCESS_SECRET || 'bizz_deal_access_secret';

    // Create Member
    const member = userRepository.create({
      full_name: 'Offer Member',
      phone: testPhones[0],
      pin_hash: 'hashed',
      role: UserRole.MEMBER,
      status: UserStatus.ACTIVE,
    });
    await userRepository.save(member);
    memberId = member.id;
    memberToken = await jwtService.signAsync(
      { sub: member.id, phone: member.phone, role: member.role },
      { secret },
    );

    // Create Business for Member
    const business = businessRepository.create({
      owner_id: memberId,
      category_id: categoryId,
      name: 'Offers Deals Store',
      status: BusinessStatus.ACTIVE,
    });
    await businessRepository.save(business);
    businessId = business.id;

    // Create Admin
    const admin = userRepository.create({
      full_name: 'Offer Admin',
      phone: testPhones[1],
      pin_hash: 'hashed',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    });
    await userRepository.save(admin);
    adminId = admin.id;
    adminToken = await jwtService.signAsync(
      { sub: admin.id, phone: admin.phone, role: admin.role },
      { secret },
    );

    // Create Customer
    const customer = userRepository.create({
      full_name: 'Offer Customer',
      phone: testPhones[2],
      pin_hash: 'hashed',
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
    });
    await userRepository.save(customer);
    customerToken = await jwtService.signAsync(
      { sub: customer.id, phone: customer.phone, role: customer.role },
      { secret },
    );
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('POST /offers - Member creates offer (should start PENDING)', async () => {
    const res = await request(app.getHttpServer())
      .post('/offers')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        business_id: businessId,
        title: 'Summer Mega Sale',
        description: 'Get flat 30% off on apparel',
        offer_type: OfferType.DISCOUNT,
        discount_value: 30,
        discount_type: DiscountType.PERCENTAGE,
        start_date: new Date(Date.now() - 3600000).toISOString(),
        end_date: new Date(Date.now() + 86400000).toISOString(),
      });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Summer Mega Sale');
    expect(res.body.status).toBe(OfferStatus.PENDING);
    createdOfferId = res.body.id;
  });

  it('GET /offers - Customer should not see PENDING offer', async () => {
    const res = await request(app.getHttpServer())
      .get('/offers')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    const found = res.body.find((o: any) => o.id === createdOfferId);
    expect(found).toBeUndefined();
  });

  it('GET /offers - Member sees own PENDING offer', async () => {
    const res = await request(app.getHttpServer())
      .get('/offers')
      .set('Authorization', `Bearer ${memberToken}`);

    expect(res.status).toBe(200);
    const found = res.body.find((o: any) => o.id === createdOfferId);
    expect(found).toBeDefined();
    expect(found.status).toBe(OfferStatus.PENDING);
  });

  it('PUT /offers/approve - Admin approves offer', async () => {
    const res = await request(app.getHttpServer())
      .put('/offers/approve')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        offer_id: createdOfferId,
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe(OfferStatus.APPROVED);
    expect(res.body.approved_by_id).toBe(adminId);
  });

  it('GET /offers - Customer should now see APPROVED offer', async () => {
    const res = await request(app.getHttpServer())
      .get('/offers')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    const found = res.body.find((o: any) => o.id === createdOfferId);
    expect(found).toBeDefined();
    expect(found.status).toBe(OfferStatus.APPROVED);
  });

  it('GET /offers/business/:businessId - Retrieves offers by business ID (Admin Only)', async () => {
    const resForbidden = await request(app.getHttpServer())
      .get(`/offers/business/${businessId}`)
      .set('Authorization', `Bearer ${memberToken}`);
    expect(resForbidden.status).toBe(403);

    const res = await request(app.getHttpServer())
      .get(`/offers/business/${businessId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const found = res.body.find((o: any) => o.id === createdOfferId);
    expect(found).toBeDefined();
  });

  it('PUT /offers/:id - Member edits APPROVED offer -> should reset status to PENDING', async () => {
    const res = await request(app.getHttpServer())
      .put(`/offers/${createdOfferId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        title: 'Summer Mega Sale Updated',
      });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Summer Mega Sale Updated');
    expect(res.body.status).toBe(OfferStatus.PENDING);
  });
});
