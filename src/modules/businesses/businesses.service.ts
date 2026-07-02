import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Business } from './entities/business.entity';
import { BusinessCategory } from './entities/business-category.entity';

@Injectable()
export class BusinessesService {
  constructor(
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    @InjectRepository(BusinessCategory)
    private readonly categoryRepository: Repository<BusinessCategory>,
  ) {}

  async getCategories(): Promise<{
    success: boolean;
    count: number;
    data: BusinessCategory[];
  }> {
    const categories = await this.categoryRepository.find({
      where: { is_active: true },
      order: { name: 'ASC' },
    });

    return {
      success: true,
      count: categories.length,
      data: categories,
    };
  }

  async validateCategoryExists(
    categoryId: string,
  ): Promise<BusinessCategory | null> {
    const category = await this.categoryRepository.findOne({
      where: { id: categoryId, is_active: true },
    });
    return category;
  }

  async createBusiness(data: Partial<Business>): Promise<Business> {
    const business = this.businessRepository.create(data);
    return this.businessRepository.save(business);
  }
}
