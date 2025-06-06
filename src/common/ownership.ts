import { Effect as E, pipe } from "effect";
import type { UUID } from "mongodb";
import type { BuilderDocument } from "#/builders/builders.types";
import { ResourceAccessDeniedError } from "#/common/errors";
import type { UserDocument } from "#/user/user.types";

export function enforceQueryOwnership(
  builder: BuilderDocument,
  query: UUID,
): E.Effect<void, ResourceAccessDeniedError> {
  return pipe(
    E.succeed(builder.queries.some((s) => s.toString() === query.toString())),
    E.flatMap((isAuthorized) => {
      return isAuthorized
        ? E.succeed(void 0)
        : E.fail(
            new ResourceAccessDeniedError({
              type: "query",
              id: query.toString(),
              user: builder._id,
            }),
          );
    }),
  );
}

export function enforceSchemaOwnership(
  builder: BuilderDocument,
  schema: UUID,
): E.Effect<void, ResourceAccessDeniedError> {
  return pipe(
    E.succeed(builder.schemas.some((s) => s.toString() === schema.toString())),
    E.flatMap((isAuthorized) => {
      return isAuthorized
        ? E.succeed(void 0)
        : E.fail(
            new ResourceAccessDeniedError({
              type: "schema",
              id: schema.toString(),
              user: builder._id,
            }),
          );
    }),
  );
}

export function enforceDataOwnership(
  user: UserDocument,
  documentId: UUID,
  schema: UUID,
): E.Effect<void, ResourceAccessDeniedError> {
  return pipe(
    E.succeed(
      user.data.some(
        (s) =>
          s.id.toString() === documentId.toString() &&
          s.schema.toString() === schema.toString(),
      ),
    ),
    E.flatMap((isAuthorized) => {
      return isAuthorized
        ? E.succeed(void 0)
        : E.fail(
            new ResourceAccessDeniedError({
              type: "schema",
              id: documentId.toString(),
              user: user._id,
            }),
          );
    }),
  );
}
