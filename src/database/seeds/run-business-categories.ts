import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BusinessCategory } from '../../modules/businesses/entities/business-category.entity';
import { seedBusinessCategories } from './business-categories.seed';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const repo = app.get(getRepositoryToken(BusinessCategory));
    await seedBusinessCategories(repo);
  } finally {
    await app.close();
  }
}

run();
