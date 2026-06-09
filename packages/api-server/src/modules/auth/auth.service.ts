import { Injectable, UnauthorizedException, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User, Passcode, Device } from '../database/entities';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Passcode)
    private readonly passcodeRepository: Repository<Passcode>,
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto): Promise<{ user: Omit<User, 'passwordHash'>; token: string }> {
    const { email, password, displayName } = registerDto;

    const existingUser = await this.userRepository.findOne({ where: { email } });
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = this.userRepository.create({
      email,
      passwordHash,
      displayName,
    });

    const savedUser = await this.userRepository.save(user);
    const { passwordHash: _, ...userWithoutPassword } = savedUser;

    const token = this.jwtService.sign({ sub: savedUser.id, email: savedUser.email });
    return { user: userWithoutPassword, token };
  }

  async login(loginDto: LoginDto): Promise<{ user: Omit<User, 'passwordHash'>; token: string }> {
    const { email, password } = loginDto;

    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    user.lastLogin = new Date();
    await this.userRepository.save(user);

    const { passwordHash: _, ...userWithoutPassword } = user;
    const token = this.jwtService.sign({ sub: user.id, email: user.email });
    return { user: userWithoutPassword, token };
  }

  async generatePasscode(deviceIdStr: string): Promise<{ passcode: string; expiresAt: Date }> {
    const device = await this.deviceRepository.findOne({ where: { deviceId: deviceIdStr } });
    if (!device) {
      throw new NotFoundException('Device not found');
    }

    // Generate 6-digit random passcode
    const passcodeVal = Math.floor(100000 + Math.random() * 900000).toString();
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(passcodeVal, salt, 1000, 64, 'sha256').toString('hex');

    const durationMinutes = parseInt(process.env.PASSCODE_EXPIRY_MINUTES ?? '10', 10);
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + durationMinutes);

    // Deactivate previous passcodes
    await this.passcodeRepository.delete({ deviceId: device.id });

    const newPasscode = this.passcodeRepository.create({
      deviceId: device.id,
      hash,
      salt,
      attempts: 0,
      expiresAt,
    });

    await this.passcodeRepository.save(newPasscode);

    return { passcode: passcodeVal, expiresAt };
  }

  async verifyPasscode(deviceIdStr: string, passcodeVal: string): Promise<boolean> {
    const device = await this.deviceRepository.findOne({ where: { deviceId: deviceIdStr } });
    if (!device) {
      throw new NotFoundException('Device not found');
    }

    const passcode = await this.passcodeRepository.findOne({
      where: {
        deviceId: device.id,
        expiresAt: MoreThan(new Date()),
      },
    });

    if (!passcode) {
      throw new UnauthorizedException('No active passcode found for this device or passcode has expired');
    }

    const maxAttempts = parseInt(process.env.PASSCODE_MAX_ATTEMPTS ?? '5', 10);
    if (passcode.attempts >= maxAttempts) {
      throw new UnauthorizedException('Device passcode is locked due to too many attempts. Please request a new passcode.');
    }

    const computedHash = crypto.pbkdf2Sync(passcodeVal, passcode.salt, 1000, 64, 'sha256').toString('hex');
    if (computedHash !== passcode.hash) {
      passcode.attempts += 1;
      await this.passcodeRepository.save(passcode);
      throw new UnauthorizedException(`Invalid passcode. Attempts remaining: ${maxAttempts - passcode.attempts}`);
    }

    // Passcode verified, consume/delete it so it cannot be used again
    await this.passcodeRepository.delete(passcode.id);
    return true;
  }

  async resolvePasscode(passcodeVal: string): Promise<string> {
    const activePasscodes = await this.passcodeRepository.find({
      where: {
        expiresAt: MoreThan(new Date()),
      },
      relations: ['device'],
    });

    for (const passcode of activePasscodes) {
      const computedHash = crypto.pbkdf2Sync(passcodeVal, passcode.salt, 1000, 64, 'sha256').toString('hex');
      if (computedHash === passcode.hash) {
        const maxAttempts = parseInt(process.env.PASSCODE_MAX_ATTEMPTS ?? '5', 10);
        if (passcode.attempts >= maxAttempts) {
          throw new UnauthorizedException('Device passcode is locked due to too many attempts. Please request a new passcode.');
        }

        // Passcode verified, consume/delete it so it cannot be used again
        await this.passcodeRepository.delete(passcode.id);

        if (passcode.device) {
          return passcode.device.deviceId;
        }
        
        const device = await this.deviceRepository.findOne({ where: { id: passcode.deviceId } });
        if (device) {
          return device.deviceId;
        }
      }
    }

    throw new UnauthorizedException('Invalid or expired passcode');
  }
}
