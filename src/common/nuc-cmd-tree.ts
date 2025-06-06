import { Command } from "@nillion/nuc";

export const NucCmd = {
  nil: {
    db: {
      admin: new Command(["nil", "db", "admin"]),
      builders: new Command(["nil", "db", "builders"]),
      data: new Command(["nil", "db", "data"]),
      schemas: new Command(["nil", "db", "schemas"]),
      queries: new Command(["nil", "db", "queries"]),
      user: new Command(["nil", "db", "user"]),
    },
  },
} as const;
