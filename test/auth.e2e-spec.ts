import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppModule } from './../src/app.module';
import { FirebaseService } from './../src/common/firebase/firebase.service';
import { UserRole, UserStatus, MediaPurpose, ReferralStatus } from './../src/common/enums';
import { User } from './../src/modules/users/entities/user.entity';
import { RefreshToken } from './../src/modules/auth/entities/refresh-token.entity';
import { Business } from './../src/modules/businesses/entities/business.entity';
import { BusinessCategory } from './../src/modules/businesses/entities/business-category.entity';
import { MediaFile } from './../src/modules/media/entities/media-file.entity';
import { State } from './../src/modules/location/entities/state.entity';
import { District } from './../src/modules/location/entities/district.entity';
import { StateType } from './../src/modules/location/enums/location.enum';
import { Referral } from './../src/modules/referrals/entities/referral.entity';

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;
  let userRepository: Repository<User>;
  let refreshTokenRepository: Repository<RefreshToken>;
  let businessRepository: Repository<Business>;
  let categoryRepository: Repository<BusinessCategory>;
  let mediaRepository: Repository<MediaFile>;
  let stateRepository: Repository<State>;
  let districtRepository: Repository<District>;
  let referralRepository: Repository<Referral>;
  let testCategoryId: string;
  let testStateId: string;
  let testDistrictId: string;

  const mockFirebaseService = {
    verifyPhoneToken: jest.fn().mockImplementation((idToken: string) => {
      if (idToken === 'valid-firebase-token-1')
        return Promise.resolve('9999000001');
      if (idToken === 'valid-firebase-token-4')
        return Promise.resolve('9999000004');
      if (idToken === 'valid-firebase-token-6')
        return Promise.resolve('9999000006');
      if (idToken === 'valid-firebase-token-7')
        return Promise.resolve('9999000007');
      if (idToken === 'valid-firebase-token-11')
        return Promise.resolve('9999000011');
      if (idToken === 'valid-firebase-token-12')
        return Promise.resolve('9999000012');
      return Promise.reject(new Error('Invalid Firebase token'));
    }),
    getAuth: jest.fn(),
    getBucket: jest.fn().mockReturnValue({
      name: 'bizzdeal.firebasestorage.app',
      file: jest.fn().mockReturnValue({
        save: jest.fn().mockResolvedValue(undefined),
        makePublic: jest.fn().mockResolvedValue(undefined),
      }),
    }),
  };

  const testPhones = [
    '9999000001',
    '9999000002',
    '9999000003',
    '9999000004',
    '9999000005',
    '9999000006',
    '9999000007',
    '9999000010',
    '9999000011',
    '9999000012',
  ];

  async function cleanup() {
    if (!userRepository) return;
    for (const phone of testPhones) {
      await referralRepository?.delete({ referred_phone: phone });
      const user = await userRepository.findOne({ where: { phone } });
      if (user) {
        await referralRepository?.delete({ referrer_id: user.id });
        await mediaRepository?.delete({ uploaded_by_id: user.id });
        await businessRepository.delete({ owner_id: user.id });
        await refreshTokenRepository.delete({ user_id: user.id });
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
    refreshTokenRepository = moduleFixture.get<Repository<RefreshToken>>(
      getRepositoryToken(RefreshToken),
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
    stateRepository = moduleFixture.get<Repository<State>>(
      getRepositoryToken(State),
    );
    districtRepository = moduleFixture.get<Repository<District>>(
      getRepositoryToken(District),
    );
    referralRepository = moduleFixture.get<Repository<Referral>>(
      getRepositoryToken(Referral),
    );

    let category = await categoryRepository.findOne({
      where: { slug: 'it-services' },
    });
    if (!category) {
      category = categoryRepository.create({
        name: 'IT Services',
        slug: 'it-services',
        description: 'Information Technology',
        is_active: true,
      });
      await categoryRepository.save(category);
    }
    testCategoryId = category.id;

    let state = await stateRepository.findOne({
      where: { name: 'Test State' },
    });
    if (!state) {
      state = stateRepository.create({
        name: 'Test State',
        lgdCode: 'S99',
        type: StateType.STATE,
      });
      await stateRepository.save(state);
    }
    testStateId = state.id;

    let district = await districtRepository.findOne({
      where: { name: 'Test District' },
    });
    if (!district) {
      district = districtRepository.create({
        name: 'Test District',
        lgdCode: 'D999',
        stateId: testStateId,
      });
      await districtRepository.save(district);
    }
    testDistrictId = district.id;

    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  describe('POST /auth/register-customer', () => {
    it('should register a customer successfully when given a valid firebaseToken matching the phone', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register-customer')
        .send({
          full_name: 'Test Customer',
          phone: '9999000001',
          pin: '1234',
          whatsapp: '9999000001',
          email: 'customer@test.com',
          address: '123 Customer Rd, Hyderabad',
          firebaseToken: 'valid-firebase-token-1',
        })
        .expect(201);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.user).toBeDefined();
      expect(res.body.user.phone).toBe('9999000001');
      expect(res.body.user.whatsapp).toBe('9999000001');
      expect(res.body.user.address).toBe('123 Customer Rd, Hyderabad');
      expect(res.body.user.role).toBe(UserRole.CUSTOMER);
      expect(res.body.user.status).toBe(UserStatus.ACTIVE);
      expect(res.body.user.pin_hash).toBeUndefined();
    });

    it('should return 400 when trying to register without firebaseToken', async () => {
      await request(app.getHttpServer())
        .post('/auth/register-customer')
        .send({
          full_name: 'Unverified Customer',
          phone: '9999000003',
          pin: '1234',
        })
        .expect(400);
    });

    it('should return 409 when registering with an already registered phone number', async () => {
      await request(app.getHttpServer())
        .post('/auth/register-customer')
        .send({
          full_name: 'Duplicate Customer',
          phone: '9999000001',
          pin: '1234',
          whatsapp: '9999000001',
          email: 'dup.customer@test.com',
          address: '123 Duplicate Rd, Hyderabad',
          firebaseToken: 'valid-firebase-token-1',
        })
        .expect(409);
    });
  });

  describe('POST /auth/register-admin', () => {
    it('should register an admin successfully when given a valid firebaseToken matching the phone', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register-admin')
        .send({
          full_name: 'Test Admin',
          phone: '9999000007',
          pin: '1234',
          whatsapp: '9999000007',
          email: 'admin@test.com',
          address: '101 Admin Blvd, Hyderabad',
          firebaseToken: 'valid-firebase-token-7',
        })
        .expect(201);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.user).toBeDefined();
      expect(res.body.user.phone).toBe('9999000007');
      expect(res.body.user.whatsapp).toBe('9999000007');
      expect(res.body.user.address).toBe('101 Admin Blvd, Hyderabad');
      expect(res.body.user.role).toBe(UserRole.ADMIN);
      expect(res.body.user.status).toBe(UserStatus.ACTIVE);
      expect(res.body.user.pin_hash).toBeUndefined();
    });

    it('should return 400 when trying to register admin without firebaseToken', async () => {
      await request(app.getHttpServer())
        .post('/auth/register-admin')
        .send({
          full_name: 'Unverified Admin',
          phone: '9999000003',
          pin: '1234',
        })
        .expect(400);
    });

    it('should return 409 when registering admin with an already registered phone number', async () => {
      await request(app.getHttpServer())
        .post('/auth/register-admin')
        .send({
          full_name: 'Duplicate Admin',
          phone: '9999000007',
          pin: '1234',
          whatsapp: '9999000007',
          email: 'dup.admin@test.com',
          address: '101 Duplicate Blvd, Hyderabad',
          firebaseToken: 'valid-firebase-token-7',
        })
        .expect(409);
    });
  });

  describe('POST /auth/register-member', () => {
    it('should register a member successfully with status PENDING when given valid firebaseToken', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register-member')
        .field('full_name', 'Test Entrepreneur')
        .field('phone', '9999000004')
        .field('pin', '5678')
        .field('whatsapp', '9999000004')
        .field('email', 'test.entrepreneur@example.com')
        .field('address', '123 Entrepreneur Way, Hyderabad')
        .field('state_id', testStateId)
        .field('district_id', testDistrictId)
        .field('business_name', 'Test Business Enterprise')
        .field('category_id', testCategoryId)
        .field(
          'business_description',
          'Providing best IT services and consulting',
        )
        .field('website', 'https://testenterprise.com')
        .field('gst_number', '36AAAAA0000A1Z5')
        .field('firebaseToken', 'valid-firebase-token-4')
        .attach('payment_receipt', Buffer.from('fake receipt'), 'receipt.pdf');

      expect(res.status).toBe(201);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.user.phone).toBe('9999000004');
      expect(res.body.user.role).toBe(UserRole.MEMBER);
      expect(res.body.user.status).toBe(UserStatus.PENDING);
    });

    it('should return 409 when registering a member with an existing phone number', async () => {
      await request(app.getHttpServer())
        .post('/auth/register-member')
        .field('full_name', 'Duplicate Entrepreneur')
        .field('phone', '9999000004')
        .field('pin', '5678')
        .field('whatsapp', '9999000004')
        .field('email', 'dup@example.com')
        .field('address', '456 Entrepreneur Way, Hyderabad')
        .field('state_id', testStateId)
        .field('district_id', testDistrictId)
        .field('business_name', 'Dup Business Enterprise')
        .field('category_id', testCategoryId)
        .field('business_description', 'Providing duplicate IT services')
        .field('website', 'https://dupenterprise.com')
        .field('gst_number', '36AAAAA0000A1Z6')
        .field('firebaseToken', 'valid-firebase-token-4')
        .attach('payment_receipt', Buffer.from('fake receipt'), 'receipt.pdf')
        .expect(409);
    });

    it('should register a member successfully with profile_pic and payment_receipt file uploads', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register-member')
        .field('full_name', 'File Upload Entrepreneur')
        .field('phone', '9999000006')
        .field('pin', '5678')
        .field('whatsapp', '9999000006')
        .field('email', 'upload.entrepreneur@example.com')
        .field('address', '789 Upload Way, Hyderabad')
        .field('state_id', testStateId)
        .field('district_id', testDistrictId)
        .field('business_name', 'Upload Business Enterprise')
        .field('category_id', testCategoryId)
        .field('business_description', 'Providing IT upload services')
        .field('website', 'https://uploadenterprise.com')
        .field('gst_number', '36AAAAA0000A1Z7')
        .field('firebaseToken', 'valid-firebase-token-6')
        .attach('profile_pic', Buffer.from('fake image data'), 'profile.png')
        .attach('payment_receipt', Buffer.from('fake pdf data'), 'receipt.pdf')
        .expect(201);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.phone).toBe('9999000006');

      const mediaList = await mediaRepository.find({
        where: { uploaded_by_id: res.body.user.id },
      });
      expect(mediaList.length).toBe(2);
      const purposes = mediaList.map((m) => m.purpose);
      expect(purposes).toContain(MediaPurpose.PROFILE_PIC);
      expect(purposes).toContain(MediaPurpose.PAYMENT_RECEIPT);
    });

    it('should register a member successfully and update the referral record when a valid reference_code is given', async () => {
      // 1. Create a referrer user
      const referrer = userRepository.create({
        full_name: 'Test Referrer',
        phone: '9999000010',
        pin_hash: 'dummy_hash',
        role: UserRole.MEMBER,
        status: UserStatus.ACTIVE,
      });
      await userRepository.save(referrer);

      // 2. Create a pending referral record
      const referral = referralRepository.create({
        referrer_id: referrer.id,
        referred_phone: '9999000011',
        referral_code: 'BD-TESTREF-1111',
        reward_amount: 0,
        status: ReferralStatus.PENDING,
      });
      await referralRepository.save(referral);

      // 3. Register the referred user
      const res = await request(app.getHttpServer())
        .post('/auth/register-member')
        .field('full_name', 'Referred Entrepreneur')
        .field('phone', '9999000011')
        .field('pin', '5678')
        .field('whatsapp', '9999000011')
        .field('email', 'referred@example.com')
        .field('address', '123 Referred Way, Hyderabad')
        .field('state_id', testStateId)
        .field('district_id', testDistrictId)
        .field('business_name', 'Referred Enterprise')
        .field('category_id', testCategoryId)
        .field('business_description', 'IT consulting referred')
        .field('website', 'https://referred.com')
        .field('gst_number', '36AAAAA0000A1Z8')
        .field('firebaseToken', 'valid-firebase-token-11')
        .field('reference_code', 'BD-TESTREF-1111')
        .attach('payment_receipt', Buffer.from('fake receipt'), 'receipt.pdf')
        .expect(201);

      // 4. Verify referral was updated
      const updatedReferral = await referralRepository.findOne({
        where: { id: referral.id },
      });
      expect(updatedReferral).toBeDefined();
      expect(updatedReferral?.status).toBe(ReferralStatus.JOINED);
      expect(updatedReferral?.referred_user_id).toBe(res.body.user.id);
    });

    it('should return 400 when an invalid reference_code is given during member registration', async () => {
      await request(app.getHttpServer())
        .post('/auth/register-member')
        .field('full_name', 'Invalid Ref Entrepreneur')
        .field('phone', '9999000012')
        .field('pin', '5678')
        .field('whatsapp', '9999000012')
        .field('email', 'invalidref@example.com')
        .field('address', '123 Invalid Way, Hyderabad')
        .field('state_id', testStateId)
        .field('district_id', testDistrictId)
        .field('business_name', 'Invalid Ref Enterprise')
        .field('category_id', testCategoryId)
        .field('business_description', 'IT consulting invalid ref')
        .field('website', 'https://invalidref.com')
        .field('gst_number', '36AAAAA0000A1Z9')
        .field('firebaseToken', 'valid-firebase-token-12')
        .field('reference_code', 'BD-INVALIDCODE-9999')
        .attach('payment_receipt', Buffer.from('fake receipt'), 'receipt.pdf')
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    it('should login successfully with valid phone and PIN', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          phone: '9999000001',
          pin: '1234',
        })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.user.phone).toBe('9999000001');
    });

    it('should return 401 when login PIN is incorrect', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          phone: '9999000001',
          pin: '9999',
        })
        .expect(401);
    });

    it('should return 401 when phone number is not registered', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          phone: '9999000005',
          pin: '1234',
        })
        .expect(401);
    });

    it('should return 401 when user account is SUSPENDED', async () => {
      await userRepository.update(
        { phone: '9999000001' },
        { status: UserStatus.SUSPENDED },
      );

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          phone: '9999000001',
          pin: '1234',
        })
        .expect(401);

      await userRepository.update(
        { phone: '9999000001' },
        { status: UserStatus.ACTIVE },
      );
    });
  });

  describe('POST /auth/forgot-pin & /auth/reset-pin', () => {
    it('should validate phone exists on forgot-pin', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/forgot-pin')
        .send({ phone: '9999000001' })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('should return 404 on forgot-pin if phone number is not registered', async () => {
      await request(app.getHttpServer())
        .post('/auth/forgot-pin')
        .send({ phone: '9999000005' })
        .expect(404);
    });

    it('should reset PIN successfully after verifying firebaseToken', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/reset-pin')
        .send({
          phone: '9999000001',
          firebaseToken: 'valid-firebase-token-1',
          newPin: '4321',
        })
        .expect(200);

      expect(res.body.success).toBe(true);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          phone: '9999000001',
          pin: '4321',
        })
        .expect(200);
    });
  });

  describe('POST /auth/refresh-token', () => {
    let validRefreshToken: string;

    beforeAll(async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ phone: '9999000001', pin: '4321' });
      validRefreshToken = loginRes.body.refreshToken;
    });

    it('should issue new access and refresh tokens when given a valid refresh token', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/refresh-token')
        .send({ refreshToken: validRefreshToken })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
    });

    it('should return 401 when given an invalid refresh token', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh-token')
        .send({ refreshToken: 'invalid.jwt.token' })
        .expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    let accessToken: string;
    let refreshToken: string;

    beforeAll(async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ phone: '9999000001', pin: '4321' });
      accessToken = loginRes.body.accessToken;
      refreshToken = loginRes.body.refreshToken;
    });

    it('should return 401 when calling logout without Bearer token', async () => {
      await request(app.getHttpServer()).post('/auth/logout').expect(401);
    });

    it('should logout successfully with Bearer access token and revoke refresh token', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);

      await request(app.getHttpServer())
        .post('/auth/refresh-token')
        .send({ refreshToken })
        .expect(401);
    });
  });
});
