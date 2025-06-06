import { Effect as E, pipe } from "effect";
import type {
  CreateIndexesOptions,
  Document,
  IndexSpecification,
  StrictFilter,
  UUID,
} from "mongodb";
import type { Filter } from "mongodb/lib/beta";
import {
  type CollectionNotFoundError,
  DatabaseError,
  type DataValidationError,
  DocumentNotFoundError,
  IndexNotFoundError,
  InvalidIndexOptionsError,
} from "#/common/errors";
import {
  addDocumentBaseCoercions,
  applyCoercions,
  CollectionName,
  checkCollectionExists,
  isMongoError,
  MongoErrorCode,
} from "#/common/mongo";
import type { CoercibleMap } from "#/common/types";
import type { AppBindings } from "#/env";
import type { SchemaDocument, SchemaMetadata } from "#/schemas/schemas.types";

export function addSchemaDocumentCoercions(
  coercibleMap: CoercibleMap,
): CoercibleMap {
  return addDocumentBaseCoercions(coercibleMap);
}

export function insert(
  ctx: AppBindings,
  document: SchemaDocument,
): E.Effect<void, CollectionNotFoundError | DatabaseError> {
  return pipe(
    checkCollectionExists<SchemaDocument>(
      ctx,
      "primary",
      CollectionName.Schemas,
    ),
    E.tryMapPromise({
      try: (collection) => collection.insertOne(document),
      catch: (cause) => new DatabaseError({ cause, message: "" }),
    }),
    E.as(void 0),
  );
}

export function findMany(
  ctx: AppBindings,
  filter: StrictFilter<SchemaDocument>,
): E.Effect<
  SchemaDocument[],
  CollectionNotFoundError | DatabaseError | DataValidationError
> {
  return pipe(
    E.all([
      checkCollectionExists<SchemaDocument>(
        ctx,
        "primary",
        CollectionName.Schemas,
      ),
      applyCoercions<Filter<SchemaDocument>>(
        addSchemaDocumentCoercions(filter),
      ),
    ]),
    E.tryMapPromise({
      try: ([collection, documentFilter]) =>
        collection.find(documentFilter).toArray(),
      catch: (cause) => new DatabaseError({ cause, message: "" }),
    }),
  );
}

export function findOne(
  ctx: AppBindings,
  filter: StrictFilter<SchemaDocument>,
): E.Effect<
  SchemaDocument,
  | DocumentNotFoundError
  | CollectionNotFoundError
  | DatabaseError
  | DataValidationError
> {
  return pipe(
    E.all([
      checkCollectionExists<SchemaDocument>(
        ctx,
        "primary",
        CollectionName.Schemas,
      ),
      applyCoercions<Filter<SchemaDocument>>(
        addSchemaDocumentCoercions(filter),
      ),
    ]),
    E.tryMapPromise({
      try: ([collection, documentFilter]) => collection.findOne(documentFilter),
      catch: (cause) => new DatabaseError({ cause, message: "" }),
    }),
    E.flatMap((result) =>
      result === null
        ? E.fail(
            new DocumentNotFoundError({
              collection: CollectionName.Schemas,
              filter,
            }),
          )
        : E.succeed(result),
    ),
  );
}

export function deleteOne(
  ctx: AppBindings,
  filter: StrictFilter<SchemaDocument>,
): E.Effect<
  SchemaDocument,
  | DocumentNotFoundError
  | CollectionNotFoundError
  | DatabaseError
  | DataValidationError
> {
  return pipe(
    E.all([
      checkCollectionExists<SchemaDocument>(
        ctx,
        "primary",
        CollectionName.Schemas,
      ),
      applyCoercions<Filter<SchemaDocument>>(
        addSchemaDocumentCoercions(filter),
      ),
    ]),
    E.tryMapPromise({
      try: ([collection, documentFilter]) =>
        collection.findOneAndDelete(documentFilter),
      catch: (cause) => new DatabaseError({ cause, message: "deleteOne" }),
    }),
    E.flatMap((result) =>
      result === null
        ? E.fail(
            new DocumentNotFoundError({
              collection: CollectionName.Schemas,
              filter,
            }),
          )
        : E.succeed(result),
    ),
  );
}

