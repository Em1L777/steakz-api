import bcrypt from 'bcryptjs';
import prisma from './prisma.js';
import process from 'process';

export async function seedAdmin(): Promise<void> {
  const email    = process.env['ADMIN_EMAIL'];
  const password = process.env['ADMIN_PASSWORD'];

  if (!email || !password) {
    console.log('[Seeder] ADMIN_EMAIL or ADMIN_PASSWORD missing in .env — skipping.');
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    console.log('[Seeder] System Administrator profile already configured — skipping.');
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      name:     'Steakz Technical Admin',
      email,
      password: hashedPassword,
      role:     'ADMIN',
    },
  });

  console.log(`[Seeder] Technical root administration credentials bound successfully: ${email}`);
}