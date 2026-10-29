import { z } from "zod";

export const dockerAccessSchema = z
  .object({
    dockerAccess: z.enum(["none", "local", "remote"]).default("none"),
    dockerEndpoint: z
      .string()
      .trim()
      .optional()
      .refine((value) => !value || /^(tcp:\/\/|unix:\/\/|\/)/.test(value), "Use tcp://host:2375 or a socket path")
  })
  .refine((value) => value.dockerAccess !== "remote" || Boolean(value.dockerEndpoint), {
    message: "Enter the Docker API address for remote access",
    path: ["dockerEndpoint"]
  });
