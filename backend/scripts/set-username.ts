import { prisma } from "../src/db";
const [email, username] = process.argv.slice(2);
(async () => {
  const u = await prisma.user.update({ where: { email }, data: { username } });
  console.log("ok:", u.email, "->", u.username);
})().finally(() => prisma.$disconnect());
