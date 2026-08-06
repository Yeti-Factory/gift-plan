// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resend: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: { component: React.ComponentType }) => ({ options }),
  useNavigate: () => mocks.navigate,
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/lib/self-hosted/auth-client", () => ({
  authClient: {
    getSession: vi.fn().mockResolvedValue({ data: null }),
    signIn: { email: mocks.signInWithPassword, social: vi.fn() },
    signUp: { email: mocks.signUp },
    sendVerificationEmail: mocks.resend,
    requestPasswordReset: mocks.resetPasswordForEmail,
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
  },
}));

vi.mock("@/components/BrandMark", () => ({ BrandMark: () => null }));
vi.mock("@/components/PoweredByYetiLab", () => ({ PoweredByYetiLab: () => null }));

import { Route } from "@/routes/auth";

const AuthPage = (Route as unknown as { options: { component: React.ComponentType } }).options
  .component;

beforeEach(() => {
  mocks.navigate.mockReset();
  mocks.signInWithPassword.mockReset();
  mocks.signUp.mockReset();
  mocks.resend.mockReset();
  mocks.resetPasswordForEmail.mockReset();
  mocks.toastError.mockReset();
  mocks.toastSuccess.mockReset();
  mocks.signUp.mockResolvedValue({ data: { token: null }, error: null });
});

afterEach(cleanup);

async function openSignupForm() {
  const user = userEvent.setup();
  render(<AuthPage />);
  await user.click(screen.getByRole("tab", { name: "Créer un compte" }));
  return user;
}

function signupForm(): HTMLFormElement {
  const button = screen.getByRole("button", { name: "Créer mon compte" });
  const form = button.closest("form");
  if (!form) throw new Error("Signup form not found");
  return form;
}

describe("account creation form", () => {
  it("submits the password value currently present in the DOM after autofill", async () => {
    const user = await openSignupForm();
    await user.type(screen.getByLabelText("Nom"), "Marie Dupont");
    await user.type(screen.getByLabelText("Email"), "marie@example.com");

    const passwordInput = screen.getByLabelText("Mot de passe") as HTMLInputElement;
    const nativeValueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    nativeValueSetter?.call(passwordInput, "Autofill-Secret-42");

    fireEvent.submit(signupForm());

    await waitFor(() => expect(mocks.signUp).toHaveBeenCalledTimes(1));
    expect(mocks.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "marie@example.com",
        password: "Autofill-Secret-42",
      }),
    );
  });

  it("blocks only passwords that are actually shorter than eight characters", async () => {
    const user = await openSignupForm();
    await user.type(screen.getByLabelText("Nom"), "Marie Dupont");
    await user.type(screen.getByLabelText("Email"), "marie@example.com");
    await user.type(screen.getByLabelText("Mot de passe"), "abcde");

    fireEvent.submit(signupForm());

    expect(mocks.signUp).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Mot de passe trop court (8 caractères minimum).",
    );
  });

  it("shows a weakness warning instead of a false length warning", async () => {
    mocks.signUp.mockResolvedValueOnce({
      data: null,
      error: { message: "Password is too weak and easy to guess" },
    });
    const user = await openSignupForm();
    await user.type(screen.getByLabelText("Nom"), "Marie Dupont");
    await user.type(screen.getByLabelText("Email"), "marie@example.com");
    await user.type(screen.getByLabelText("Mot de passe"), "password123");

    fireEvent.submit(signupForm());

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Mot de passe trop faible. Ajoute des lettres, chiffres et symboles.",
      ),
    );
  });

  it("opens the confirmation screen after a successful signup", async () => {
    const user = await openSignupForm();
    await user.type(screen.getByLabelText("Nom"), "Marie Dupont");
    await user.type(screen.getByLabelText("Email"), "marie@example.com");
    await user.type(screen.getByLabelText("Mot de passe"), "Correct-Secret-42");

    fireEvent.submit(signupForm());

    expect(await screen.findByText("Renvoyer l’email de confirmation")).toBeTruthy();
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("marie@example.com");
    expect(mocks.toastSuccess).toHaveBeenCalled();
  });

  it("does not hide a confirmation-email delivery failure", async () => {
    mocks.signUp.mockResolvedValueOnce({
      data: null,
      error: { message: "Error sending confirmation email" },
    });
    const user = await openSignupForm();
    await user.type(screen.getByLabelText("Nom"), "Marie Dupont");
    await user.type(screen.getByLabelText("Email"), "marie@example.com");
    await user.type(screen.getByLabelText("Mot de passe"), "Correct-Secret-42");

    fireEvent.submit(signupForm());

    expect(await screen.findByText("Renvoyer l’email de confirmation")).toBeTruthy();
    expect(mocks.toastError).toHaveBeenCalledWith(
      expect.stringContaining("l’email de confirmation n’a pas pu être envoyé"),
      { duration: 10000 },
    );
  });
});
