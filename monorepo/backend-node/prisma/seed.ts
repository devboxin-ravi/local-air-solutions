/**
 * Production-safe seed (idempotent): permissions, roles, Super Admin, settings, templates,
 * Indian states, served cities (all Chhattisgarh districts), product types, skills, service categories
 * and the initial service catalogue.
 *
 * Seeded service prices are INDICATIVE "starting" prices — review them in Admin → Services → Service Pricing.
 * Run: npm run db:seed
 */

import bcrypt from 'bcryptjs';
import { PricingType, PrismaClient } from '@prisma/client';
import { config } from '../src/config';
import { DEFAULT_ROLE_PERMISSIONS, MODULE_ACTIONS, ROLE_LABELS, RoleCodes } from '../src/constants/roles';
import { DEFAULT_SETTINGS } from '../src/constants/settings';
import { DEFAULT_TEMPLATES } from '../src/constants/notifications';
import { slugify } from '../src/utils/helpers';

const prisma = new PrismaClient({ datasources: { db: { url: config.databaseUrl } } });

const STATES: Array<[string, string]> = [
  ['Andhra Pradesh', 'AP'], ['Arunachal Pradesh', 'AR'], ['Assam', 'AS'], ['Bihar', 'BR'], ['Chhattisgarh', 'CG'],
  ['Goa', 'GA'], ['Gujarat', 'GJ'], ['Haryana', 'HR'], ['Himachal Pradesh', 'HP'], ['Jharkhand', 'JH'],
  ['Karnataka', 'KA'], ['Kerala', 'KL'], ['Madhya Pradesh', 'MP'], ['Maharashtra', 'MH'], ['Manipur', 'MN'],
  ['Meghalaya', 'ML'], ['Mizoram', 'MZ'], ['Nagaland', 'NL'], ['Odisha', 'OD'], ['Punjab', 'PB'],
  ['Rajasthan', 'RJ'], ['Sikkim', 'SK'], ['Tamil Nadu', 'TN'], ['Telangana', 'TS'], ['Tripura', 'TR'],
  ['Uttar Pradesh', 'UP'], ['Uttarakhand', 'UK'], ['West Bengal', 'WB'], ['Andaman and Nicobar Islands', 'AN'],
  ['Chandigarh', 'CH'], ['Dadra and Nagar Haveli and Daman and Diu', 'DN'], ['Delhi', 'DL'],
  ['Jammu and Kashmir', 'JK'], ['Ladakh', 'LA'], ['Lakshadweep', 'LD'], ['Puducherry', 'PY'],
];

/** Cities offered at sign-up, keyed by state code. Chhattisgarh: all 33 districts (as of 2023). */
const CITIES_BY_STATE: Record<string, string[]> = {
  CG: [
    'Balod', 'Baloda Bazar-Bhatapara', 'Balrampur-Ramanujganj', 'Bastar', 'Bemetara', 'Bijapur', 'Bilaspur',
    'Dantewada', 'Dhamtari', 'Durg', 'Gariaband', 'Gaurela-Pendra-Marwahi', 'Janjgir-Champa', 'Jashpur',
    'Kabirdham', 'Kanker', 'Khairagarh-Chhuikhadan-Gandai', 'Kondagaon', 'Korba', 'Koriya', 'Mahasamund',
    'Manendragarh-Chirmiri-Bharatpur', 'Mohla-Manpur-Ambagarh Chowki', 'Mungeli', 'Narayanpur', 'Raigarh',
    'Raipur', 'Rajnandgaon', 'Sakti', 'Sarangarh-Bilaigarh', 'Sukma', 'Surajpur', 'Surguja',
  ],
};