export function getCollectionStats(
  ctx: AppBindings,
  id: UUID,
): E.Effect<SchemaMetadata, CollectionNotFoundError | DatabaseError> {
  return pipe(
    checkCollectionExists(ctx, "data", id.toString()),
    E.flatMap((collection) =>
      E.Do.pipe(
        E.bind("timeStats", () =>
          E.tryPromise({
            try: async () => {
              const result = await collection
                .aggregate([
                  {
                    $group: {
                      _id: null,
                      firstWrite: { $min: "$_created" },
                      lastWrite: { $max: "$_created" },
                    },
                  },
                ])
                .toArray();

              if (result.length === 0) {
                return {
                  firstWrite: new Date(0),
                  lastWrite: new Date(0),
                };
              }

              const { firstWrite, lastWrite } = result[0];

              return {
                firstWrite,
                lastWrite,
              };
            },
            catch: (cause) =>
              new DatabaseError({ cause, message: "Failed to get writes" }),
          }),
        ),
        E.bind("indexes", () =>
          E.tryPromise({
            try: async () => {
              const result = await collection.indexes();
              return result.map((index) => ({
                v: index.v ?? -1,
                key: index.key,
                name: index.name ?? "",
                unique: index.unique ?? false,
              }));
            },
            catch: (cause) =>
              new DatabaseError({ cause, message: "Failed to get indexes" }),
          }),
        ),
        E.bind("counts", () =>
          E.tryPromise({
            try: async () => {
              type CollStats = { count: number; size: number };
              const result = await collection
                .aggregate<CollStats>([
                  {
                    $collStats: {
                      storageStats: {},
                    },
                  },
                  {
                    $project: {
                      count: "$storageStats.count",
                      size: "$storageStats.size",
                    },
                  },
                ])
                .toArray();
              const stats = result[0];

              return {
                count: stats.count,
                size: stats.size,
              };
            },
            catch: (cause) =>
              new DatabaseError({ cause, message: "Failed to get counts" }),
          }),
        ),
      ),
    ),
    E.map(({ timeStats, indexes, counts }) => {
      return {
        id,
        ...timeStats,
        ...counts,
        indexes,
      };
    }),
  );
}

export function createIndex(
  ctx: AppBindings,
  schema: UUID,
  specification: IndexSpecification,
  options: CreateIndexesOptions,
): E.Effect<
  string,
  CollectionNotFoundError | InvalidIndexOptionsError | DatabaseError
> {
  return pipe(
    checkCollectionExists(ctx, "primary", schema.toString()),
    E.tryMapPromise({
      try: (collection) => collection.createIndex(specification, options),
      catch: (cause) => {
        if (
          isMongoError(cause) &&
          cause.code === MongoErrorCode.CannotCreateIndex
        ) {
          return new InvalidIndexOptionsError({
            collection: schema.toString(),
            message: cause.message,
          });
        }
        return new DatabaseError({ cause, message: "Failed to drop index" });
      },
    }),
  );
}

export function dropIndex(
  ctx: AppBindings,
  schema: UUID,
  name: string,
): E.Effect<
  Document,
  CollectionNotFoundError | IndexNotFoundError | DatabaseError
> {
  return pipe(
    checkCollectionExists(ctx, "primary", schema.toString()),
    E.tryMapPromise({
      try: (collection) => collection.dropIndex(name),
      catch: (cause) => {
        if (
          isMongoError(cause) &&
          cause.code === MongoErrorCode.IndexNotFound
        ) {
          return new IndexNotFoundError({
            collection: schema.toString(),
            index: name,
          });
        }
        return new DatabaseError({ cause, message: "Failed to drop index" });
      },
    }),
  );
}
