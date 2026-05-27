import { authClient } from "./auth-client";

export async function signUpUser({
  email,
  password,
  confirmPassword,
  name,
  role,
  image,
}: {
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
  role: "builder" | "subcontractor" | undefined;
  image?: string;
}) {
  const errors: string[] | undefined = [];

  if (!email) errors.push("Email is required");
  if (!password || password.length < 8)
    errors.push("Password must be at least 8 characters");
  if (!name) errors.push("Name is required");
  if (password !== confirmPassword) errors.push("Passwords do not match");

  if (!role) {
    errors.push("Please select a user type");
    return { status: "error", errors };
  }

  if (errors.length > 0) {
    return { status: "error", errors };
  }

  const { data, error } = await authClient.signUp.email({
    email,
    password,
    name,
    image,
    role,
    callbackURL: "/dashboard",
  });

  if (error && error.message) {
    if (error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") {
      errors.push("User already exists. Use another email.");
    } else if (error.message.includes("email")) {
      errors.push("Invalid email address");
    } else {
      errors.push("Sign-up failed");
    }
  }

  if (errors.length > 0) {
    return { status: "error", errors };
  }

  return { status: "success", data };
}