const PRODUCTS: Array<[string, string]> = [
  ['Split AC', 'Air Conditioner'], ['Window AC', 'Air Conditioner'], ['Cassette AC', 'Air Conditioner'], ['Tower AC', 'Air Conditioner'],
  ['Ductable AC', 'Air Conditioner'], ['Refrigerator', 'Refrigeration'], ['Deep Freezer', 'Refrigeration'], ['Visi Cooler', 'Refrigeration'],
  ['Washing Machine', 'Home Appliance'], ['Microwave', 'Home Appliance'], ['Water Cooler', 'Home Appliance'], ['Water Dispenser', 'Home Appliance'],
  ['Geyser', 'Home Appliance'], ['Kitchen Chimney', 'Home Appliance'], ['Other', 'Other'],
];

const SKILLS = ['AC Installation', 'AC Servicing', 'AC Repair', 'Gas Charging', 'PCB Repair', 'Compressor Repair', 'Refrigeration', 'Electrical', 'Washing Machine', 'Home Appliances', 'Commercial HVAC', 'Copper Piping'];

const CATEGORIES: Array<{ name: string; icon: string; description: string }> = [
  { name: 'Air Conditioning', icon: 'air-vent', description: 'Complete air-conditioner care for homes and offices.' },
  { name: 'AC Installation', icon: 'wrench', description: 'Professional installation, uninstallation and relocation.' },
  { name: 'AC Repairing', icon: 'settings', description: 'Diagnosis and repair by trained technicians.' },
  { name: 'AC Maintenance', icon: 'shield-check', description: 'Servicing and deep cleaning for efficient cooling.' },
  { name: 'Refrigeration', icon: 'refrigerator', description: 'Refrigerator and deep freezer repairs.' },
  { name: 'Electrical Services', icon: 'zap', description: 'Electrical repairs and wiring.' },
  { name: 'Home Appliances', icon: 'washing-machine', description: 'Washing machine, microwave, geyser and more.' },
  { name: 'Commercial HVAC', icon: 'building-2', description: 'HVAC solutions for commercial spaces.' },
  { name: 'Other Services', icon: 'sparkles', description: 'Other service requests.' },
];

type S = [code: string, name: string, category: string, type: PricingType, price: number, minutes: number, skills: string[], reminder?: boolean, popular?: boolean];

