import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { State } from '../entities/state.entity';
import { District } from '../entities/district.entity';
import { LocationQueryDto } from '../dto/location-query.dto';

@Injectable()
export class LocationService {
  constructor(
    @InjectRepository(State)
    private readonly stateRepo: Repository<State>,
    @InjectRepository(District)
    private readonly districtRepo: Repository<District>,
  ) {}

  async getStates(query?: LocationQueryDto) {
    const where = query?.search ? { name: ILike(`%${query.search.trim()}%`) } : {};

    return this.stateRepo.find({
      where,
      order: { name: 'ASC' },
    });
  }

  async getDistrictsByState(stateId: string, query?: LocationQueryDto) {
    const state = await this.stateRepo.findOne({ where: { id: stateId } });
    if (!state) {
      throw new NotFoundException(`State with ID ${stateId} not found`);
    }

    const where: any = { stateId };
    if (query?.search) {
      where.name = ILike(`%${query.search.trim()}%`);
    }

    return this.districtRepo.find({
      where,
      order: { name: 'ASC' },
    });
  }

  async getStateById(id: string): Promise<State | null> {
    return this.stateRepo.findOne({ where: { id } });
  }

  async getDistrictById(id: string): Promise<District | null> {
    return this.districtRepo.findOne({ where: { id } });
  }
}
