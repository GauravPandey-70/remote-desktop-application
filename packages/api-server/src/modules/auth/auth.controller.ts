import { Controller, Post, Body, Param, ValidationPipe } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyPasscodeDto } from './dto/verify-passcode.dto';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body(new ValidationPipe()) registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  async login(@Body(new ValidationPipe()) loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('device/:deviceId/passcode')
  async generatePasscode(@Param('deviceId') deviceId: string) {
    return this.authService.generatePasscode(deviceId);
  }

  @Post('device/passcode/verify')
  async verifyPasscode(@Body(new ValidationPipe()) verifyPasscodeDto: VerifyPasscodeDto) {
    const isValid = await this.authService.verifyPasscode(verifyPasscodeDto.deviceId, verifyPasscodeDto.passcode);
    return { success: isValid };
  }
}
