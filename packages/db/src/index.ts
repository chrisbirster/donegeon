import { getDb } from "./util/api.js";
import { sha256Hex } from "./util/hash.js";
import { tasks, users } from "./db/schema.js"
import type { Task, NewTask, User, NewUser } from "./types.js";
import {
  createTaskSchema, createUserSchema, patchTaskSchema
} from "./types.js";
import { getOrCreateUser } from "./users.js";

export { tasks as taskSchema, users as userSchema }

export type { Task, NewTask, User, NewUser }
export { getDb, sha256Hex, getOrCreateUser, createTaskSchema, patchTaskSchema, createUserSchema }
