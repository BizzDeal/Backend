import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { State } from './entities/state.entity';
import { District } from './entities/district.entity';
import { LocationService } from './services/location.service';
import { LocationController } from './controllers/location.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      State,
      District,
    ]),
  ],
  controllers: [LocationController],
  providers: [LocationService],
  exports: [LocationService, TypeOrmModule],
})
export class LocationModule {}


