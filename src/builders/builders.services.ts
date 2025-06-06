import { Effect as E, pipe } from "effect";
import {
  type CollectionNotFoundError,
  type DatabaseError,
  type DocumentNotFoundError,
  DuplicateEntryError,
} from "#/common/errors";
import type { Did } from "#/common/types";
import type { AppBindings } from "#/env";
import * as BuilderRepository from "./builders.repository";
import type {
  BuilderDocument,
  CreateBuilderCommand,
  UpdateProfileCommand,
} from "./builders.types";

/**
 * Retrieves an organisation builder by DID.
 *
 * @param ctx - Application context containing configuration and dependencies
 * @param did - Decentralised identifier of the builder to retrieve
 * @returns Effect containing the builder document or relevant errors
 */
export function find(
  ctx: AppBindings,
  did: Did,
): E.Effect<
  BuilderDocument,
  DocumentNotFoundError | CollectionNotFoundError | DatabaseError
> {
  return BuilderRepository.findOneOrganization(ctx, did);
}

/**
 * Creates a new organisation builder based on the provided command.
 *
 * Validates that the builder's DID differs from the node's own DID
 * before persisting to the database. Constructs the complete document
 * from the command data.
 *
 * @param ctx - Application context containing configuration and dependencies
 * @param command - Create builder command with DID and name
 * @returns Effect indicating success or relevant errors
 */
export function createBuilder(
  ctx: AppBindings,
  command: CreateBuilderCommand,
): E.Effect<
  void,
  DuplicateEntryError | CollectionNotFoundError | DatabaseError
> {
  return pipe(
    E.succeed(command),
    E.filterOrFail(
      (cmd) => cmd.did !== ctx.node.keypair.toDidString(),
      (cmd) =>
        new DuplicateEntryError({
          document: { name: cmd.name, did: cmd.did },
        }),
    ),
    E.map((cmd) => {
      const now = new Date();
      return {
        _id: cmd.did,
        _role: "organization" as const,
        _created: now,
        _updated: now,
        name: cmd.name,
        schemas: [],
        queries: [],
      };
    }),
    E.flatMap((document) => BuilderRepository.insert(ctx, document)),
  );
}

/**
 * Removes an organisation builder permanently.
 *
 * @param ctx - Application context containing configuration and dependencies
 * @param id - DID of the builder to delete
 * @returns Effect indicating success or relevant errors
 */
export function remove(
  ctx: AppBindings,
  id: Did,
): E.Effect<
  void,
  DocumentNotFoundError | CollectionNotFoundError | DatabaseError
> {
  return BuilderRepository.deleteOneById(ctx, id);
}

/**
 * Updates an organisation's profile fields based on the provided command.
 *
 * @param ctx - Application context containing configuration and dependencies
 * @param command - Update profile command with builder ID and updates
 * @returns Effect indicating success or relevant errors
 */
export function updateProfile(
  ctx: AppBindings,
  command: UpdateProfileCommand,
): E.Effect<
  void,
  DocumentNotFoundError | CollectionNotFoundError | DatabaseError
> {
  return BuilderRepository.update(ctx, command.builderId, command.updates);
}
