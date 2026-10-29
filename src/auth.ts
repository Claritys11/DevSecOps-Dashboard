import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import argon2 from "argon2";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/server/services/rate-limit-service";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const authConfig = {
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 8
  },
  trustHost: true,
  pages: {
    signIn: "/login"
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;
        if (!checkRateLimit(`login:${parsed.data.email.toLowerCase()}`, 10, 15 * 60_000)) return null;

        const user = await prisma.user.findFirst({
          where: { email: { equals: parsed.data.email, mode: "insensitive" } }
        });

        if (!user) return null;

        const valid = await argon2.verify(user.passwordHash, parsed.data.password);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        };
      }
    })
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "ADMIN" | "MAINTAINER" | "VIEWER";
      }
      return session;
    }
  }
} satisfies NextAuthConfig;

export const { handlers, signIn, signOut, auth } = NextAuth(authConfig);
