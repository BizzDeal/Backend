import { DataSource } from 'typeorm';
import { AppDataSource } from '../src/database/data-source';
import { BusinessProfile } from '../src/modules/businesses/entities/business-profile.entity';
import { Offer } from '../src/modules/offers/entities/offer.entity';

async function updateVideoUrls() {
  await AppDataSource.initialize();
  console.log('Database connected.');

  const bizRepo = AppDataSource.getRepository(BusinessProfile);
  const offerRepo = AppDataSource.getRepository(Offer);

  const videoUrl = 'https://www.youtube.com/embed/hOgVAYpHPCc';

  console.log('Updating business profiles...');
  const bizResult = await bizRepo.createQueryBuilder()
    .update(BusinessProfile)
    .set({ video_url: videoUrl })
    .where('video_url IS NULL OR video_url != :videoUrl', { videoUrl })
    .execute();
  console.log(`Updated ${bizResult.affected} businesses.`);

  console.log('Updating offers...');
  const offerResult = await offerRepo.createQueryBuilder()
    .update(Offer)
    .set({ video_url: videoUrl })
    .where('video_url IS NULL OR video_url != :videoUrl', { videoUrl })
    .execute();
  console.log(`Updated ${offerResult.affected} offers.`);

  await AppDataSource.destroy();
  console.log('Update complete.');
}

updateVideoUrls().catch(err => {
  console.error('Error updating DB:', err);
  process.exit(1);
});
