import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async sendOtp(phone: string) {
    const normalised = this.normalisePhone(phone);
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await this.prisma.otpCode.create({ data: { phone: normalised, code, expiresAt } });

    if (this.config.get('NODE_ENV') === 'development') {
      console.log(`[DEV OTP] ${normalised} → ${code}`);
      return { message: 'OTP sent (check server console in dev mode)' };
    }

    // Production: send via Twilio
    // const twilio = require('twilio')(this.config.get('TWILIO_ACCOUNT_SID'), this.config.get('TWILIO_AUTH_TOKEN'));
    // await twilio.messages.create({ body: `Your ServiConnect code: ${code}`, from: this.config.get('TWILIO_FROM_NUMBER'), to: normalised });
    return { message: 'OTP sent' };
  }

  async verifyOtp(phone: string, code: string, role?: UserRole, name?: string) {
    const normalised = this.normalisePhone(phone);
    const otp = await this.prisma.otpCode.findFirst({
      where: { phone: normalised, code, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) throw new UnauthorizedException('Invalid or expired OTP');
    await this.prisma.otpCode.update({ where: { id: otp.id }, data: { usedAt: new Date() } });

    let isNewUser = false;
    let user = await this.prisma.user.findUnique({ where: { phone: normalised } });
    if (!user) {
      isNewUser = true;
      user = await this.prisma.user.create({
        data: { phone: normalised, name: name ?? 'New User', role: role ?? UserRole.CUSTOMER },
      });
    } else {
     await this.prisma.user.update({
  where: { id: user.id },
  data: {
    lastLoginAt: new Date(),
    ...(name && user.name === 'New User' ? { name } : {}),
  },
});
    }

    const token = this.jwt.sign({ sub: user.id, role: user.role });
    return { token, user: this.safe(user), isNewUser };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { business: { select: { id: true, name: true, slug: true, status: true, isVerified: true } } },
    });
    if (!user) throw new UnauthorizedException();
    return this.safe(user);
  }

  private normalisePhone(phone: string): string {
    const c = phone.replace(/\s|-/g, '');
    if (c.startsWith('+27')) return c;
    if (c.startsWith('27')) return `+${c}`;
    if (c.startsWith('0')) return `+27${c.slice(1)}`;
    return c;
  }

  private safe(user: any) {
    const { ...u } = user;
    return u;
  }
}
