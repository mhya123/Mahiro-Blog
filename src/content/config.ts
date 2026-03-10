import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const blog = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updated: z.coerce.date().optional(),
    image: z.string().optional(),
    badge: z.string().optional(),
    draft: z.boolean().default(false),
    encrypted: z.boolean().default(false),
    categories: z
      .array(z.string())
      .refine((items) => new Set(items).size === items.length, {
        message: "categories must be unique",
      })
      .optional(),
    tags: z
      .array(z.string())
      .refine((items) => new Set(items).size === items.length, {
        message: "tags must be unique",
      })
      .optional(),
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: "*.json", base: "./src/data/projects" }),
  schema: z.object({
    name: z.string(),
    avatar: z.string(),
    description: z.string(),
    url: z.string().url(),
    badge: z.string().optional(),
    tags: z.array(z.string()).optional(),
    author: z.string().optional(),
    github: z.string().url().optional(),
  }),
});

export const collections = { blog, projects };
