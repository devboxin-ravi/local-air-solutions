/**
 * LOCAL DEVELOPMENT ONLY — creates a demo city/branch/service area, a technician, a branch manager
 * and a customer so every workflow can be exercised end-to-end. Refuses to run in production.
 * Run: npm run db:seed:demo
 */

import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { config } from '../src/config';

const prisma = new PrismaClient({ datasources: { db: { url: config.databaseUrl } } });
const DEMO_PASSWORD = 'Demo@1234';

async function userWithRole(data: { name: string; email: string; username?: string; mobile: string; userType: 'ADMIN' | 'STAFF' | 'CUSTOMER'; branchId?: number }, roleCode: string) {
  const existing = await prisma.user.findUnique({ where: { mobile: data.mobile } });
  if (existing) {
    if (data.username && !existing.username) return prisma.user.update({ where: { id: existing.id }, data: { username: data.username } });
    return existing;
  }
  const role = await prisma.role.findUniqueOrThrow({ where: { code: roleCode } });
  const user = await prisma.user.create({ data: { ...data, passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10) } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  return user;
}

async function main() {
  if (config.isProduction) throw new Error('Demo seed must never run in production.');

  const state = await prisma.state.findUniqueOrThrow({ where: { code: 'MP' } });
  const city = await prisma.city.upsert({ where: { stateId_name: { stateId: state.id, name: 'Indore' } }, create: { stateId: state.id, name: 'Indore' }, update: {} });
  const branch = await prisma.branch.upsert({
    where: { code: 'IDR-01' },
    create: { cityId: city.id, code: 'IDR-01', name: 'Indore Main (Demo)', address: 'Demo branch address — update in Master Data', phone: '9000000002' },
    update: {},
  });
  const area = await prisma.serviceArea.upsert({
    where: { branchId_name: { branchId: branch.id, name: 'Vijay Nagar (Demo)' } },
    create: { branchId: branch.id, name: 'Vijay Nagar (Demo)', pincodes: '452010,452011' },
    update: {},
  });

  await userWithRole({ name: 'Demo Branch Manager', email: 'manager@demo.local', username: 'manager', mobile: '9000000003', userType: 'ADMIN', branchId: branch.id }, 'BRANCH_MANAGER');

  const techUser = await userWithRole({ name: 'Ravi Technician (Demo)', email: 'tech@demo.local', username: 'tech', mobile: '9000000004', userType: 'STAFF', branchId: branch.id }, 'TECHNICIAN');
  const staff = await prisma.staffProfile.upsert({
    where: { userId: techUser.id },
    create: { userId: techUser.id, staffCode: 'STF-DEMO1', branchId: branch.id, designation: 'Senior Technician', experienceYears: 6 },
    update: {},
  });
  const skills = await prisma.skill.findMany({ where: { name: { in: ['AC Servicing', 'AC Repair', 'Gas Charging', 'AC Installation'] } } });
  await prisma.technicianSkill.createMany({ data: skills.map((s) => ({ staffId: staff.id, skillId: s.id })), skipDuplicates: true });
  await prisma.staffServiceArea.createMany({ data: [{ staffId: staff.id, serviceAreaId: area.id }], skipDuplicates: true });

  const custUser = await userWithRole({ name: 'Anita Sharma (Demo)', email: 'customer@demo.local', mobile: '9000000005', userType: 'CUSTOMER' }, 'CUSTOMER');
  const customer =
    (await prisma.customer.findUnique({ where: { userId: custUser.id } })) ??
    (await prisma.customer.create({ data: { customerCode: 'CUS-DEMO1', userId: custUser.id, fullName: custUser.name, mobile: custUser.mobile, email: custUser.email, branchId: branch.id } }));
  if (!(await prisma.customerAddress.findFirst({ where: { customerId: customer.id } }))) {
    await prisma.customerAddress.create({
      data: { customerId: customer.id, label: 'Home', line1: '12, Demo Residency, Scheme 54', stateId: state.id, cityId: city.id, serviceAreaId: area.id, pincode: '452010', isDefault: true },
    });
  }

  // Next 14 days of slots (09:00–19:00, 2h, capacity 3, Mon–Sat)
  const today = new Date();
  for (let i = 0; i < 14; i += 1) {
    const d = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() + i));
    if (d.getUTCDay() === 0) continue;
    for (const [s, e] of [['09:00', '11:00'], ['11:00', '13:00'], ['13:00', '15:00'], ['15:00', '17:00'], ['17:00', '19:00']]) {
      await prisma.appointmentSlot.upsert({
        where: { branchId_slotDate_startTime: { branchId: branch.id, slotDate: d, startTime: s } },
        create: { branchId: branch.id, slotDate: d, startTime: s, endTime: e, capacity: 3 },
        update: {},
      });
    }
  }
  console.log(`Demo data ready. Demo password for manager/tech/customer: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
