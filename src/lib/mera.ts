import {
  createPasskeyWithPrfOutput,
  createSecp256k1SigningSession,
  getPasskeyPrfOutput,
  isMeraError,
  type PasskeyCredentialMetadata,
  type Secp256k1SigningSession,
} from "@category-labs/mera";
import { toViemAccount } from "@category-labs/mera/viem";
import { HDKey } from "@scure/bip32";
import { entropyToMnemonic, mnemonicToSeedSync } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import type { LocalAccount } from "viem";

/**
 * Mera is DropOwn's whole account layer: a passkey's WebAuthn PRF output is the only
 * root of the account. There is no seed phrase to write down, no browser extension and
 * no custody backend. The private key is derived in this tab, lives in a Mera signing
 * session in memory, and is zeroed when the session ends. Only the credential id is
 * persisted, and it contains no key material.
 */

const CREDENTIAL_KEY = "dropown.passkey.credential";
const EVM_PATH = "m/44'/60'/0'/0/0";

export type PasskeyAccount = {
  account: LocalAccount;
  /** Zeroes the in-memory key. The account can't sign afterwards. */
  lock: () => void;
};

function readCredential(): PasskeyCredentialMetadata | undefined {
  try {
    const raw = window.localStorage.getItem(CREDENTIAL_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as PasskeyCredentialMetadata;
    return typeof parsed.credentialId === "string" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function writeCredential(credential: PasskeyCredentialMetadata) {
  try {
    window.localStorage.setItem(
      CREDENTIAL_KEY,
      JSON.stringify({ credentialId: credential.credentialId, transports: credential.transports }),
    );
  } catch {
    // Without storage the passkey still works; the browser will offer it as a discoverable credential.
  }
}

export function hasRememberedPasskey(): boolean {
  return typeof window !== "undefined" && readCredential() !== undefined;
}

/** Forget which passkey this browser used. The passkey itself stays with the authenticator. */
export function forgetPasskey() {
  try {
    window.localStorage.removeItem(CREDENTIAL_KEY);
  } catch {
    // Nothing to forget.
  }
}

/** PRF output -> BIP-39 entropy -> BIP-44 Ethereum key, following Mera's derivation recipe. */
function openSession(prfOutput: Uint8Array): PasskeyAccount {
  const seed = mnemonicToSeedSync(entropyToMnemonic(prfOutput, wordlist));
  const node = HDKey.fromMasterSeed(seed).derive(EVM_PATH);
  seed.fill(0);
  prfOutput.fill(0);
  if (!node.privateKey) throw new Error("Could not derive an account from this passkey.");

  const session: Secp256k1SigningSession = createSecp256k1SigningSession({ privateKey: node.privateKey });
  node.wipePrivateData();
  return { account: toViemAccount(session), lock: () => session.end() };
}

/** One biometric prompt: creates a new passkey and the account that belongs to it. */
export async function createPasskeyAccount(): Promise<PasskeyAccount> {
  const label = `DropOwn fan · ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  const created = await createPasskeyWithPrfOutput({
    rp: { id: window.location.hostname, name: "DropOwn" },
    user: { name: label, displayName: label },
  });
  writeCredential(created);
  return openSession(created.prfOutput);
}

/** One biometric prompt: reopens the account behind an existing passkey for this site. */
export async function unlockPasskeyAccount(): Promise<PasskeyAccount> {
  const result = await getPasskeyPrfOutput({ rpId: window.location.hostname, credential: readCredential() });
  writeCredential({ credentialId: result.credentialId });
  return openSession(result.prfOutput);
}

export function passkeyErrorMessage(error: unknown): string {
  if (isMeraError(error)) {
    switch (error.code) {
      case "PRF_UNAVAILABLE":
        return "This device's passkey provider doesn't support the PRF extension DropOwn needs. Try a current Chrome, Safari or Edge with a platform passkey.";
      case "PASSKEY_OPERATION_FAILED":
        return "The passkey prompt was cancelled or isn't available here.";
      default:
        return "Passkey sign-in failed. Please try again.";
    }
  }
  return error instanceof Error ? error.message : "Passkey sign-in failed.";
}
