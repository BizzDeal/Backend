import { DataSource } from 'typeorm';
import { Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { User } from '../src/modules/users/entities/user.entity';
import { Profile } from '../src/modules/users/entities/profile.entity';
import { UserRole, UserStatus } from '../src/common/enums';
import { State } from '../src/modules/location/entities/state.entity';
import { District } from '../src/modules/location/entities/district.entity';

export interface SeededUsersResult {
  admin: User;
  agent1: User;
  agent2: User;
  owner1: User;
  owner2: User;
  owner3: User;
  owner4: User;
  customer1: User;
  customer2: User;
  customer3: User;
  customer4: User;
  allOwners: User[];
}

export async function seedDummyUsers(dataSource: DataSource): Promise<SeededUsersResult> {
  const logger = new Logger('SeedDummyUsers');
  logger.log('Seeding dummy users (Admin, Agents, 140 Owners, Customers) with password "1234"...');

  const userRepo = dataSource.getRepository(User);
  const profileRepo = dataSource.getRepository(Profile);
  const stateRepo = dataSource.getRepository(State);
  const districtRepo = dataSource.getRepository(District);

  // Fetch default state (Andhra Pradesh) & district if available
  const apState = await stateRepo.findOne({ where: { name: 'Andhra Pradesh' } });
  const visakhaDistrict = await districtRepo.findOne({ where: { name: 'Visakhapatnam' } }) || 
                          await districtRepo.findOne({ where: {} });

  const pinHash = await bcrypt.hash('1234', 10);

  const baseConfigs = [
    {
      key: 'admin',
      email: 'admin@bizzdeal.com',
      phone: '9876543210',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      fullName: 'System Administrator',
      address: '101 Admin Towers, Visakhapatnam, Andhra Pradesh',
    },
    {
      key: 'agent1',
      email: 'agent1@bizzdeal.com',
      phone: '9876543211',
      role: UserRole.MEMBER,
      status: UserStatus.ACTIVE,
      fullName: 'Ramesh Kumar (Sales Officer)',
      address: '202 Commercial Plaza, Visakhapatnam, Andhra Pradesh',
    },
    {
      key: 'agent2',
      email: 'agent2@bizzdeal.com',
      phone: '9876543212',
      role: UserRole.MEMBER,
      status: UserStatus.ACTIVE,
      fullName: 'Sita Lakshmi (Field Officer)',
      address: '303 Business Complex, Vijayawada, Andhra Pradesh',
    },
    {
      key: 'customer1',
      email: 'customer1@bizzdeal.com',
      phone: '9876543217',
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
      fullName: 'Kiran Varma (VIP Customer)',
      address: 'Plot 42, MVP Colony, Visakhapatnam',
    },
    {
      key: 'customer2',
      email: 'customer2@bizzdeal.com',
      phone: '9876543218',
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
      fullName: 'Sneha Patel (Active Shopper)',
      address: 'Flat 301, Sunrise Apartments, Vijayawada',
    },
    {
      key: 'customer3',
      email: 'customer3@bizzdeal.com',
      phone: '9876543219',
      role: UserRole.CUSTOMER,
      status: UserStatus.UNVERIFIED,
      fullName: 'Ravi Teja (New Customer)',
      address: 'H.No 14-2, Gandhi Nagar, Kakinada',
    },
    {
      key: 'customer4',
      email: 'customer4@bizzdeal.com',
      phone: '9876543220',
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
      fullName: 'Divya Sri (Deal Collector)',
      address: 'D.No 7-1, Auto Nagar, Guntur',
    },
  ];

  interface UserConfigItem {
    key: string;
    email: string;
    phone: string;
    role: UserRole;
    status: UserStatus;
    fullName: string;
    address: string;
  }

  const FIRST_NAMES = [
    'Rajesh', 'Suresh', 'Ramesh', 'Vikram', 'Amit', 'Anand', 'Kiran', 'Deepak',
    'Sunil', 'Praveen', 'Manoj', 'Vijay', 'Sanjay', 'Santosh', 'Mahesh', 'Ganesh',
    'Priya', 'Ananya', 'Sneha', 'Kavita', 'Pooja', 'Sunita', 'Divya', 'Lakshmi',
    'Deepa', 'Swati', 'Meera', 'Radha', 'Shweta', 'Nisha', 'Aarti', 'Ritu',
    'Karthik', 'Arjun', 'Rahul', 'Rohit', 'Varun', 'Tarun', 'Harish', 'Naveen',
    'Siddharth', 'Aditya', 'Gaurav', 'Alok', 'Prashant', 'Ashish', 'Vikas', 'Manish',
    'Bhavna', 'Geeta', 'Suman', 'Sarita', 'Rekha', 'Usha', 'Madhavi', 'Padma'
  ];

  const LAST_NAMES = [
    'Sharma', 'Verma', 'Patel', 'Reddy', 'Rao', 'Nair', 'Mehta', 'Joshi',
    'Gupta', 'Kumar', 'Singh', 'Sundaram', 'Iyer', 'Menon', 'Kulkarni', 'Deshmukh',
    'Bhat', 'Hegde', 'Pillai', 'Choudhury', 'Mishra', 'Pandey', 'Shukla', 'Trivedi',
    'Saxena', 'Agarwal', 'Bansal', 'Jain', 'Shah', 'Dalal', 'Malhotra', 'Kapoor'
  ];

  // Generate 450 Owner Configurations for 40+ categories with 10 businesses each
  const ownerConfigs: UserConfigItem[] = [];
  for (let i = 1; i <= 450; i++) {
    let ownerStatus = UserStatus.ACTIVE;
    if (i === 448) ownerStatus = UserStatus.PENDING;
    else if (i === 449) ownerStatus = UserStatus.REJECTED;
    else if (i === 450) ownerStatus = UserStatus.SUSPENDED;
    
    const firstName = FIRST_NAMES[(i - 1) % FIRST_NAMES.length];
    const lastName = LAST_NAMES[Math.floor((i - 1) / FIRST_NAMES.length) % LAST_NAMES.length];
    const fullName = `${firstName} ${lastName}`;

    ownerConfigs.push({
      key: `owner${i}`,
      email: `owner${i}@bizzdeal.com`,
      phone: `98765${(10000 + i).toString().padStart(5, '0')}`,
      role: UserRole.MEMBER,
      status: ownerStatus,
      fullName,
      address: `D.No ${i}-${(i % 10) + 1}-12, Commercial St, Andhra Pradesh`,
    });
  }

  const userConfigs = [...baseConfigs, ...ownerConfigs];
  const resultMap: Record<string, User> = {};
  const allOwnersList: User[] = [];

  for (const cfg of userConfigs) {
    let user = await userRepo.findOne({ where: { email: cfg.email } });
    if (!user) {
      user = userRepo.create({
        email: cfg.email,
        phone: cfg.phone,
        role: cfg.role,
        status: cfg.status,
        pin_hash: pinHash,
        approved_at: cfg.status === UserStatus.ACTIVE ? new Date() : null,
      });
      user = await userRepo.save(user);
    } else {
      user.role = cfg.role;
      user.status = cfg.status;
      user.phone = cfg.phone;
      user.pin_hash = pinHash;
      user = await userRepo.save(user);
    }

    let profile = await profileRepo.findOne({ where: { user_id: user.id } });
    if (!profile) {
      profile = profileRepo.create({
        user_id: user.id,
        full_name: cfg.fullName,
        whatsapp: cfg.phone,
        address: cfg.address,
        state_id: apState ? apState.id : null,
        district_id: visakhaDistrict ? visakhaDistrict.id : null,
      });
      await profileRepo.save(profile);
    } else {
      profile.full_name = cfg.fullName;
      profile.whatsapp = cfg.phone;
      profile.address = cfg.address;
      if (apState) profile.state_id = apState.id;
      if (visakhaDistrict) profile.district_id = visakhaDistrict.id;
      await profileRepo.save(profile);
    }

    resultMap[cfg.key] = user;
    if (cfg.key.startsWith('owner')) {
      allOwnersList.push(user);
    }
  }

  logger.log(`Seeded total ${userConfigs.length} users (${allOwnersList.length} business owners).`);

  resultMap['allOwners'] = allOwnersList as unknown as User;
  return resultMap as unknown as SeededUsersResult;
}