const SERVICES: S[] = [
  ['SAC-INST', 'Split AC Installation', 'AC Installation', 'STARTING', 1499, 120, ['AC Installation', 'Copper Piping'], false, true],
  ['WAC-INST', 'Window AC Installation', 'AC Installation', 'STARTING', 799, 60, ['AC Installation']],
  ['SAC-UNIN', 'Split AC Uninstallation', 'AC Installation', 'STARTING', 699, 60, ['AC Installation']],
  ['WAC-UNIN', 'Window AC Uninstallation', 'AC Installation', 'STARTING', 499, 45, ['AC Installation']],
  ['AC-GEN-SVC', 'AC General Servicing', 'AC Maintenance', 'STARTING', 499, 60, ['AC Servicing'], true, true],
  ['AC-DEEP-CLN', 'AC Deep Cleaning', 'AC Maintenance', 'STARTING', 899, 90, ['AC Servicing'], true, true],
  ['AC-WET-SVC', 'AC Wet Servicing', 'AC Maintenance', 'STARTING', 649, 75, ['AC Servicing'], true],
  ['AC-GAS-REF', 'AC Gas Refilling', 'AC Repairing', 'STARTING', 2499, 90, ['Gas Charging'], false, true],
  ['AC-GAS-LEAK', 'AC Gas Leakage Repair', 'AC Repairing', 'QUOTATION', 0, 90, ['Gas Charging', 'AC Repair']],
  ['AC-PCB', 'AC PCB Repair', 'AC Repairing', 'QUOTATION', 0, 90, ['PCB Repair']],
  ['AC-COMP', 'AC Compressor Repair', 'AC Repairing', 'QUOTATION', 0, 120, ['Compressor Repair']],
  ['AC-FAN-MTR', 'AC Fan Motor Repair', 'AC Repairing', 'QUOTATION', 0, 90, ['AC Repair', 'Electrical']],
  ['AC-DRAIN', 'AC Drainage Cleaning', 'AC Maintenance', 'STARTING', 399, 45, ['AC Servicing']],
  ['AC-WATER-LEAK', 'AC Water Leakage Repair', 'AC Repairing', 'STARTING', 449, 60, ['AC Repair']],
  ['AC-COOLING', 'AC Cooling Problem', 'AC Repairing', 'STARTING', 349, 60, ['AC Repair'], false, true],
  ['AC-NOT-START', 'AC Not Starting', 'AC Repairing', 'STARTING', 349, 60, ['AC Repair', 'Electrical']],
  ['AC-NOISE', 'AC Noise Problem', 'AC Repairing', 'STARTING', 349, 60, ['AC Repair']],
  ['AC-ELEC', 'AC Electrical Repair', 'AC Repairing', 'STARTING', 399, 60, ['Electrical', 'AC Repair']],
  ['AC-IDU', 'AC Indoor Unit Repair', 'AC Repairing', 'QUOTATION', 0, 90, ['AC Repair']],
  ['AC-ODU', 'AC Outdoor Unit Repair', 'AC Repairing', 'QUOTATION', 0, 90, ['AC Repair']],
  ['AC-CU-INST', 'AC Copper Pipe Installation', 'AC Installation', 'STARTING', 799, 90, ['Copper Piping']],
  ['AC-CU-REPL', 'AC Copper Pipe Replacement', 'AC Installation', 'STARTING', 999, 120, ['Copper Piping', 'Gas Charging']],
  ['AC-RELOC', 'AC Relocation', 'AC Installation', 'STARTING', 1999, 180, ['AC Installation', 'Copper Piping']],
  ['AC-AMC', 'AC Annual Maintenance', 'Air Conditioning', 'QUOTATION', 0, 60, ['AC Servicing'], true],
  ['REF-REPAIR', 'Refrigerator Repair', 'Refrigeration', 'STARTING', 349, 60, ['Refrigeration'], false, true],
  ['REF-GAS', 'Refrigerator Gas Refilling', 'Refrigeration', 'STARTING', 1499, 90, ['Refrigeration', 'Gas Charging']],
  ['REF-COMP', 'Refrigerator Compressor Repair', 'Refrigeration', 'QUOTATION', 0, 120, ['Refrigeration', 'Compressor Repair']],
  ['REF-COOLING', 'Refrigerator Cooling Repair', 'Refrigeration', 'STARTING', 349, 60, ['Refrigeration']],
  ['DF-REPAIR', 'Deep Freezer Repair', 'Refrigeration', 'STARTING', 499, 90, ['Refrigeration']],
  ['WM-REPAIR', 'Washing Machine Repair', 'Home Appliances', 'STARTING', 349, 60, ['Washing Machine'], false, true],
  ['MW-REPAIR', 'Microwave Repair', 'Home Appliances', 'STARTING', 299, 45, ['Home Appliances']],
  ['WC-REPAIR', 'Water Cooler Repair', 'Home Appliances', 'STARTING', 349, 60, ['Home Appliances', 'Refrigeration']],
  ['WD-REPAIR', 'Water Dispenser Repair', 'Home Appliances', 'STARTING', 349, 60, ['Home Appliances']],
  ['GEY-REPAIR', 'Geyser Repair', 'Home Appliances', 'STARTING', 299, 45, ['Home Appliances', 'Electrical']],
  ['CHM-REPAIR', 'Kitchen Chimney Repair', 'Home Appliances', 'STARTING', 399, 60, ['Home Appliances']],
  ['ELEC-REPAIR', 'Electrical Repair', 'Electrical Services', 'STARTING', 199, 45, ['Electrical']],
];

