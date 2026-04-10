import { validate, ValidationError as ClassValidatorError } from "class-validator";
import { plainToInstance, ClassConstructor } from "class-transformer";
import { ValidationError } from "./error.handling.middleware";

/**
 * @param cls - The Class/DTO to validate against
 * @param plain - The raw JSON data
 */
export async function validateDto<T extends object>(
  cls: ClassConstructor<T>,
  plain: object,
): Promise<T> {
  if (!cls) throw new Error("Validator received an undefined Class/DTO");
  if (!plain) throw new Error("Validator received undefined data to validate");
  // Convert plain object to instance of the specific class T
  const instance = plainToInstance(cls, plain, {
    enableImplicitConversion: true,
  });

  // Validate the instance
  const errors: ClassValidatorError[] = await validate(instance);

  if (errors.length > 0) {
    // Extract constraints and join them into a readable string
    const message = errors
      .map((error) => Object.values(error.constraints || {}).join(", "))
      .join("; ");

    throw new ValidationError(message);
  }

  return instance;
}
