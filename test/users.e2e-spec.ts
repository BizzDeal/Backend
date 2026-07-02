import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppModule } from './../src/app.module';
import { UserRole, UserStatus, MediaPurpose, MediaType } from './../src/common/enums';
import { User } from './../src/modules/users/entities/user.entity';
import { MediaFile } from './../src/modules/media/entities/media-file.entity';

describe('UsersController (e2e)', () => {
  let app: INestApplication<App>;
  let userRepository: Repository<User>;
  let mediaRepository: Repository<MediaFile>;

  const testPhones = ['9888000001', '9888000002'];

  async function cleanup() {
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

    userRepository = moduleFixture.get<Repository<User>>(getRepositoryToken(User));
    mediaRepository = moduleFixture.get<Repository<MediaFile>>(getRepositoryToken(MediaFile));
    await cleanup();

    // Create a test user
    const savedUser = await userRepository.save(
      userRepository.create({
        full_name: 'Existing Test User',
        phone: '9888000001',
        pin_hash: 'hashedpin',
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
      }),
    );

    await mediaRepository.save(
      mediaRepository.create({
        file_url: 'https://storage.googleapis.com/bizzdeal.firebasestorage.app/uploads/profile.jpg',
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
    it('should return all users including profile_pic_url property', async () => {
      const res = await request(app.getHttpServer())
        .get('/users')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const testUser = res.body.find((u: any) => u.phone === '9888000001');
      expect(testUser).toBeDefined();
      expect(testUser.profile_pic_url).toBe(
        'https://storage.googleapis.com/bizzdeal.firebasestorage.app/uploads/profile.jpg',
      );
      expect(testUser.pin_hash).toBeUndefined();
    });
  });

  describe('POST /users/user-exist', () => {
    it('should return exists: true when user is found', async () => {
      const res = await request(app.getHttpServer())
        .post('/users/user-exist')
        .send({ phone: '9888000001' })
        .expect(200);

      expect(res.body).toEqual({ exists: true });
    });

    it('should return exists: false when user is not found', async () => {
      const res = await request(app.getHttpServer())
        .post('/users/user-exist')
        .send({ phone: '9888000002' })
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
