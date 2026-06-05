import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device } from '../database/entities';
import { RegisterDeviceDto } from './dto/register-device.dto';

@Injectable()
export class DevicesService {
  constructor(
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
  ) {}

  async registerDevice(dto: RegisterDeviceDto, clientIp?: string): Promise<Device> {
    let device = await this.deviceRepository.findOne({ where: { deviceId: dto.deviceId } });

    if (device) {
      device.name = dto.name;
      device.osType = dto.osType;
      device.osVersion = dto.osVersion;
      device.agentVersion = dto.agentVersion;
      device.publicKey = dto.publicKey;
      device.lastIp = clientIp;
      device.isOnline = true;
      device.lastSeen = new Date();
    } else {
      device = this.deviceRepository.create({
        ...dto,
        lastIp: clientIp,
        isOnline: true,
        lastSeen: new Date(),
      });
    }

    return this.deviceRepository.save(device);
  }

  async updateOnlineStatus(deviceIdStr: string, isOnline: boolean, clientIp?: string): Promise<Device> {
    const device = await this.deviceRepository.findOne({ where: { deviceId: deviceIdStr } });
    if (!device) {
      throw new NotFoundException('Device not found');
    }

    device.isOnline = isOnline;
    device.lastSeen = new Date();
    if (clientIp) {
      device.lastIp = clientIp;
    }

    return this.deviceRepository.save(device);
  }

  async findByDeviceId(deviceIdStr: string): Promise<Device> {
    const device = await this.deviceRepository.findOne({ where: { deviceId: deviceIdStr } });
    if (!device) {
      throw new NotFoundException(`Device with ID ${deviceIdStr} not found`);
    }
    return device;
  }

  async findAll(ownerId: string): Promise<Device[]> {
    return this.deviceRepository.find({ where: { ownerId } });
  }

  async claimDevice(deviceIdStr: string, userId: string): Promise<Device> {
    const device = await this.findByDeviceId(deviceIdStr);
    device.ownerId = userId;
    return this.deviceRepository.save(device);
  }
}
