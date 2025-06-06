import type { Did } from "#/common/types";
import type {
  GetProfileResponse,
  RegisterBuilderRequest,
  UpdateProfileRequest,
} from "./builders.dto";
import type {
  BuilderDocument,
  CreateBuilderCommand,
  UpdateProfileCommand,
} from "./builders.types";

/**
 * Transforms data between HTTP DTOs and domain models.
 *
 * Centralises all data transformations to maintain clean layer boundaries.
 * Higher layers (controllers) use these functions to convert DTOs to domain
 * models before passing them to lower layers (services).
 */
export const BuilderDataMapper = {
  /**
   * Converts a domain builder document to an API response DTO.
   *
   * Transforms dates to ISO strings and UUIDs to strings for
   * JSON serialisation compatibility.
   *
   * @param data - Organisation builder document from domain layer
   * @returns Profile response DTO for HTTP layer
   */
  toGetProfileResponse(data: BuilderDocument): GetProfileResponse {
    return {
      data: {
        _id: data._id,
        _created: data._created.toISOString(),
        _updated: data._updated.toISOString(),
        name: data.name,
        schemas: data.schemas.map((s) => s.toString()),
        queries: data.queries.map((q) => q.toString()),
      },
    };
  },

  /**
   * Converts registration request DTO to domain command.
   *
   * Handles DTO to domain command conversion at the boundary layer.
   *
   * @param dto - Registration request DTO
   * @returns Create builder domain command
   */
  toCreateBuilderCommand(dto: RegisterBuilderRequest): CreateBuilderCommand {
    return {
      did: dto.did,
      name: dto.name,
    };
  },

  /**
   * Converts update profile request DTO to domain command.
   *
   * Handles DTO to domain command conversion with builder ID at the boundary layer.
   *
   * @param dto - Update profile request DTO
   * @param builderId - Builder identifier to update
   * @returns Update profile domain command
   */
  toUpdateProfileCommand(
    dto: UpdateProfileRequest,
    builderId: Did,
  ): UpdateProfileCommand {
    return {
      builderId,
      updates: {
        _updated: new Date(),
        name: dto.name,
      },
    };
  },
};
