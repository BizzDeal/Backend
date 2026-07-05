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
  MediaPurpose,
  MediaType,
} from './../src/common/enums';
import { User } from './../src/modules/users/entities/user.entity';
import { MediaFile } from './../src/modules/media/entities/media-file.entity';

describe('UsersController (e2e)', () => {
  let app: INestApplication<App>;
  let userRepository: Repository<User>;
  let mediaRepository: Repository<MediaFile>;
  let jwtService: JwtService;

  let savedUser: User;
  let authToken: string;

  const testPhones = ['9666000001', '9666000002'];

  async function cleanup() {
    if (!userRepository) return;
    for (const phone of testPhones) {
      const user = await userRepository.findOne({ where: { phone } });
      if (user) {
        await mediaRepository?.delete({ uploaded_by_id: user.id });
        await userRepository.delete({ id: user.id });
      }
    }
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    userRepository = moduleFixture.get<Repository<User>>(
      getRepositoryToken(User),
    );
    mediaRepository = moduleFixture.get<Repository<MediaFile>>(
      getRepositoryToken(MediaFile),
    );
    jwtService = moduleFixture.get<JwtService>(JwtService);
    await cleanup();

    // Create a test user
    savedUser = await userRepository.save(
      userRepository.create({
        full_name: 'Existing Test User',
        phone: '9666000001',
        pin_hash: 'hashedpin',
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
      }),
    );

    authToken = await jwtService.signAsync(
      { sub: savedUser.id, phone: savedUser.phone, role: savedUser.role },
      { secret: process.env.JWT_ACCESS_SECRET || 'bizz_deal_access_secret' },
    );

    await mediaRepository.save(
      mediaRepository.create({
        file_url:
          'https://storage.googleapis.com/bizzdeal.firebasestorage.app/uploads/profile.jpg',
        public_id: 'test_public_id_profile',
        file_type: MediaType.IMAGE,
        mime_type: 'image/jpeg',
        file_size: 1024,
        purpose: MediaPurpose.PROFILE_PIC,
        uploaded_by_id: savedUser.id,
      }),
    );
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  describe('GET /users', () => {
    it('should return 401 when no authorization token is provided', async () => {
      await request(app.getHttpServer()).get('/users').expect(401);
    });

    it('should return all users including profile_pic_url property when authenticated', async () => {
      const res = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const testUser = res.body.find((u: any) => u.phone === '9666000001');
      expect(testUser).toBeDefined();
      expect(testUser.profile_pic_url).toBe(
        'https://storage.googleapis.com/bizzdeal.firebasestorage.app/uploads/profile.jpg',
      );
      expect(testUser.pin_hash).toBeUndefined();
    });
  });

  describe('Admin Guard verification on member actions', () => {
    it('should return 401 on approve-member when unauthenticated', async () => {
      await request(app.getHttpServer())
        .put('/users/approve-member')
        .send({ memberId: '00000000-0000-0000-0000-000000000001' })
        .expect(401);
    });

    it('should return 403 on approve-member when called by non-admin role', async () => {
      await request(app.getHttpServer())
        .put('/users/approve-member')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ memberId: '00000000-0000-0000-0000-000000000001' })
        .expect(403);
    });
  });

  describe('POST /users/user-exist', () => {
    it('should return exists: true when user is found', async () => {
      const res = await request(app.getHttpServer())
        .post('/users/user-exist')
        .send({ phone: '9666000001' })
        .expect(200);

      expect(res.body).toEqual({ exists: true });
    });

    it('should return exists: false when user is not found', async () => {
      const res = await request(app.getHttpServer())
        .post('/users/user-exist')
        .send({ phone: '9666000002' })
        .expect(200);

      expect(res.body).toEqual({ exists: false });
    });

    it('should return 400 when phone number validation fails', async () => {
      await request(app.getHttpServer())
        .post('/users/user-exist')
        .send({ phone: '123' })
        .expect(400);
    });
  });
});
