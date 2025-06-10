import { object, string } from "valibot"
import { createSubjects } from "@openauthjs/openauth/subject"

// TODO: centralize this between auth and api package
export const subjects = createSubjects({
  user: object({
    id: string(),
    email: string(),
    name: string(),
  }),
})
