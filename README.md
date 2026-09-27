# PLEDGR

> **Small pledges. Big possibilities.**

**Language / Bahasa:** [English](#english) | [Bahasa Indonesia](#bahasa-indonesia)

---

# English

PLEDGR is a **blockchain-based crowdfunding platform** built for organizations and communities.

PLEDGR helps communities run fundraising campaigns through a structured process:
**create a proposal → review → activate campaign → receive BOT donations → withdraw funds with approval**.

## 🎯 The Problem

Community fundraising often faces several challenges:

- approval processes are still handled manually;
- it can be difficult to verify who is authorized to approve funds;
- transaction history is not always transparent;
- fund withdrawal may depend too heavily on trust in a single manager.

**PLEDGR** addresses these challenges by combining:

**Role-based approval + database management + blockchain + wallet verification.**

## 💡 How PLEDGR Works

```text
User
  ↓
Organization / Group
  ↓
Create Proposal
  ↓
Admin / Validator Review
  ↓
Proposal Approved
  ↓
Campaign Created on BOT Chain
  ↓
Donors Send BOT
  ↓
Funds Can Be Withdrawn After Approval
```

The blockchain acts as the source of truth for **campaign balances and fund movements**, while the database manages users, organizations, proposals, roles, and application history.

## ✨ Key Features

### 👤 User & Authentication

- Register and log in using email/password.
- JWT is stored in an **HttpOnly cookie**.
- Wallet ownership can be verified through a MetaMask signature.

### 🏢 Organization & Group Management

- Create and join organizations.
- Create groups within an organization.
- Manage members and join requests.
- Group roles:
  - **Admin**
  - **Validator**
  - **Member**

### 📋 Proposal & Approval

- Create crowdfunding proposals.
- Proposals go through role-based review.
- Approval rules are stored with the proposal, so later role changes do not automatically change the rules of an existing proposal.

### ⛓️ Blockchain Crowdfunding

- Uses native **BOT** on BOT Chain.
- Campaigns are stored in a smart contract.
- Donors send BOT directly to the campaign.
- Balances and transactions can be verified on-chain.

### 💰 Withdrawal & Refund

- Creators can request a specific withdrawal amount.
- Withdrawals require approval from authorized reviewers.
- Donors can request refunds when a campaign is cancelled.
- Campaigns also support an ending mechanism for fundraising.

### 🔄 Realtime Updates

- Application data is updated using React Query.
- Blockchain events are monitored using ethers.
- On-chain changes are synchronized back into the application.

## 🔐 Roles & Approval

| Creator | Approval |
|---|---|
| Admin | Validator |
| Validator | Admin / Another Validator |
| Member | Admin + Validator |

> The exact approval rule can vary depending on the active validators in the group.

The goal is to ensure that **fund withdrawal does not depend only on the creator**.

## ⛓️ Blockchain V2

The main smart contract is located at:

```text
contracts/PledgrTreasuryV2.sol
```

PLEDGR V2 uses **EIP-712 typed signatures** for authorization.

In simple terms:

```text
Creator requests withdrawal
        ↓
Reviewer signs the request
        ↓
Smart contract verifies the signature
        ↓
Approved amount is released
```

Each withdrawal request includes:

- `requestId`
- approved amount
- campaign nonce
- signature expiration time

This helps prevent unauthorized changes to the withdrawal amount and replaying an old approval.

## 🏗️ Simple Architecture

```text
                ┌───────────────┐
                │   Next.js UI  │
                └───────┬───────┘
                        │
                ┌───────▼───────┐
                │   API Routes  │
                └───────┬───────┘
                    ┌───┴────┐
                    ▼        ▼
              ┌─────────┐  ┌──────────────┐
              │ MongoDB │  │  BOT Chain   │
              └─────────┘  │Smart Contract│
                           └──────┬───────┘
                                  │
                              MetaMask
```

### Component Responsibilities

| Component | Responsibility |
|---|---|
| **Next.js / React** | User interface and interaction |
| **API Routes** | Business logic and authorization |
| **MongoDB** | Users, organizations, proposals, roles, and history |
| **BOT Chain** | Campaign balances and fund transactions |
| **MetaMask** | Wallet connection and signatures |
| **Smart Contract** | On-chain transaction validation and execution |

## 🛠️ Tech Stack

- **Next.js 16**
- **React 19**
- **TypeScript**
- **Tailwind CSS**
- **MongoDB + Mongoose**
- **JWT + bcryptjs**
- **ethers v6**
- **MetaMask**
- **Solidity**
- **OpenZeppelin Contracts 5.4**
- **BOT Chain**

## 📁 Project Structure

```text
pledgr/
├── app/              # Pages, layouts, API routes
├── components/       # Reusable UI components
├── context/          # Wallet & blockchain realtime context
├── features/         # Dashboard, proposal, group, organization, etc.
├── lib/              # Auth, authorization, blockchain, sync, helpers
├── models/           # MongoDB/Mongoose models
├── contracts/        # Smart contract V2 + contract tooling
├── tests/             # Tests
├── types/            # TypeScript types
└── README.md
```

## 🚀 Running the Project

### 1. Clone the repository

```bash
git clone <repository-url>
cd pledgr
```

### 2. Install dependencies

```bash
npm install
cd contracts
npm install
cd ..
```

### 3. Configure environment variables

Create `.env.local` based on the project's environment configuration.

Main variables include:

```env
MONGODB_URI=
JWT_SECRET=
NEXT_PUBLIC_BOT_RPC_URL=
NEXT_PUBLIC_CHAIN_ID=
NEXT_PUBLIC_TREASURY_V2_ADDRESS=
```

The contract address must match the deployment for the network you are using.

### 4. Start the development server

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

## 🔧 Smart Contract

To compile the V2 contract:

```bash
cd contracts
npm run build
```

To run smart contract integration tests:

```bash
npm test
```

Main contract:

```text
contracts/PledgrTreasuryV2.sol
```

Mainnet deployment and configuration are documented in:

```text
MAINNET-DEPLOYMENT.md
MAINNET.env.example
```

## 🔄 Example Scenario

### Community Fundraising

1. A member creates a proposal.
2. Admin and Validator review it according to the approval policy.
3. The proposal is approved.
4. The campaign is registered on BOT Chain.
5. Donors send BOT to the campaign.
6. The creator requests a withdrawal.
7. An authorized reviewer provides an EIP-712 signature.
8. The smart contract verifies the approval.
9. The approved amount is sent to the creator's wallet.

Fund transactions recorded on the blockchain can be independently verified on BOT Chain.

## 🔒 Security Approach

PLEDGR uses several security mechanisms:

- JWT authentication with an **HttpOnly cookie**.
- Passwords are hashed with `bcryptjs`.
- Wallet ownership is verified through signatures.
- A creator cannot act as their own withdrawal reviewer.
- Withdrawal approval is bound to the amount and campaign nonce.
- Refunds use a **pull-based** smart contract pattern.
- User private keys are **never stored by the application**.

## 🧪 Testing

Application checks:

```bash
npm run lint
```

Smart contract tests:

```bash
cd contracts
npm test
```

> Build and test results may vary depending on the local environment, RPC availability, database configuration, and wallet/network setup.

## 📌 Project Status

PLEDGR currently includes:

- Next.js web application
- Authentication and role management
- Organization and group management
- Proposal approval workflow
- Wallet verification
- Crowdfunding using native BOT
- V2 smart contract
- EIP-712 approval for registration and withdrawal
- Partial withdrawal
- Campaign cancellation and refund
- Blockchain event synchronization

### Note

The project still contains some **V1 components** for compatibility and migration purposes. The latest crowdfunding flow uses **V2**.

## 🎯 Main Key

**PLEDGR is a blockchain-based community crowdfunding platform that combines role-based approval with on-chain fund management.**

Its core value can be summarized as:

```text
Organized
     +
Transparent
     +
Wallet Verified
     +
Blockchain Based
     =
PLEDGR
```

PLEDGR is designed to make community fundraising more **structured, verifiable, and less dependent on a single party**.

---

# Bahasa Indonesia

PLEDGR adalah **platform crowdfunding berbasis blockchain** yang dibuat untuk organisasi dan komunitas.

PLEDGR membantu komunitas menjalankan penggalangan dana melalui proses yang lebih terstruktur:
**buat proposal → review → campaign aktif → donasi BOT → pencairan dana dengan approval**.

## 🎯 Masalah yang Diselesaikan

Penggalangan dana komunitas sering menghadapi beberapa masalah:

- proses persetujuan masih dilakukan secara manual;
- sulit memastikan siapa yang berhak menyetujui dana;
- riwayat transaksi tidak selalu transparan;
- pencairan dana dapat terlalu bergantung pada kepercayaan kepada satu pengelola.

**PLEDGR** mencoba menjawab masalah tersebut dengan menggabungkan:

**Role-based approval + database + blockchain + wallet verification.**

## 💡 Cara Kerja PLEDGR

```text
User
  ↓
Organization / Group
  ↓
Buat Proposal
  ↓
Admin / Validator Review
  ↓
Proposal Disetujui
  ↓
Campaign Dibuat di BOT Chain
  ↓
Donor Mengirim BOT
  ↓
Dana Dapat Dicairkan Setelah Approval
```

Blockchain digunakan sebagai sumber kebenaran untuk **saldo campaign dan pergerakan dana**, sementara database digunakan untuk mengelola user, organisasi, proposal, role, dan histori aplikasi.

## ✨ Fitur Utama

### 👤 User & Authentication

- Register dan login menggunakan email/password.
- JWT disimpan dalam **HttpOnly cookie**.
- Kepemilikan wallet dapat diverifikasi melalui signature MetaMask.

### 🏢 Organization & Group Management

- Membuat dan bergabung ke organisasi.
- Membuat group di dalam organisasi.
- Mengelola anggota dan join request.
- Role group:
  - **Admin**
  - **Validator**
  - **Member**

### 📋 Proposal & Approval

- Membuat proposal crowdfunding.
- Proposal melalui review sesuai role.
- Aturan approval disimpan pada proposal sehingga perubahan role berikutnya tidak otomatis mengubah aturan proposal lama.

### ⛓️ Blockchain Crowdfunding

- Menggunakan **native BOT** di BOT Chain.
- Campaign disimpan pada smart contract.
- Donor mengirim BOT langsung ke campaign.
- Saldo dan transaksi dapat diverifikasi secara on-chain.

### 💰 Withdrawal & Refund

- Creator dapat mengajukan pencairan sejumlah dana tertentu.
- Withdrawal membutuhkan approval dari reviewer yang berwenang.
- Donor dapat melakukan refund ketika campaign dibatalkan.
- Campaign juga memiliki mekanisme untuk mengakhiri fundraising.

### 🔄 Realtime Update

- Data aplikasi diperbarui menggunakan React Query.
- Event blockchain dipantau menggunakan ethers.
- Perubahan on-chain disinkronkan kembali ke aplikasi.

## 🔐 Role & Approval

| Creator | Approval |
|---|---|
| Admin | Validator |
| Validator | Admin / Validator lain |
| Member | Admin + Validator |

> Aturan approval dapat berbeda tergantung validator aktif di dalam group.

Tujuannya adalah memastikan **pencairan dana tidak hanya bergantung pada creator**.

## ⛓️ Blockchain V2

Smart contract utama berada di:

```text
contracts/PledgrTreasuryV2.sol
```

PLEDGR V2 menggunakan **EIP-712 typed signatures** untuk authorization.

Secara sederhana:

```text
Creator mengajukan withdrawal
        ↓
Reviewer melakukan signature
        ↓
Smart contract memverifikasi signature
        ↓
Dana sesuai approval dicairkan
```

Setiap withdrawal memiliki:

- `requestId`
- nominal yang disetujui
- campaign nonce
- waktu kedaluwarsa signature

Hal ini membantu mencegah perubahan nominal tanpa persetujuan dan penggunaan ulang approval lama.

## 🏗️ Arsitektur Sederhana

```text
                ┌───────────────┐
                │   Next.js UI  │
                └───────┬───────┘
                        │
                ┌───────▼───────┐
                │   API Routes  │
                └───────┬───────┘
                    ┌───┴────┐
                    ▼        ▼
              ┌─────────┐  ┌──────────────┐
              │ MongoDB │  │  BOT Chain   │
              └─────────┘  │Smart Contract│
                           └──────┬───────┘
                                  │
                              MetaMask
```

### Pembagian Tanggung Jawab

| Komponen | Fungsi |
|---|---|
| **Next.js / React** | Interface dan interaksi user |
| **API Routes** | Business logic dan authorization |
| **MongoDB** | User, organisasi, proposal, role, dan histori |
| **BOT Chain** | Saldo campaign dan transaksi dana |
| **MetaMask** | Koneksi wallet dan signature |
| **Smart Contract** | Validasi dan eksekusi transaksi on-chain |

## 🛠️ Tech Stack

- **Next.js 16**
- **React 19**
- **TypeScript**
- **Tailwind CSS**
- **MongoDB + Mongoose**
- **JWT + bcryptjs**
- **ethers v6**
- **MetaMask**
- **Solidity**
- **OpenZeppelin Contracts 5.4**
- **BOT Chain**

## 📁 Struktur Project

```text
pledgr/
├── app/              # Pages, layouts, API routes
├── components/       # Reusable UI components
├── context/          # Wallet & blockchain realtime context
├── features/         # Dashboard, proposal, group, organization, dll.
├── lib/              # Auth, authorization, blockchain, sync, helpers
├── models/           # MongoDB/Mongoose models
├── contracts/        # Smart contract V2 + contract tooling
├── tests/             # Tests
├── types/            # TypeScript types
└── README.md
```

## 🚀 Menjalankan Project

### 1. Clone repository

```bash
git clone <repository-url>
cd pledgr
```

### 2. Install dependency

```bash
npm install
cd contracts
npm install
cd ..
```

### 3. Konfigurasi environment variable

Buat `.env.local` berdasarkan konfigurasi environment project.

Variabel utama:

```env
MONGODB_URI=
JWT_SECRET=
NEXT_PUBLIC_BOT_RPC_URL=
NEXT_PUBLIC_CHAIN_ID=
NEXT_PUBLIC_TREASURY_V2_ADDRESS=
```

Address contract harus sesuai dengan deployment pada network yang digunakan.

### 4. Jalankan development server

```bash
npm run dev
```

Kemudian buka:

```text
http://localhost:3000
```

## 🔧 Smart Contract

Untuk compile contract V2:

```bash
cd contracts
npm run build
```

Untuk menjalankan integration test smart contract:

```bash
npm test
```

Contract utama:

```text
contracts/PledgrTreasuryV2.sol
```

Dokumentasi deployment dan konfigurasi mainnet berada di:

```text
MAINNET-DEPLOYMENT.md
MAINNET.env.example
```

## 🔄 Contoh Skenario

### Penggalangan Dana Komunitas

1. Member membuat proposal.
2. Admin dan Validator melakukan review sesuai approval policy.
3. Proposal disetujui.
4. Campaign diregistrasikan ke BOT Chain.
5. Donor mengirim BOT ke campaign.
6. Creator mengajukan withdrawal.
7. Reviewer yang berwenang melakukan EIP-712 signature.
8. Smart contract memverifikasi approval.
9. Dana yang disetujui dikirim ke wallet creator.

Transaksi dana yang tercatat di blockchain dapat diverifikasi secara independen melalui BOT Chain.

## 🔒 Security Approach

Beberapa mekanisme keamanan yang digunakan:

- JWT authentication dengan **HttpOnly cookie**.
- Password di-hash menggunakan `bcryptjs`.
- Wallet ownership diverifikasi melalui signature.
- Creator tidak dapat menjadi reviewer untuk withdrawal-nya sendiri.
- Approval withdrawal terikat pada nominal dan campaign nonce.
- Refund menggunakan pola smart contract **pull-based**.
- Private key pengguna **tidak disimpan oleh aplikasi**.

## 🧪 Testing

Pengecekan aplikasi:

```bash
npm run lint
```

Smart contract test:

```bash
cd contracts
npm test
```

> Hasil build dan test dapat berbeda tergantung environment lokal, ketersediaan RPC, konfigurasi database, serta konfigurasi wallet/network.

## 📌 Status Project

PLEDGR saat ini memiliki:

- Web application berbasis Next.js
- Authentication dan role management
- Organization & group management
- Proposal approval workflow
- Wallet verification
- Crowdfunding menggunakan native BOT
- Smart contract V2
- EIP-712 approval untuk registration dan withdrawal
- Partial withdrawal
- Campaign cancellation dan refund
- Blockchain event synchronization

### Catatan

Project masih menyimpan beberapa komponen **V1** untuk kebutuhan compatibility dan migrasi. Alur crowdfunding terbaru menggunakan **V2**.

## 🎯 Kunci Utama

**PLEDGR adalah platform crowdfunding komunitas berbasis blockchain yang menggabungkan role-based approval dengan pengelolaan dana secara on-chain.**

Nilai utamanya dapat diringkas sebagai:

```text
Terstruktur
     +
Transparan
     +
Wallet Terverifikasi
     +
Berbasis Blockchain
     =
PLEDGR
```

PLEDGR dirancang untuk membuat penggalangan dana komunitas menjadi lebih **terstruktur, dapat diverifikasi, dan tidak bergantung pada satu pihak saja**.

---

## Repository Notes

- This README intentionally combines both languages so judges can read the project in English or Indonesian without opening another file.
- The English section is placed first for international/hackathon judges.
- The Indonesian section mirrors the same project information for local reviewers.
