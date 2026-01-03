export class ExitError extends Error {
  constructor(
    message: string,
    public exitCode: number = 1,
  ) {
    super(message);
    this.name = "ExitError";
  }
}

/**
 * Used for user cancellation - not an error, just a graceful exit
 */
export class ExitWarning extends Error {
  constructor(message: string = "Operation cancelled") {
    super(message);
    this.name = "ExitWarning";
  }
}