async function main() {
  // Permissions
  for (const [module, actions] of Object.entries(MODULE_ACTIONS)) {
    for (const action of actions) {
      const code = `${module}.${action}`;
      await prisma.permission.upsert({ where: { code }, create: { code, module, action }, update: {} });
    }
  }
  const perms = await prisma.permission.findMany();

  // Roles (system roles keep their default permission set in sync)
  for (const code of Object.values(RoleCodes)) {
    const role = await prisma.role.upsert({
      where: { code },
      create: { code, name: ROLE_LABELS[code], isSystem: true },
      update: { name: ROLE_LABELS[code], isSystem: true },
    });
    const wanted = perms.filter((p) => DEFAULT_ROLE_PERMISSIONS[code].includes(p.code));
    const existing = await prisma.rolePermission.count({ where: { roleId: role.id } });
    if (existing === 0 && wanted.length) {
      await prisma.rolePermission.createMany({ data: wanted.map((p) => ({ roleId: role.id, permissionId: p.id })), skipDuplicates: true });
    }
  }

  // Super Admin
  const superRole = await prisma.role.findUniqueOrThrow({ where: { code: RoleCodes.SUPER_ADMIN } });
  const existingAdmin = await prisma.user.findFirst({ where: { OR: [{ email: config.seed.adminEmail }, { mobile: config.seed.adminMobile }] } });
  if (!existingAdmin) {
    if (!config.seed.adminPassword) throw new Error('SEED_ADMIN_PASSWORD is required to create the first Super Admin');
    const admin = await prisma.user.create({
      data: {
        name: 'Super Admin',
        email: config.seed.adminEmail,
        mobile: config.seed.adminMobile,
        userType: 'ADMIN',
        passwordHash: await bcrypt.hash(config.seed.adminPassword, config.security.bcryptRounds),
      },
    });
    await prisma.userRole.create({ data: { userId: admin.id, roleId: superRole.id } });
    console.log(`Created Super Admin: ${config.seed.adminEmail}`);
  }

  // Settings & templates
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.companySetting.upsert({ where: { key }, create: { key, value: value as object }, update: {} });
  }
  for (const t of DEFAULT_TEMPLATES) {
    for (const channel of ['IN_APP', 'PUSH', 'EMAIL', 'WHATSAPP'] as const) {
      await prisma.notificationTemplate.upsert({
        where: { eventType_channel: { eventType: t.eventType, channel } },
        create: { eventType: t.eventType, channel, subject: t.title, body: t.body },
        update: {},
      });
    }
  }

  // Master data
  for (const [name, code] of STATES) await prisma.state.upsert({ where: { code }, create: { name, code }, update: {} });
  for (const [stateCode, cities] of Object.entries(CITIES_BY_STATE)) {
    const state = await prisma.state.findUniqueOrThrow({ where: { code: stateCode } });
    for (const name of cities) {
      await prisma.city.upsert({ where: { stateId_name: { stateId: state.id, name } }, create: { stateId: state.id, name }, update: {} });
    }
  }
  for (const [i, [name, category]] of PRODUCTS.entries()) await prisma.product.upsert({ where: { name }, create: { name, category, sortOrder: i }, update: {} });
  for (const name of SKILLS) await prisma.skill.upsert({ where: { name }, create: { name }, update: {} });
  const skills = await prisma.skill.findMany();

  // Catalogue
  for (const [i, c] of CATEGORIES.entries()) {
    await prisma.serviceCategory.upsert({ where: { name: c.name }, create: { ...c, slug: slugify(c.name), sortOrder: i }, update: {} });
  }
  const cats = await prisma.serviceCategory.findMany();
  for (const [i, [code, name, category, pricingType, price, minutes, skillNames, reminder, popular]] of SERVICES.entries()) {
    if (await prisma.service.findUnique({ where: { code } })) continue;
    const s = await prisma.service.create({
      data: {
        code,
        name,
        categoryId: cats.find((c) => c.name === category)!.id,
        pricingType,
        basePrice: price,
        durationMinutes: minutes,
        gstApplicable: true,
        gstRate: 18,
        reminderEligible: !!reminder,
        isPopular: !!popular,
        sortOrder: i,
        description: `${name} by trained Local Air Solutions technicians.`,
      },
    });
    await prisma.servicePricing.create({ data: { serviceId: s.id, price } });
    const ids = skills.filter((k) => skillNames.includes(k.name)).map((k) => ({ serviceId: s.id, skillId: k.id }));
    if (ids.length) await prisma.serviceSkill.createMany({ data: ids });
  }
  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
