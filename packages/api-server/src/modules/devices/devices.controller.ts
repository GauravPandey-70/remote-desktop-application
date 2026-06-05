import { Controller, Post, Get, Body, Param, Req, UseGuards, ValidationPipe } from '@nestjs/common';
import { Request } from 'express';
import { DevicesService } from './devices.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('api/v1/devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post('register')
  async register(@Body(new ValidationPipe()) dto: RegisterDeviceDto, @Req() req: Request) {
    const ip = req.ip || req.socket.remoteAddress;
    return this.devicesService.registerDevice(dto, ip);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async getMyDevices(@Req() req: any) {
    return this.devicesService.findAll(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':deviceId/claim')
  async claimDevice(@Param('deviceId') deviceId: string, @Req() req: any) {
    return this.devicesService.claimDevice(deviceId, req.user.id);
  }

  @Get(':deviceId')
  async getDevice(@Param('deviceId') deviceId: string) {
    const device = await this.devicesService.findByDeviceId(deviceId);
    // Return a subset of fields for security
    return {
      deviceId: device.deviceId,
      name: device.name,
      osType: device.osType,
      isOnline: device.isOnline,
      lastSeen: device.lastSeen,
      publicKey: device.publicKey,
    };
  }
}
