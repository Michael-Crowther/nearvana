import { authClient } from "./auth-client";

export async function signInUser(
  email: string,
  password: string,
  rememberMe = false
) {
  try {
    const { data, error } = await authClient.signIn.email(
      {
        email,
        password,
        callbackURL: "/dashboard",
        rememberMe,
      },
      {
        onSuccess: () => {
          window.localStorage.setItem("showWelcomeToast", "true");
        },
        // onVerificationRequired: (session: unknown) => {
        //   console.log(
        //     "Email verification required. Check your inbox.",
        //     session
        //   );
        // },
      }
    );

    if (error) {
      return { error: error.message || "Sign-in failed" };
    }

    console.log("Sign-in response data:", data);
  } catch (err) {
    console.error("Unexpected error during sign-in:", err);
  }
}
