/**
 * Seed data script: initialize demo data
 *
 * Run from packages/server directory:
 *   npx ts-node -r tsconfig-paths/register src/seed.ts
 *
 * Features:
 *   1. Create sqljs database and auto-sync tables
 *   2. Insert demo data: 1 admin + 2 landlords + 3 properties + rooms
 */

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as path from 'path';

import { Admin } from './modules/system/admin.entity';
import { SystemConfig } from './modules/system/system-config.entity';
import { Landlord } from './modules/landlord/landlord.entity';
import { Property } from './modules/property/property.entity';
import { Room } from './modules/room/room.entity';
import { Tenant } from './modules/tenant/tenant.entity';
import { Bill } from './modules/bill/bill.entity';
import { BillItem } from './modules/bill/bill-item.entity';
import { FeeItem } from './modules/fee/fee-item.entity';
import { Document } from './modules/document/document.entity';
import { RentRecord } from './modules/rent/rent-record.entity';
import { SingleCharge } from './modules/rent/single-charge.entity';
import { PaymentQr } from './modules/payment-qr/payment-qr.entity';

const DATA_DIR = path.resolve(__dirname, '..', 'data');

async function seed(): Promise<void> {
  console.log('=== 开始初始化种子数据 ===\n');

  const dbType = process.env.DB_TYPE || 'sqljs';

  let dsConfig: any;
  if (dbType === 'mysql') {
    dsConfig = {
      type: 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      username: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_DATABASE || 'local_landlord',
      entities: [
        Admin, SystemConfig, Landlord, Property, Room, Tenant,
        Bill, BillItem, FeeItem, Document, RentRecord, SingleCharge, PaymentQr,
      ],
      synchronize: true,
      logging: false,
    };
  } else {
    dsConfig = {
      type: 'sqljs',
      location: path.join(DATA_DIR, 'local_landlord.sqlite'),
      autoSave: true,
      entities: [
        Admin, SystemConfig, Landlord, Property, Room, Tenant,
        Bill, BillItem, FeeItem, Document, RentRecord, SingleCharge, PaymentQr,
      ],
      synchronize: true,
      logging: false,
    };
  }

  const ds = new DataSource(dsConfig as any);

  await ds.initialize();
  console.log('[OK] 数据库连接成功，表结构已同步\n');

  // ========== 1. Create admin ==========
  const adminRepo = ds.getRepository(Admin);
  const existingAdmin = await adminRepo.findOne({ where: { username: 'admin' } });
  if (!existingAdmin) {
    const hashedPwd = await bcrypt.hash('admin123', 10);
    await adminRepo.save(
      adminRepo.create({
        username: 'admin',
        password: hashedPwd,
        name: '超级管理员',
        role: 0,
        status: 1,
      }),
    );
    console.log('[OK] 管理员账号已创建: admin / admin123');
  } else {
    console.log('[SKIP] 管理员账号已存在');
  }

  // ========== 2. Create demo landlords ==========
  const landlordRepo = ds.getRepository(Landlord);

  const existingCount = await landlordRepo.count();
  if (existingCount > 0) {
    console.log(`[SKIP] 已有 ${existingCount} 个房东，跳过种子数据插入\n`);
    await ds.destroy();
    console.log('=== 种子数据检查完成 ===');
    return;
  }

  const landlord1 = await landlordRepo.save(
    landlordRepo.create({
      openId: 'demo_zhang_daye',
      name: '张大爷',
      phone: '13800001111',
      avatar: '',
      defaultPayeeName: '张大爷',
      paymentNote: '请转账至银行卡 6222****1234',
      status: 1,
      maxProperties: 10,
    }),
  );
  console.log(`[OK] 房东 1: ${landlord1.name} (id=${landlord1.id})`);

  const landlord2 = await landlordRepo.save(
    landlordRepo.create({
      openId: 'demo_li_ayi',
      name: '李阿姨',
      phone: '13900002222',
      avatar: '',
      defaultPayeeName: '李阿姨',
      paymentNote: '请转账至银行卡 6228****5678',
      status: 1,
      maxProperties: 10,
    }),
  );
  console.log(`[OK] 房东 2: ${landlord2.name} (id=${landlord2.id})`);

  // ========== 3. Create demo properties and rooms ==========
  const propertyRepo = ds.getRepository(Property);
  const roomRepo = ds.getRepository(Room);

  const prop1 = await propertyRepo.save(
    propertyRepo.create({
      landlordId: landlord1.id,
      name: '阳光花园',
      address: '北京市朝阳区阳光路 88 号',
      note: '小区环境优美，交通便利，紧邻地铁站',
    }),
  );
  for (const roomDef of [
    { name: '101 室', rent: 2500, deposit: 2500, area: '30m²', floor: '1层', orientation: '南' },
    { name: '202 室', rent: 2800, deposit: 2800, area: '35m²', floor: '2层', orientation: '南' },
    { name: '303 室', rent: 3200, deposit: 3200, area: '42m²', floor: '3层', orientation: '东南' },
  ]) {
    await roomRepo.save(
      roomRepo.create({
        propertyId: prop1.id,
        name: roomDef.name,
        rent: roomDef.rent,
        deposit: roomDef.deposit,
        status: 0,
        area: roomDef.area,
        floor: roomDef.floor,
        orientation: roomDef.orientation,
      }),
    );
  }
  console.log(`[OK] 房源 1: ${prop1.name} (${prop1.address})，3 个房间`);

  const prop2 = await propertyRepo.save(
    propertyRepo.create({
      landlordId: landlord2.id,
      name: '翠竹苑',
      address: '上海市浦东新区翠竹路 666 号',
      note: '新装修公寓，配套齐全，拎包入住',
    }),
  );
  for (const roomDef of [
    { name: 'A101', rent: 3500, deposit: 3500, area: '38m²', floor: '1层', orientation: '南' },
    { name: 'A201', rent: 3800, deposit: 3800, area: '45m²', floor: '2层', orientation: '南北' },
    { name: 'A301', rent: 4200, deposit: 4200, area: '50m²', floor: '3层', orientation: '南' },
    { name: 'A401', rent: 3000, deposit: 3000, area: '28m²', floor: '4层', orientation: '北' },
  ]) {
    await roomRepo.save(
      roomRepo.create({
        propertyId: prop2.id,
        name: roomDef.name,
        rent: roomDef.rent,
        deposit: roomDef.deposit,
        status: 0,
        area: roomDef.area,
        floor: roomDef.floor,
        orientation: roomDef.orientation,
      }),
    );
  }
  console.log(`[OK] 房源 2: ${prop2.name} (${prop2.address})，4 个房间`);

  const prop3 = await propertyRepo.save(
    propertyRepo.create({
      landlordId: landlord1.id,
      name: '翠苑新村',
      address: '杭州市西湖区翠苑路 128 号',
      note: '成熟社区，生活配套齐全，适合家庭居住',
    }),
  );
  for (const roomDef of [
    { name: '1-101', rent: 2200, deposit: 2200, area: '32m²', floor: '1层', orientation: '南' },
    { name: '1-201', rent: 2400, deposit: 2400, area: '36m²', floor: '2层', orientation: '南' },
    { name: '1-301', rent: 2600, deposit: 2600, area: '40m²', floor: '3层', orientation: '东' },
    { name: '2-101', rent: 2000, deposit: 2000, area: '25m²', floor: '1层', orientation: '北' },
    { name: '2-201', rent: 2300, deposit: 2300, area: '30m²', floor: '2层', orientation: '南' },
  ]) {
    await roomRepo.save(
      roomRepo.create({
        propertyId: prop3.id,
        name: roomDef.name,
        rent: roomDef.rent,
        deposit: roomDef.deposit,
        status: 0,
        area: roomDef.area,
        floor: roomDef.floor,
        orientation: roomDef.orientation,
      }),
    );
  }
  console.log(`[OK] 房源 3: ${prop3.name} (${prop3.address})，5 个房间`);

  console.log('\n=== 种子数据初始化完成 ===');
  console.log(`  管理员: 1`);
  console.log(`  房东:   2 (张大爷, 李阿姨)`);
  console.log(`  房源:   3 (阳光花园, 翠竹苑, 翠苑新村)`);
  console.log(`  房间:   12 (3+4+5)`);

  await ds.destroy();
}

seed().catch((err) => {
  console.error('种子数据初始化失败:', err);
  process.exit(1);
});
