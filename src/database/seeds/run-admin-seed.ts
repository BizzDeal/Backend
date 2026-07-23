import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../../modules/users/entities/user.entity';
import { seedAdminUser } from './admin.seed';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const repo = app.get(getRepositoryToken(User));
    await seedAdminUser(repo);
  } finally {
    await app.close();
  }
}

run();
