import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
console.log('--- profiles ---');
console.log(await p.$queryRawUnsafe('SELECT "id","email","first_name","last_name" FROM profiles'));
console.log('--- memberships ---');
console.log(await p.$queryRawUnsafe('SELECT m."userId", m."roles", o."name" AS org FROM memberships m JOIN organizations o ON o."id" = m."organizationId"'));
await p.$disconnect();
