import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        username: { label: "Usuario", type: "text" },
        password: { label: "Contrasena", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          console.log("[auth] Missing credentials");
          return null;
        }

        const username = credentials.username as string;
        const password = credentials.password as string;

        console.log("[auth] Login attempt for:", username);

        const user = await prisma.user.findUnique({
          where: { username },
        });

        if (!user) {
          console.log("[auth] User not found:", username);
          return null;
        }

        const isValid = await bcrypt.compare(password, user.hashedPassword);
        console.log("[auth] Password valid:", isValid);
        if (!isValid) return null;

        return {
          id: user.id,
          name: user.username,
        };
      },
    }),
  ],
  trustHost: true,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
});
