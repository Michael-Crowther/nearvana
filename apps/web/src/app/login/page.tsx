"use client";
import { ChangeEventHandler, ComponentType, useState } from "react";
import Image from "next/image";
import { signInUser, signUpUser } from "@nearvana/auth";
import { Card } from "@nearvana/ui/components/card";
import { cn } from "@nearvana/ui/lib/utils";
import { Hammer, Lock, Mail, User } from "lucide-react";
import { Checkbox } from "@nearvana/ui/components/checkbox";
import { Label } from "@nearvana/ui/components/label";
import { Button } from "@nearvana/ui/components/button";
import { BeatLoader } from "react-spinners";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nearvana/ui/components/select";
import { Input } from "@nearvana/ui/components/input";
import { toast } from "@nearvana/ui/components/sonner";

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);

  return (
    <div className="min-h-dvh flex flex-col justify-center w-full p-5 bg-center items-center">
      <Image
        src="/login-background.png"
        alt=""
        fill
        className="object-cover -z-10"
        priority
      />
      <div className="flex flex-col items-start">
        {/* <Image
          src={LogoIdea}
          alt="nearvana Logo"
          width="200"
          height="200"
          className="ml-6"
        /> */}
        <Card
          style={{
            boxShadow:
              "0 12px 40px 0 rgba(0,0,0,0.85), 0 2px 8px 0 rgba(0,0,0,0.5)",
          }}
          className={cn(
            "rounded-xl h-123 sm:min-w-110 min-w-90 max-w-110 w-full flex-row mt-5",
            isSignUp && "h-136",
          )}
        >
          <section className="w-full p-10 pt-5 h-full">
            <div className="h-full">
              {isSignUp ? (
                <SignUpForm
                  onSuccess={() => {
                    setIsSignUp(false);
                    toast.success("Your account was successfully created!", {
                      style: { color: "green" },
                    });
                  }}
                  goBack={() => setIsSignUp(false)}
                />
              ) : (
                <SignInForm
                  goToSignUp={() => {
                    setIsSignUp(true);
                  }}
                />
              )}
            </div>
          </section>
        </Card>
      </div>
    </div>
  );
}

type SignInFormProps = {
  goToSignUp: () => void;
};

function SignInForm({ goToSignUp }: SignInFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<string[] | undefined>();
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const res = await signInUser(email, password, rememberMe);
    if (res && "error" in res) {
      setErrors([res.error]);
    }

    setLoading(false);
  };
  return (
    <div className="h-full">
      <p className="text-[35px] font-extrabold mb-1">Welcome Back!</p>
      <p className="text-muted-foreground">Please log in to your account.</p>
      <p
        className={cn(
          "text-destructive/80 text-xs transition-opacity duration-200 mt-2 font-semibold",
          !errors && "opacity-0",
        )}
      >
        Invalid email or password
      </p>

      <form onSubmit={onSubmit} className="flex flex-col gap-2 mt-2">
        <CustomInput
          Icon={User}
          type="email"
          id="email"
          placeholder="Enter your email"
          onChange={(e) => setEmail(e.target.value)}
        />

        <CustomInput
          Icon={Lock}
          id="password"
          type="password"
          placeholder="Enter your password"
          onChange={(e) => setPassword(e.target.value)}
        />

        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center space-x-1">
            <Checkbox
              id="rememberMe"
              checked={rememberMe}
              onCheckedChange={(checked: boolean) =>
                setRememberMe(checked === true)
              }
              className="shadow z-10"
            />
            <Label htmlFor="rememberMe" className="text-muted-foreground">
              Remember Me
            </Label>
          </div>
          <Button
            variant="link"
            className="p-0 z-10"
            //   onClick={handleForgotPassword}
          >
            Forgot Password?
          </Button>
        </div>

        <div className="flex gap-2 flex-col mt-2">
          <Button
            className="h-10 font-bold text-md drop-shadow-lg w-full"
            type="submit"
          >
            {!loading ? `Log In` : <BeatLoader size={10} color={"white"} />}
          </Button>
          <Image
            src="/login-divider.png"
            alt="Divider"
            width={300}
            height={300}
            className="mt-6 mx-auto"
            unoptimized
            priority
          />
          <div className="flex items-center justify-center mt-2">
            <p className="text-muted-foreground">
              Don&rsquo;t have an account?
            </p>
            <Button
              className="text-primary text-md p-2 z-10"
              onClick={goToSignUp}
              disabled={loading}
              variant="link"
            >
              Sign Up
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

type SignUpFormProps = {
  onSuccess: () => void;
  goBack: () => void;
};

function SignUpForm({ onSuccess, goBack }: SignUpFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [errors, setErrors] = useState<string[] | undefined>();
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const res = await signUpUser({
      email,
      password,
      confirmPassword,
      name,
    });

    if (res && "errors" in res) {
      setErrors(res.errors);
    } else {
      onSuccess();
    }

    setLoading(false);
  };

  return (
    <div>
      <p className="text-[30px] font-bold">Create your account</p>
      <p
        className={cn(
          "text-destructive/80 text-xs transition-opacity duration-200 font-semibold",
          !errors && "opacity-0",
        )}
      >
        {errors ? errors[0] : "Error"}
      </p>
      <form onSubmit={onSubmit} className="flex flex-col gap-2 mt-2">
        <CustomInput
          Icon={User}
          id="name"
          onChange={(e) => setName(e.target.value)}
          placeholder="Full Name"
        />

        <CustomInput
          Icon={Mail}
          id="email"
          type="email"
          placeholder="Email"
          onChange={(e) => setEmail(e.target.value)}
        />

        <CustomInput
          Icon={Lock}
          id="password"
          type="password"
          placeholder="Password"
          onChange={(e) => setPassword(e.target.value)}
        />

        <CustomInput
          Icon={Lock}
          id="confirmPassword"
          type="password"
          placeholder="Confirm Password"
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        <Button
          type="submit"
          className="h-10 font-bold text-md drop-shadow-lg w-full"
        >
          {!loading ? `Sign Up` : <BeatLoader size={10} color={"white"} />}
        </Button>

        <Image
          src="/login-divider.png"
          alt="Divider"
          width={300}
          height={300}
          className="mt-6 mx-auto"
          unoptimized
        />
        <div className="flex items-center justify-center mt-2">
          <p className="text-muted-foreground">Already have an account?</p>
          <Button
            className="text-primary text-md p-2 z-10"
            onClick={goBack}
            disabled={loading}
            variant="link"
          >
            Log In
          </Button>
        </div>
      </form>
    </div>
  );
}

type CustomInputProps = {
  Icon: ComponentType<{ className?: string }>;
  type?: string;
  id: string;
  placeholder: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
};

function CustomInput({
  Icon,
  type,
  id,
  placeholder,
  onChange,
}: CustomInputProps) {
  return (
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

      <Input
        type={type}
        id={id}
        placeholder={placeholder}
        className="h-11 pl-10 text-[14px]"
        onChange={onChange}
      />
    </div>
  );
}
