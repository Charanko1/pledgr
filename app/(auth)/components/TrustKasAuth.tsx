"use client";

import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Asterisk, Eye, EyeOff } from "lucide-react";
import { saveSession } from "@/lib/session";
import { useRegister } from "../register/hooks/useRegister";
import styles from "./TrustKasAuth.module.css";

function AuthShell({ mode, children }: { mode: "login" | "register"; children: ReactNode }) {
  const isRegister = mode === "register";
  const otherRoute = isRegister ? "/login" : "/register";

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <Link href="/login" className={styles.brand} aria-label="PLEDGR home">
          <span className={styles.brandMark} aria-hidden="true">p<ArrowUpRight size={17} /></span>
          PLEDGR<span className={styles.purple}>.</span>
        </Link>
        <span className={styles.headerNote}>SMALL PLEDGES. BIG POSSIBILITIES.</span>
        <div className={styles.headerAction}>
          <span>{isRegister ? "Already part of the crew?" : "New to the crew?"}</span>
          <Link href={otherRoute}>{isRegister ? "Log in" : "Join PLEDGR"}<ArrowUpRight size={18} aria-hidden="true" /></Link>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.story} aria-label="The PLEDGR community">
          <div className={styles.eyebrow}><Asterisk size={27} aria-hidden="true" />GOOD IDEAS DESERVE A TEAM.</div>
          <h2 className={styles.headline}>Big impact.<br />Starts with<br /><span className={styles.you}>you.<ArrowUpRight aria-hidden="true" /></span></h2>
          <p className={styles.intro}>Back the ideas you believe in.<br />Build something bigger, together.</p>
          <div className={styles.communityCard}>
            <div className={styles.cardTop}><span>THE COMMUNITY EFFECT</span><Asterisk size={28} aria-hidden="true" /></div>
            <p>A little from each of us.<br /><strong>A lot of good, together.</strong></p>
            <div className={styles.blocks} aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <span key={i} />)}</div>
            <div className={styles.cardBottom}><span>Every pledge counts.</span><span>Including yours. ↗</span></div>
          </div>
          <p className={styles.sideCaption}>COMMUNITY POWERED. BLOCKCHAIN BACKED.</p>
        </section>

        <section className={styles.formSide} aria-labelledby="auth-heading">
          <div className={styles.formWrap}>
            <nav className={styles.viewSwitch} aria-label="Account navigation">
              <Link href="/login" aria-current={!isRegister ? "page" : undefined}>Log in</Link>
              <Link href="/register" aria-current={isRegister ? "page" : undefined}>Sign up</Link>
            </nav>
            <div className={styles.formHeading}>
              <p className={styles.kicker}>{isRegister ? "JOIN THE GOOD" : "YOUR NEXT CHAPTER"}</p>
              <h1 id="auth-heading">{isRegister ? <>Good starts<br />with you<span className={styles.purple}>.</span></> : <>Hey, welcome<br />back<span className={styles.purple}>!</span></>}</h1>
              <p>{isRegister ? "Join the crew. Bring good ideas to life." : "Your next little act of good starts here."}</p>
            </div>
            {children}
            <p className={styles.switchCaption}>{isRegister ? "Already have an account?" : "First time here?"}{" "}<Link href={otherRoute}>{isRegister ? "Log in" : "Join the community"}</Link></p>
            <div className={styles.formFoot}><Asterisk size={20} aria-hidden="true" />A little kindness. A collective superpower.</div>
          </div>
        </section>
      </main>
      <footer className={styles.footer}><span>© {new Date().getFullYear()} PLEDGR</span><span>GOOD PEOPLE. GOOD IDEAS. REAL IMPACT.</span></footer>
    </div>
  );
}

function PasswordField({ value, onChange, isRegister = false, disabled, id = "password", label = "Password", placeholder, autoComplete }: {
  value: string;
  onChange: (value: string) => void;
  isRegister?: boolean;
  disabled: boolean;
  id?: string;
  label?: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <div className={styles.passwordWrap}>
        <input id={id} name={id} type={visible ? "text" : "password"} autoComplete={autoComplete || (isRegister ? "new-password" : "current-password")} placeholder={placeholder || (isRegister ? "Create your password" : "Enter your password")} value={value} onChange={(event) => onChange(event.target.value)} required disabled={disabled} />
        <button type="button" className={styles.reveal} aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} onClick={() => setVisible(!visible)} disabled={disabled}>
          {visible ? <EyeOff size={21} aria-hidden="true" /> : <Eye size={21} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}

function SubmitButton({ loading, children }: { loading: boolean; children: ReactNode }) {
  return <button className={styles.submit} type="submit" disabled={loading}><span>{children}</span><ArrowUpRight size={24} aria-hidden="true" /></button>;
}

export function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);

  async function handleLogin() {
    if (pending.current) return;
    pending.current = true;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(typeof data.message === "string" ? data.message : "Login failed. Please try again.");
        return;
      }
      saveSession(undefined, data.user);
      router.replace("/dashboard");
    } catch {
      setError("Unable to log in. Please check your connection and try again.");
    } finally {
      pending.current = false;
      setLoading(false);
    }
  }

  return <AuthShell mode="login">
    <form onSubmit={(event) => { event.preventDefault(); void handleLogin(); }} aria-busy={loading}>
      <div className={styles.field}>
        <label htmlFor="email">Email address</label>
        <input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={loading} />
      </div>
      <PasswordField value={password} onChange={setPassword} disabled={loading} />
      {error && <p className={styles.error} role="alert">{error}</p>}
      <SubmitButton loading={loading}>{loading ? "Logging in…" : "Let’s go"}</SubmitButton>
    </form>
  </AuthShell>;
}

export function RegisterPage() {
  const { name, email, password, confirmPassword, loading, error, setName, setEmail, setPassword, setConfirmPassword, register } = useRegister();
  const pending = useRef(false);

  async function handleRegister() {
    if (pending.current) return;
    pending.current = true;
    try { await register(); } finally { pending.current = false; }
  }

  return <AuthShell mode="register">
    <form onSubmit={(event) => { event.preventDefault(); void handleRegister(); }} aria-busy={loading}>
      <div className={styles.field}>
        <label htmlFor="fullname">Full name</label>
        <input id="fullname" name="name" autoComplete="name" placeholder="What should we call you?" value={name} onChange={(event) => setName(event.target.value)} required disabled={loading} />
      </div>
      <div className={styles.field}>
        <label htmlFor="email">Email address</label>
        <input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={loading} />
      </div>
      <PasswordField value={password} onChange={setPassword} isRegister disabled={loading} />
      <PasswordField value={confirmPassword} onChange={setConfirmPassword} isRegister disabled={loading} id="confirm-password" label="Confirm password" placeholder="Repeat your password" autoComplete="new-password" />
      {error && <p className={styles.error} role="alert">{error}</p>}
      <SubmitButton loading={loading}>{loading ? "Creating your account…" : "Create my account"}</SubmitButton>
    </form>
  </AuthShell>;
}
