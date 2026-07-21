export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

export function getErrorMessage(error: unknown): string {
  // Pass through specific backend messages meant for users
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) {
      return error.message;
    }
  }

  // Handle network/fetch failures
  if (error instanceof TypeError && error.message.toLowerCase().includes("fetch")) {
    return "Something went wrong. Please check your connection and try again.";
  }

  // Handle JSON parse failures or non-JSON responses
  if (error instanceof SyntaxError) {
    return "Something went wrong. Please check your connection and try again.";
  }

  // Everything else / unknown
  return "Something unexpected happened. Please try again.";
}
