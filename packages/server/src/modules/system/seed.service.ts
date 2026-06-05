import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Admin } from './admin.entity';
import { Landlord } from '../landlord/landlord.entity';
import { Property } from '../property/property.entity';
import { Room } from '../room/room.entity';

/**
 * Seed data service: auto-checks and initializes demo data on app startup.
 * Only inserts when database is empty (no landlord records).
 */
@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(Admin)
    private readonly adminRepo: Repository<Admin>,
    @InjectRepository(Landlord)
    private readonly landlordRepo: Repository<Landlord>,
    @InjectRepository(Property)
    private readonly propertyRepo: Repository<Property>,
    @InjectRepository(Room)
    private readonly roomRepo: Repository<Room>,
  ) {}

  async onModuleInit(): Promise<void> {
    const landlordCount = await this.landlordRepo.count();
    if (landlordCount > 0) {
      const garbled = await this.hasGarbledData();
      if (!garbled) {
        this.logger.log(`数据库已有 ${landlordCount} 个房东，跳过种子数据`);
        return;
      }
      this.logger.warn('检测到编码异常的旧数据，正在清理并重新播种...');
      await this.cleanAllData();
    }

    await this.seed();
  }

  private async hasGarbledData(): Promise<boolean> {
    const landlords = await this.landlordRepo.find({ take: 5 });
    for (const l of landlords) {
      if (l.name && l.name.includes('�')) {
        return true;
      }
      if (l.name && /^[\x00-\x7F\?]+$/.test(l.name) && l.name.length > 3) {
        return true;
      }
    }
    return false;
  }

  private async cleanAllData(): Promise<void> {
    await this.roomRepo.delete({});
    await this.propertyRepo.delete({});
    await this.landlordRepo.delete({});
    this.logger.log('已清理所有旧业务数据');
  }

  private async seed(): Promise<void> {
    this.logger.log('开始初始化种子数据...');

    // 1. Admin
    const existingAdmin = await this.adminRepo.findOne({ where: { username: 'admin' } });
    if (!existingAdmin) {
      const hashedPwd = await bcrypt.hash('admin123', 10);
      await this.adminRepo.save(
        this.adminRepo.create({
          username: 'admin',
          password: hashedPwd,
          name: '超级管理员',
          role: 0,
          status: 1,
        }),
      );
      this.logger.log('管理员账号已创建: admin / admin123');
    }

    // 2. Landlords
    const landlord1 = await this.landlordRepo.save(
      this.landlordRepo.create({
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
    this.logger.log(`房东: ${landlord1.name} (id=${landlord1.id})`);

    const landlord2 = await this.landlordRepo.save(
      this.landlordRepo.create({
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
    this.logger.log(`房东: ${landlord2.name} (id=${landlord2.id})`);

    // 3. Properties and rooms
    const prop1 = await this.propertyRepo.save(
      this.propertyRepo.create({
        landlordId: landlord1.id,
        name: '阳光花园',
        address: '北京市朝阳区阳光路 88 号',
        note: '小区环境优美，交通便利，紧邻地铁站',
      }),
    );
    await this.createRooms(prop1.id, [
      { name: '101 室', rent: 2500, deposit: 2500, area: '30m²', floor: '1层', orientation: '南' },
      { name: '202 室', rent: 2800, deposit: 2800, area: '35m²', floor: '2层', orientation: '南' },
      { name: '303 室', rent: 3200, deposit: 3200, area: '42m²', floor: '3层', orientation: '东南' },
    ]);
    this.logger.log(`房源: ${prop1.name} (${prop1.address})，3 个房间`);

    const prop2 = await this.propertyRepo.save(
      this.propertyRepo.create({
        landlordId: landlord2.id,
        name: '翠竹苑',
        address: '上海市浦东新区翠竹路 666 号',
        note: '新装修公寓，配套齐全，拎包入住',
      }),
    );
    await this.createRooms(prop2.id, [
      { name: 'A101', rent: 3500, deposit: 3500, area: '38m²', floor: '1层', orientation: '南' },
      { name: 'A201', rent: 3800, deposit: 3800, area: '45m²', floor: '2层', orientation: '南北' },
      { name: 'A301', rent: 4200, deposit: 4200, area: '50m²', floor: '3层', orientation: '南' },
      { name: 'A401', rent: 3000, deposit: 3000, area: '28m²', floor: '4层', orientation: '北' },
    ]);
    this.logger.log(`房源: ${prop2.name} (${prop2.address})，4 个房间`);

    const prop3 = await this.propertyRepo.save(
      this.propertyRepo.create({
        landlordId: landlord1.id,
        name: '翠苑新村',
        address: '杭州市西湖区翠苑路 128 号',
        note: '成熟社区，生活配套齐全，适合家庭居住',
      }),
    );
    await this.createRooms(prop3.id, [
      { name: '1-101', rent: 2200, deposit: 2200, area: '32m²', floor: '1层', orientation: '南' },
      { name: '1-201', rent: 2400, deposit: 2400, area: '36m²', floor: '2层', orientation: '南' },
      { name: '1-301', rent: 2600, deposit: 2600, area: '40m²', floor: '3层', orientation: '东' },
      { name: '2-101', rent: 2000, deposit: 2000, area: '25m²', floor: '1层', orientation: '北' },
      { name: '2-201', rent: 2300, deposit: 2300, area: '30m²', floor: '2层', orientation: '南' },
    ]);
    this.logger.log(`房源: ${prop3.name} (${prop3.address})，5 个房间`);

    this.logger.log('种子数据初始化完成！');
  }

  private async createRooms(
    propertyId: number,
    rooms: { name: string; rent: number; deposit: number; area: string; floor: string; orientation: string }[],
  ): Promise<void> {
    for (const r of rooms) {
      await this.roomRepo.save(
        this.roomRepo.create({
          propertyId,
          name: r.name,
          rent: r.rent,
          deposit: r.deposit,
          status: 0,
          area: r.area,
          floor: r.floor,
          orientation: r.orientation,
        }),
      );
    }
  }
}
