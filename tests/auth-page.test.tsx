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

describe("sign-in and recovery failures", () => {
  it("keeps the sign-in form after an incorrect password", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      error: { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password" },
    });
    const user = userEvent.setup();
    render(<AuthPage />);
    await user.type(screen.getByLabelText("Email"), "member@example.com");
    await user.type(screen.getByLabelText("Mot de passe"), "Wrong-password-42");
    await user.click(screen.getByRole("button", { name: "Se connecter" }));
    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("Email ou mot de passe incorrect."),
    );
    expect(screen.queryByText("Renvoyer l’email de confirmation")).toBeNull();
    expect(screen.getByText("Mot de passe oublié ?")).toBeTruthy();
  });

  it("opens confirmation only for an unverified address", async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: { code: "EMAIL_NOT_VERIFIED" } });
    const user = userEvent.setup();
    render(<AuthPage />);
    await user.type(screen.getByLabelText("Email"), "member@example.com");
    await user.type(screen.getByLabelText("Mot de passe"), "Correct-password-42");
    await user.click(screen.getByRole("button", { name: "Se connecter" }));
    expect(await screen.findByText("Renvoyer l’email de confirmation")).toBeTruthy();
  });

  it("reenables confirmation sending after a network failure", async () => {
    mocks.resend.mockRejectedValueOnce(new Error("offline"));
    const user = userEvent.setup();
    render(<AuthPage />);
    await user.click(screen.getByText("Email de confirmation non reçu ?"));
    await user.type(screen.getByLabelText("Email"), "member@example.com");
    await user.click(screen.getByRole("button", { name: "Renvoyer le lien" }));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalled());
    expect(
      (screen.getByRole("button", { name: "Renvoyer le lien" }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it("does not announce a reset email when sending fails", async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({ error: { message: "delivery failed" } });
    const user = userEvent.setup();
    render(<AuthPage />);
    await user.click(screen.getByText("Mot de passe oublié ?"));
    await user.type(screen.getByLabelText("Mot de passe oublié"), "member@example.com");
    await user.click(screen.getByRole("button", { name: "Envoyer le lien" }));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalled());
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(
      (screen.getByRole("button", { name: "Envoyer le lien" }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });
});
