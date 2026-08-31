import { Repository } from 'typeorm';
import { Logger } from '@nestjs/common';
import { User } from '../../modules/users/entities/user.entity';
import { UserRole, UserStatus } from '../../common/enums';
import * as bcrypt from 'bcryptjs';

export async function seedAdminUser(userRepository: Repository<User>): Promise<void> {
  const logger = new Logger('SeedAdminUser');
  logger.log('Checking and seeding Admin User...');

  const email = 'admin@bizzdeal.com';
  const phone = '9876543210';

  // Deactivate legacy duplicate admin if present
  const legacyAdmin = await userRepository.findOne({ where: { email: 'support@bizzdeal.in' } });
  if (legacyAdmin) {
    legacyAdmin.status = UserStatus.UNVERIFIED;
    await userRepository.save(legacyAdmin);
    logger.log('Deactivated duplicate legacy admin: support@bizzdeal.in');
  }

  const existingAdmin = await userRepository.findOne({
    where: { email },
  });

  if (!existingAdmin) {
    const pinHash = await bcrypt.hash('1234', 10);
    const admin = userRepository.create({
      email,
      phone,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      pin_hash: pinHash,
    });
    await userRepository.save(admin);
    logger.log(`Inserted admin user: ${email} with default PIN 1234`);
  } else {
    existingAdmin.role = UserRole.ADMIN;
    existingAdmin.status = UserStatus.ACTIVE;
    existingAdmin.phone = phone;
    await userRepository.save(existingAdmin);
    logger.log(`Admin user ${email} already exists. Updated role and status to active.`);
  }
}
