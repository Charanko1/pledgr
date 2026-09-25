export interface Profile {
  _id: string;
  name: string;
  email: string;
  role: string;
  walletAddress: string;
  walletVerifiedAt?: string | null;
}
